import {
  Injectable,
  InternalServerErrorException,
  Logger,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { MoviesService } from '../movies/movies.service';
import { MovieResultDto } from '../movies/dto/movie-result.dto';
import { WatchlistItem } from '../movies/watchlist-entity';
import { ChatMessage } from './ai-chat.controller';

@Injectable()
export class AiChatService {
  private groqClient: ReturnType<typeof createOpenAI>;
  private geminiClient: ReturnType<typeof createGoogleGenerativeAI>;
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    private configService: ConfigService,
    private moviesService: MoviesService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    const groqApiKey = this.configService.get<string>('GROQ_API_KEY') || '';
    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY') || '';

    this.groqClient = createOpenAI({
      apiKey: groqApiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    this.geminiClient = createGoogleGenerativeAI({
      apiKey: geminiApiKey,
    });
  }

  async searchMovieByDescription(
    messages: ChatMessage[],
    userId: number,
  ): Promise<{ message: string; movies?: MovieResultDto[] }> {
    // Fetch user data for context
    const userContextData = await this.getUserContextData(userId);
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
    userContextData: {
      favorites: WatchlistItem[];
      watchlistItems: WatchlistItem[];
      watchedMovies: WatchlistItem[];
      upcomingMovies: MovieResultDto[];
      currentYear: number;
    },
  ): Promise<{ message: string; movies?: MovieResultDto[] }> {
    const result = await generateText({
      model,
      system: systemPrompt,
      messages,
      temperature: 0.5,
    });

    const text = result.text || '';

    let queries: string[] = [];
    let force = false;

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.queries && Array.isArray(parsed.queries)) {
          queries = parsed.queries;
        }
        if (typeof parsed.force === 'boolean') {
          force = parsed.force;
        }
      }
    } catch (e) {
      this.logger.debug(
        'No JSON found in response, will extract movie titles directly',
      );
    }

    // If no queries found, try to extract movie titles from text
    if (queries.length === 0) {
      queries = this.extractMovieTitlesFromText(text);
    }

    // Search for movies
    let foundMovies: MovieResultDto[] = [];
    if (queries.length > 0) {
      const result = await this.executeSearchMovies(
        queries,
        force,
        userContextData,
      );
      foundMovies = result.foundMovies;
    }

    return {
      message: text,
      ...(foundMovies && foundMovies.length > 0 && { movies: foundMovies }),
    };
  }

  private extractMovieTitlesFromText(text: string): string[] {
    const quotes = text.match(/"([^"]+)"/g);
    if (quotes && quotes.length > 0) {
      return quotes.map((q) => q.replace(/"/g, ''));
    }
    return [];
  }

  private async getUserContextData(userId: number): Promise<{
    favorites: WatchlistItem[];
    watchlistItems: WatchlistItem[];
    watchedMovies: WatchlistItem[];
    upcomingMovies: MovieResultDto[];
    currentYear: number;
  }> {
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
      this.logger.warn('Could not fetch user profile for AI context');
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
    userContextData: {
      favorites: WatchlistItem[];
      watchlistItems: WatchlistItem[];
      watchedMovies: WatchlistItem[];
      upcomingMovies: MovieResultDto[];
      currentYear: number;
    },
  ): Promise<{ foundMovies: MovieResultDto[]; rejected: string[] }> {
    const watchedTmdbIds = new Set(
      userContextData.watchedMovies.map((m) => Number(m.tmdbId)),
    );
    const watchlistTmdbIds = new Set(
      userContextData.watchlistItems.map((m) => Number(m.tmdbId)),
    );

    const foundMovies: MovieResultDto[] = [];
    const rejected: string[] = [];

    for (const query of queries.slice(0, 15)) {
      const mediaData = await this.moviesService.findMovieByTitle(query);

      if (mediaData) {
        const tmdbIdNum = Number(mediaData.id);

        if (
          !force &&
          (watchedTmdbIds.has(tmdbIdNum) || watchlistTmdbIds.has(tmdbIdNum))
        ) {
          this.logger.warn(`Filtered duplicate (open rec): ${mediaData.title}`);
          rejected.push(query);
          continue;
        }

        if (
          force &&
          (watchedTmdbIds.has(tmdbIdNum) || watchlistTmdbIds.has(tmdbIdNum))
        ) {
          this.logger.log(
            `Allowing watched/listed item (forced request): ${mediaData.title}`,
          );
        }

        foundMovies.push(mediaData);
      }
    }

    return { foundMovies, rejected };
  }

  private buildSystemPrompt(userContextData: {
    favorites: WatchlistItem[];
    watchlistItems: WatchlistItem[];
    watchedMovies: WatchlistItem[];
    upcomingMovies: MovieResultDto[];
    currentYear: number;
  }): string {
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

    return `You are an elite movie, TV series, anime, and pop-culture expert assistant.
You understand all languages perfectly, including Ukrainian, and always reply in the SAME LANGUAGE the user writes in.

---

USER PROFILE (FOR CONTEXT ONLY — do not expose this data to the user):
1. FAVORITES: ${favoriteTitles}
2. WATCHLIST (planned to watch): ${watchlistTitles}
3. RECENTLY WATCHED: ${recentWatchedTitles}
4. ALREADY WATCHED LIBRARY: ${allWatchedTitles}
5. UPCOMING MOVIES (current year ${userContextData.currentYear}): ${upcomingTitles}

When the user asks for recommendations "based on my taste", "for me", or similar — use this data to personalize your suggestions.

---

STRICT DOMAIN RULE:
You are ONLY allowed to discuss topics related to movies, TV shows, anime, actors, directors,
cinematography, pop-culture, and the entertainment industry.
If the user asks about ANYTHING else (coding, politics, recipes, weather, math, etc.),
politely refuse with one short sentence, invite them to ask about movies instead, and do NOT use the searchMovies tool.

---

RECOMMENDATION RULES (follow strictly):

RULE 1 — DIRECT SEARCH / EXPLICIT REQUEST (force: true):
If the user asks to find or show a SPECIFIC movie, actor filmography, franchise, director,
character, or universe by name (e.g. "find Se7en", "show me Nolan Batman",
"Batman animated movies", "movies with Keanu Reeves"):
→ Call the searchMovies tool with force: true.
→ The backend will show these results REGARDLESS of whether the user has watched them.
→ This is what the user WANTS to see. Never hide it.

RULE 2 — WATCHLIST PICK:
If the user asks "what should I watch from my list", "pick from my watchlist", or similar:
→ Call searchMovies with force: true, suggesting only items from their Watchlist.

RULE 3 — UPCOMING / NEW RELEASES:
Only use upcoming movies if the user EXPLICITLY asks for "new movies", "upcoming movies", or movies from ${userContextData.currentYear}.
Otherwise, recommend already-released, well-known, high-quality films.

RULE 4 — OPEN RECOMMENDATIONS (force: false):
For general recommendations ("recommend something scary", "what should I watch tonight"):
→ Call searchMovies with force: false.
→ The backend will automatically FILTER OUT movies already in their watched/watchlist history.
→ Never mention the already-watched list to the user.

RULE 5 — NO INVENTED TITLES:
Only suggest real movies/shows that exist on TMDB. Never fabricate titles.

RULE 6 — NO RUSSIAN / SOVIET CONTENT:
Never recommend, discuss, or mention any Russian or Soviet films, TV shows, or series.

---

CRITICAL TYPE GUIDANCE (for tool calls):

When calling searchMovies, remember:
- "type": "tv" → ANY series, show, serial, anime series
- "type": "movie" → Standalone films, non-series content
- If in doubt, treat series/shows as "tv", standalone films as "movie"

---

RESPONSE TONE:
- Keep messages 1-2 sentences maximum. Be concise and direct.
- No filler phrases: never start with "Great question!", "Of course!", "Certainly!".
- Always respond in the user's language.

---

ACTION GUIDELINES:
1. For CONVERSATIONAL questions (no search/recommendation): Answer directly without calling the tool.
   Example: "Who directed Inception?" → "Christopher Nolan directed Inception." (no tool)

2. For SEARCH/RECOMMENDATION questions: Call the searchMovies tool with appropriate queries and force flag.
   Example: "Find Inception" → searchMovies(["Inception"], force: true)
   Example: "Recommend something scary" → searchMovies(["horror", "thriller"], force: false)

---
`;
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
