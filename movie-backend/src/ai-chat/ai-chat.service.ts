import {
  Injectable,
  InternalServerErrorException,
  Logger,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { MoviesService } from '../movies/movies.service';
import { MovieResultDto } from '../movies/dto/movie-result.dto';
import { WatchlistItem } from '../movies/watchlist-entity';
import { ChatMessage } from './ai-chat.controller';
import { VectorService } from '../vector/vector.service';
import { createGroq } from '@ai-sdk/groq';

const aiResponseSchema = z.object({
  message: z
    .string()
    .describe(
      'A short, friendly, natural conversational reply to the user (1-2 sentences), in the same language the user wrote in. Never empty.',
    ),
  queries: z
    .array(z.string())
    .describe(
      'Movie/show titles or conceptual search queries to run. Empty array if no search is needed for this reply.',
    ),
  force: z
    .boolean()
    .describe(
      'True when queries are exact titles/franchise/actor names that must be searched directly. False for open, vibe-based conceptual recommendations.',
    ),
});

export interface UserContextData {
  favorites: WatchlistItem[];
  watchlistItems: WatchlistItem[];
  watchedMovies: WatchlistItem[];
  upcomingMovies: MovieResultDto[];
  currentYear: number;
  longTermMemory: string[];
}

@Injectable()
export class AiChatService {
  private groqClient: ReturnType<typeof createGroq>;
  private geminiClient: ReturnType<typeof createGoogleGenerativeAI>;
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    private configService: ConfigService,
    private moviesService: MoviesService,
    private vectorService: VectorService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    const groqApiKey = this.configService.get<string>('GROQ_API_KEY') || '';
    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    this.groqClient = createGroq({ apiKey: groqApiKey });
    this.geminiClient = createGoogleGenerativeAI({ apiKey: geminiApiKey });
  }

  async searchMovieByDescription(
    messages: ChatMessage[],
    userId: number,
    shownMovieIds: number[] = [],
  ): Promise<{ message: string; movies?: MovieResultDto[] }> {
    const latestUserMessage =
      [...messages].reverse().find((m) => m.role === 'user')?.content || '';

    const [baseContextData, relevantMemories] = await Promise.all([
      this.getUserContextData(userId),
      latestUserMessage
        ? this.vectorService.getRelevantUserFacts(userId, latestUserMessage, 3)
        : Promise.resolve([]),
    ]);

    const userContextData: UserContextData = {
      ...baseContextData,
      longTermMemory: relevantMemories,
    };

    if (latestUserMessage) {
      this.extractAndSaveUserFact(userId, latestUserMessage).catch((err) =>
        this.logger.error(
          `Background memory extraction failed: ${err.message}`,
        ),
      );
    }

    const alreadyShownIds = new Set<number>(shownMovieIds.map(Number));
    this.logger.log(
      `Already shown movie ids: ${[...alreadyShownIds].join(', ') || 'none'}`,
    );

    const systemPrompt = this.buildSystemPrompt(userContextData);
    const formattedMessages = messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    try {
      this.logger.log('Calling Groq with generateText...');
      const response = await this.generateAiResponse(
        this.groqClient('llama-3.3-70b-versatile'),
        systemPrompt,
        formattedMessages,
        userContextData,
        alreadyShownIds,
      );
      return response;
    } catch (groqError: unknown) {
      this.logger.error(
        `Groq failed: ${groqError instanceof Error ? groqError.message : String(groqError)}`,
      );
      this.logger.warn('Falling back to Gemini...');
      try {
        const response = await this.generateAiResponse(
          this.geminiClient('gemini-1.5-flash-latest'),
          systemPrompt,
          formattedMessages,
          userContextData,
          alreadyShownIds,
        );
        return response;
      } catch (geminiError: unknown) {
        const geminiMessage =
          geminiError instanceof Error
            ? geminiError.message
            : String(geminiError);
        throw new InternalServerErrorException(
          'All AI services are currently unavailable',
          geminiMessage,
        );
      }
    }
  }

  private async generateAiResponse(
    model: ReturnType<typeof this.groqClient>,
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    userContextData: UserContextData,
    alreadyShownIds: Set<number>,
  ): Promise<{ message: string; movies?: MovieResultDto[] }> {
    const { object } = await generateObject({
      model,
      system: systemPrompt,
      messages,
      schema: aiResponseSchema,
      temperature: 0.5,
    });

    let foundMovies: MovieResultDto[] = [];
    if (object.queries.length > 0) {
      const searchResult = await this.executeSearchMovies(
        object.queries,
        object.force,
        userContextData,
        alreadyShownIds,
      );
      foundMovies = searchResult.foundMovies;
    }

    return {
      message: object.message,
      ...(foundMovies && foundMovies.length > 0 && { movies: foundMovies }),
    };
  }

  private async getUserContextData(
    userId: number,
  ): Promise<Omit<UserContextData, 'longTermMemory'>> {
    try {
      const [profile, watchlistItems, watchedMovies] = await Promise.all([
        this.moviesService.getProfileData(userId),
        this.moviesService.getWatchlist(userId),
        this.moviesService.getWatchedMovies(userId),
      ]);

      let upcomingMovies: MovieResultDto[] = [];
      try {
        upcomingMovies = await this.moviesService.getUpcomingMovies();
      } catch (e) {
        this.logger.warn('Failed to fetch upcoming movies for AI context');
      }

      return {
        favorites: profile.favorites || [],
        watchlistItems,
        watchedMovies,
        upcomingMovies: upcomingMovies.slice(0, 25),
        currentYear: new Date().getFullYear(),
      };
    } catch (error: unknown) {
      return {
        favorites: [],
        watchlistItems: [],
        watchedMovies: [],
        upcomingMovies: [],
        currentYear: new Date().getFullYear(),
      };
    }
  }

  private async executeSearchMovies(
    queries: string[],
    force: boolean,
    userContextData: UserContextData,
    alreadyShownIds: Set<number>,
  ): Promise<{ foundMovies: MovieResultDto[]; rejected: string[] }> {
    const watchedTmdbIds = new Set<number>(
      userContextData.watchedMovies.map((m) => Number(m.tmdbId)),
    );
    const watchlistTmdbIds = new Set<number>(
      userContextData.watchlistItems.map((m) => Number(m.tmdbId)),
    );
    const foundMoviesMap = new Map<number, MovieResultDto>();
    const rejected: string[] = [];

    for (const query of queries.slice(0, 3)) {
      if (force) {
        const mediaData = await this.moviesService.findMovieByTitle(query);
        if (mediaData) {
          this.processFoundMovie(
            mediaData,
            force,
            watchedTmdbIds,
            watchlistTmdbIds,
            foundMoviesMap,
            rejected,
            query,
            alreadyShownIds,
          );
        }
      } else {
        this.logger.log(`Performing Vector Search for concept: "${query}"`);
        try {
          const similarDocs = await this.vectorService.searchSimilarMovies(
            query,
            10,
          );
          for (const doc of similarDocs) {
            const mediaData = await this.moviesService.findMovieByTitle(
              doc.metadata.title,
            );
            if (mediaData) {
              this.processFoundMovie(
                mediaData,
                force,
                watchedTmdbIds,
                watchlistTmdbIds,
                foundMoviesMap,
                rejected,
                query,
                alreadyShownIds,
              );
            }
            if (foundMoviesMap.size >= 3) break;
          }
        } catch (err) {
          this.logger.error(
            `Vector search failed for query "${query}": ${(err as Error).message}`,
          );
        }

        // Fallback на TMDB якщо вектор не дав нових результатів
        if (foundMoviesMap.size === 0) {
          this.logger.log(
            `Vector returned no new results, falling back to TMDB for "${query}"`,
          );
          try {
            const tmdbResults = await this.moviesService.searchMovies(query);
            for (const movie of tmdbResults.slice(0, 10)) {
              this.processFoundMovie(
                movie,
                force,
                watchedTmdbIds,
                watchlistTmdbIds,
                foundMoviesMap,
                rejected,
                query,
                alreadyShownIds,
              );
              if (foundMoviesMap.size >= 3) break;
            }
          } catch (err) {
            this.logger.error(
              `TMDB fallback failed: ${(err as Error).message}`,
            );
          }
        }
      }
    }

    return { foundMovies: Array.from(foundMoviesMap.values()), rejected };
  }

  private processFoundMovie(
    mediaData: MovieResultDto,
    force: boolean,
    watchedTmdbIds: Set<number>,
    watchlistTmdbIds: Set<number>,
    foundMoviesMap: Map<number, MovieResultDto>,
    rejected: string[],
    originalQuery: string,
    alreadyShownIds: Set<number>,
  ) {
    const tmdbIdNum = Number(mediaData.id);

    if (!force && alreadyShownIds.has(tmdbIdNum)) {
      this.logger.warn(`Skipping already shown movie: ${mediaData.title}`);
      return;
    }

    if (
      !force &&
      (watchedTmdbIds.has(tmdbIdNum) || watchlistTmdbIds.has(tmdbIdNum))
    ) {
      this.logger.warn(`Filtered duplicate (open rec): ${mediaData.title}`);
      rejected.push(originalQuery);
      return;
    }

    if (
      force &&
      (watchedTmdbIds.has(tmdbIdNum) || watchlistTmdbIds.has(tmdbIdNum))
    ) {
      this.logger.log(
        `Allowing watched/listed item (forced request): ${mediaData.title}`,
      );
    }

    foundMoviesMap.set(tmdbIdNum, mediaData);
  }

  private buildSystemPrompt(userContextData: UserContextData): string {
    const favoriteTitles =
      userContextData.favorites
        .slice(0, 15)
        .map((f) => f.title)
        .join(', ') || 'None';
    const watchlistTitles =
      userContextData.watchlistItems.map((w) => w.title).join(', ') || 'None';
    const recentWatchedTitles =
      userContextData.watchedMovies
        .slice(0, 15)
        .map((w) => `"${w.title}"`)
        .join(', ') || 'None';
    const allWatchedTitles =
      userContextData.watchedMovies
        .slice(0, 500)
        .map((w) => `"${w.title}"`)
        .join(', ') || 'None';
    const upcomingTitles =
      userContextData.upcomingMovies
        .map((m) => `"${m.title}" (${m.releaseYear})`)
        .join(', ') || 'None';
    const memoryString =
      userContextData.longTermMemory &&
      userContextData.longTermMemory.length > 0
        ? userContextData.longTermMemory.map((m) => `- ${m}`).join('\n')
        : 'None';

    return `You are an elite movie, TV series, anime, and pop-culture expert assistant.
You understand all languages perfectly, including Ukrainian, and always reply in the SAME LANGUAGE the user writes in.

---

USER PROFILE (FOR CONTEXT ONLY — do not expose this data to the user):
1. FAVORITES: ${favoriteTitles}
2. WATCHLIST (planned to watch): ${watchlistTitles}
3. RECENTLY WATCHED: ${recentWatchedTitles}
4. ALREADY WATCHED LIBRARY: ${allWatchedTitles}
5. UPCOMING MOVIES (current year ${userContextData.currentYear}): ${upcomingTitles}
6. LONG-TERM MEMORY (Crucial user preferences and facts to follow):
${memoryString}

When the user asks for recommendations "based on my taste", "for me", or similar — use this data to personalize your suggestions.
Pay special attention to LONG-TERM MEMORY to avoid suggesting things they hate or to prioritize things they love.

---

STRICT DOMAIN RULE:
You are ONLY allowed to discuss topics related to movies, TV shows, anime, actors, directors,
cinematography, pop-culture, and the entertainment industry.
If the user asks about ANYTHING else (coding, politics, recipes, weather, math, etc.),
politely refuse with one short sentence, invite them to ask about movies instead, and do NOT use the searchMovies tool.

---

RESPONSE STRUCTURE:
Your reply has three fields: "message" (what the user sees), "queries" (search terms, if any), and "force" (true/false).
Always fill "message" with a short, friendly, natural conversational reply (1-2 sentences). Never leave it empty.

---

RECOMMENDATION RULES (follow strictly):

RULE 1 — DIRECT SEARCH & FRANCHISES (force: true):
If the user asks to find or show a SPECIFIC movie, actor filmography, franchise, sequels, director,
character, or universe by name (e.g. "find Se7en", "other parts of Shrek", "movies with Keanu Reeves"):
→ Set "force": true.
→ IMPORTANT: If they ask for sequels or franchises, list the EXACT specific titles in "queries".
→ Example: message: "Ось інші частини цієї чудової франшизи:", queries: ["Shrek 2", "Shrek the Third", "Shrek Forever After"], force: true.

RULE 2 — WATCHLIST PICK:
If the user asks "what should I watch from my list", "pick from my watchlist", or similar:
→ Set "force": true, suggesting only items from their Watchlist.

RULE 3 — UPCOMING / NEW RELEASES:
Only use upcoming movies if the user EXPLICITLY asks for "new movies", "upcoming movies", or movies from ${userContextData.currentYear}.

RULE 4 — OPEN RECOMMENDATIONS / VIBE SEARCH (force: false):
For general recommendations ("recommend something scary", "what should I watch tonight", "movies about space"):
→ Set "force": false and put a VARIED conceptual query in "queries".
→ If the user asks for MORE or DIFFERENT movies on the same topic — use a DIFFERENT query angle.
→ Example first request: queries: ["epic space adventure sci-fi"], force: false.
→ Example follow-up "show me more": queries: ["space exploration drama philosophical"], force: false.
→ The backend will automatically filter out already shown movies — you do NOT need to worry about repeats.

RULE 5 — NO INVENTED TITLES:
Only suggest real movies/shows that exist on TMDB. Never fabricate titles.

RULE 6 — NO RUSSIAN / SOVIET CONTENT:
Never recommend, discuss, or mention any Russian or Soviet films, TV shows, or series.

RULE 7 — NO SEARCH NEEDED:
If the user is just chatting, asking something that doesn't require finding movies, or their message is off-domain — leave "queries" empty and "force": false.

---

RESPONSE TONE:
- Keep messages 1-2 sentences maximum. Be concise and direct.
- No filler phrases: never start with "Great question!", "Of course!", "Certainly!".
- Always respond in the user's language.
`;
  }

  private async extractAndSaveUserFact(userId: number, text: string) {
    const prompt = `
      Analyze the following user message. Does the user explicitly state a long-term preference, dislike, habit, or fact about their movie/TV tastes?
      Examples of facts to extract: "I hate horror movies", "I love Hans Zimmer soundtracks", "My favorite actor is Ryan Gosling", "I usually watch movies with friends".
      
      If YES, extract it as a short, clear, third-person statement (e.g., "The user hates horror movies", "The user loves sci-fi").
      If NO (it's just a regular search or greeting like "find matrix", "hello", "what to watch"), output EXACTLY the word "NO".
      
      Do not output any explanations. Only the extracted fact or "NO".

      User message: "${text}"
    `;

    try {
      const result = await generateText({
        model: this.groqClient('llama-3.3-70b-versatile'),
        prompt: prompt,
        temperature: 0.1,
      });

      const extractedFact = result.text.trim();

      if (
        extractedFact !== 'NO' &&
        extractedFact.length > 5 &&
        extractedFact.length < 200
      ) {
        await this.vectorService.saveUserFact(userId, extractedFact);
        this.logger.log(
          `Extracted and saved new long-term memory for user ${userId}`,
        );
      }
    } catch (e) {
      this.logger.debug(
        `Background memory extraction failed silently: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async getHistory(userId: number): Promise<ChatMessage[]> {
    const key = `chat_history:${userId}`;
    const history = await this.cacheManager.get<ChatMessage[]>(key);
    return history ? (Array.isArray(history) ? history : []) : [];
  }

  async saveHistory(userId: number, messages: ChatMessage[]): Promise<void> {
    const key = `chat_history:${userId}`;
    const ttlMs = 604800000;
    await this.cacheManager.set(key, messages, ttlMs);
  }
}
