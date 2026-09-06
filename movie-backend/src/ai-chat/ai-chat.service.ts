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
import { createOpenAI } from '@ai-sdk/openai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { MoviesService } from '../movies/movies.service';
import { MovieResultDto } from '../movies/dto/movie-result.dto';
import { WatchlistItem } from '../movies/watchlist-entity';
import { ChatMessage } from './interfaces/chat-message.interface';
import { VectorService } from '../vector/vector.service';
import { createGroq } from '@ai-sdk/groq';
import { AiUsageLogService } from './ai-usage-log.service';
import { getErrorMessage } from '../common/utils/error.utils';

const aiResponseSchema = z.object({
  message: z
    .string()
    .describe(
      'A short, friendly, natural conversational reply to the user (1-2 sentences), in the same language the user wrote in. Never empty.',
    ),
  titles: z
    .array(z.string())
    .describe(
      'Concrete, real movie/show titles to look up directly (e.g. "Rush", "The Dark Knight"). Use this for BOTH exact franchise asks AND vibe/conceptual recommendations- always name real titles you know fit, rather than only a vague concept. Empty array if no search is needed for this reply.',
    ),
  concepts: z
    .array(z.string())
    .describe(
      'Optional conceptual/vibe search phrases (e.g. "epic space adventure sci-fi") to additionally search a semantic movie index, for extra variety beyond the named titles. Usually empty or 1 item; only relevant for open/vibe recommendations, never for exact franchise asks.',
    ),
  force: z
    .boolean()
    .describe(
      'True when queries are exact titles/franchise/actor names that must be searched directly. False for open, vibe-based conceptual recommendations.',
    ),
  excludeOwned: z
    .boolean()
    .describe(
      'True ONLY when the user explicitly asks for titles they have not watched yet and/or have not added to their watchlist yet (e.g. "які я ще не додав", "яких я ще не бачив", "not in my watchlist yet", "haven\'t seen"). False otherwise, including for RULE 2 watchlist picks.',
    ),
});

const watchTogetherSchema = z.object({
  message: z
    .string()
    .describe(
      'A short, friendly reply (1-2 sentences) explaining the pick for both friends, in Ukrainian.',
    ),
  titles: z
    .array(z.string())
    .describe(
      'Up to 8 real movie/show titles both friends would genuinely enjoy together. Add year in parens ("Title (YYYY)") when it helps disambiguate. Never invent titles.',
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

export interface RecommendationReason {
  preferenceText: string;
  similarityScore: number;
}

export const DEFAULT_AI_PROVIDER_TIMEOUT_MS = 15000;

@Injectable()
export class AiChatService {
  private groqClient: ReturnType<typeof createGroq>;
  private geminiClient: ReturnType<typeof createGoogleGenerativeAI>;
  private deepseekClient: ReturnType<typeof createDeepSeek>;
  private deepseekCompatClient: ReturnType<typeof createOpenAI>;
  private readonly logger = new Logger(AiChatService.name);
  private readonly providerTimeoutMs: number;

  constructor(
    private configService: ConfigService,
    private moviesService: MoviesService,
    private vectorService: VectorService,
    private aiUsageLogService: AiUsageLogService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    const groqApiKey = this.configService.get<string>('GROQ_API_KEY') || '';
    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    const deepseekApiKey =
      this.configService.get<string>('DEEPSEEK_API_KEY') || '';
    this.groqClient = createGroq({ apiKey: groqApiKey });
    this.geminiClient = createGoogleGenerativeAI({ apiKey: geminiApiKey });
    this.deepseekClient = createDeepSeek({ apiKey: deepseekApiKey });
    // recommendForTwo's DeepSeek fallback still goes through the OpenAI-
    // compatible endpoint (unchanged) rather than the dedicated client above,
    // which is used only as searchMovieByDescription's primary provider.
    this.deepseekCompatClient = createOpenAI({
      apiKey: deepseekApiKey,
      baseURL: 'https://api.deepseek.com/v1',
    });
    this.providerTimeoutMs = Number(
      this.configService.get<string>('AI_PROVIDER_TIMEOUT_MS') ??
        DEFAULT_AI_PROVIDER_TIMEOUT_MS,
    );
  }

  private newProviderAbortSignal(): AbortSignal {
    return AbortSignal.timeout(this.providerTimeoutMs);
  }

  async searchMovieByDescription(
    messages: ChatMessage[],
    userId: number,
    shownMovieIds: number[] = [],
  ): Promise<{
    message: string;
    movies?: MovieResultDto[];
    reasoning?: RecommendationReason[];
  }> {
    const latestUserMessage =
      [...messages].reverse().find((m) => m.role === 'user')?.content || '';

    const [baseContextData, relevantPreferences] = await Promise.all([
      this.getUserContextData(userId),
      latestUserMessage
        ? this.vectorService.getRelevantUserFactsWithScores(
            userId,
            latestUserMessage,
            3,
          )
        : Promise.resolve([]),
    ]);

    const userContextData: UserContextData = {
      ...baseContextData,
      longTermMemory: relevantPreferences.map((p) => p.preferenceText),
    };

    if (latestUserMessage) {
      this.extractAndSaveUserFact(userId, latestUserMessage).catch(
        (err: unknown) =>
          this.logger.error(
            `Background memory extraction failed: ${getErrorMessage(err)}`,
          ),
      );
    }

    const alreadyShownIds = new Set<number>(shownMovieIds.map(Number));
    this.logger.log(
      `Already shown movie ids: ${[...alreadyShownIds].join(', ') || 'none'}`,
    );

    const systemPrompt = this.buildSystemPrompt(userContextData);
    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      // Groq (gpt-oss-120b) is primary here: it's the proven-good option in
      // production. DeepSeek V4-Pro is kept as the failover for when Groq
      // errors out or hits its rate limit- flip this back to primary once
      // the DeepSeek account has a funded balance and its results have been
      // re-validated against Groq's.
      this.logger.log('Calling Groq with generateObject...');
      const startedAt = Date.now();
      const { tokenCount, ...response } = await this.generateAiResponse(
        this.groqClient('openai/gpt-oss-120b'),
        systemPrompt,
        formattedMessages,
        userContextData,
        alreadyShownIds,
        relevantPreferences,
      );
      this.logger.log('Response served by Groq (primary)');
      this.aiUsageLogService
        .logUsage({
          userId,
          provider: 'groq',
          wasFailover: false,
          requestType: 'chat',
          tokenCount,
          latencyMs: Date.now() - startedAt,
        })
        .catch((err: unknown) =>
          this.logger.warn(`AI usage logging failed: ${getErrorMessage(err)}`),
        );
      return response;
    } catch (groqError: unknown) {
      this.logger.error(
        `Groq failed: ${groqError instanceof Error ? groqError.message : String(groqError)}`,
      );
      this.logger.warn('Falling back to DeepSeek...');
      try {
        const startedAt = Date.now();
        const { tokenCount, ...response } = await this.generateAiResponse(
          this.deepseekClient('deepseek-v4-pro'),
          systemPrompt,
          formattedMessages,
          userContextData,
          alreadyShownIds,
          relevantPreferences,
        );
        this.logger.log('Response served by DeepSeek (fallback)');
        this.aiUsageLogService
          .logUsage({
            userId,
            provider: 'deepseek',
            wasFailover: true,
            requestType: 'chat',
            tokenCount,
            latencyMs: Date.now() - startedAt,
          })
          .catch((err: unknown) =>
            this.logger.warn(
              `AI usage logging failed: ${getErrorMessage(err)}`,
            ),
          );
        return response;
      } catch (deepseekError: unknown) {
        const deepseekMessage =
          deepseekError instanceof Error
            ? deepseekError.message
            : String(deepseekError);
        throw new InternalServerErrorException(
          'All AI services are currently unavailable',
          deepseekMessage,
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
    relevantPreferences: RecommendationReason[],
  ): Promise<{
    message: string;
    movies?: MovieResultDto[];
    reasoning?: RecommendationReason[];
    tokenCount?: number;
  }> {
    const { object, usage } = await generateObject({
      model,
      system: systemPrompt,
      messages,
      schema: aiResponseSchema,
      temperature: 0.5,
      abortSignal: this.newProviderAbortSignal(),
    });

    let foundMovies: MovieResultDto[] = [];
    if (object.titles.length > 0 || object.concepts.length > 0) {
      const searchResult = await this.executeSearchMovies(
        object.titles,
        object.concepts,
        object.force,
        object.excludeOwned,
        userContextData,
        alreadyShownIds,
      );
      foundMovies = searchResult.foundMovies;
    }

    return {
      message: object.message,
      ...(foundMovies && foundMovies.length > 0 && { movies: foundMovies }),
      ...(foundMovies.length > 0 &&
        relevantPreferences.length > 0 && {
          reasoning: relevantPreferences,
        }),
      ...(usage?.totalTokens !== undefined && {
        tokenCount: usage.totalTokens,
      }),
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
      } catch {
        this.logger.warn('Failed to fetch upcoming movies for AI context');
      }

      return {
        favorites: profile.favorites || [],
        watchlistItems,
        watchedMovies,
        upcomingMovies: upcomingMovies.slice(0, 25),
        currentYear: new Date().getFullYear(),
      };
    } catch {
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
    titles: string[],
    concepts: string[],
    force: boolean,
    excludeOwned: boolean,
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
    const MAX_RESULTS = 8;

    const titleLookups = await Promise.all(
      titles.slice(0, MAX_RESULTS).map(async (rawTitle) => {
        const { title, year } = this.parseTitleYear(rawTitle);
        return {
          title,
          mediaData: await this.moviesService.findMovieByTitle(title, year),
        };
      }),
    );
    for (const { title, mediaData } of titleLookups) {
      if (foundMoviesMap.size >= MAX_RESULTS) break;
      if (mediaData) {
        this.processFoundMovie(
          mediaData,
          force,
          excludeOwned,
          watchedTmdbIds,
          watchlistTmdbIds,
          foundMoviesMap,
          rejected,
          title,
          alreadyShownIds,
        );
      }
    }

    if (foundMoviesMap.size < MAX_RESULTS) {
      const conceptSearches = await Promise.all(
        concepts.slice(0, 3).map(async (concept) => {
          this.logger.log(`Performing Vector Search for concept: "${concept}"`);
          try {
            const similarDocs = await this.vectorService.searchSimilarMovies(
              concept,
              10,
            );
            return { concept, similarDocs };
          } catch (err) {
            this.logger.error(
              `Vector search failed for concept "${concept}": ${(err as Error).message}`,
            );
            return { concept, similarDocs: [] };
          }
        }),
      );

      for (const { concept, similarDocs } of conceptSearches) {
        if (foundMoviesMap.size >= MAX_RESULTS) break;
        const docLookups = await Promise.all(
          similarDocs.map((doc) =>
            this.moviesService.findMovieByTitle(doc.metadata.title),
          ),
        );
        for (const mediaData of docLookups) {
          if (foundMoviesMap.size >= MAX_RESULTS) break;
          if (mediaData) {
            this.processFoundMovie(
              mediaData,
              force,
              excludeOwned,
              watchedTmdbIds,
              watchlistTmdbIds,
              foundMoviesMap,
              rejected,
              concept,
              alreadyShownIds,
            );
          }
        }
      }
    }

    if (foundMoviesMap.size === 0) {
      const fallbackQuery = titles[0] || concepts[0];
      if (fallbackQuery) {
        this.logger.log(
          `Falling back to plain TMDB search for "${fallbackQuery}"`,
        );
        try {
          const tmdbResults =
            await this.moviesService.searchMovies(fallbackQuery);
          for (const movie of tmdbResults.slice(0, 10)) {
            if (foundMoviesMap.size >= MAX_RESULTS) break;
            this.processFoundMovie(
              movie,
              force,
              excludeOwned,
              watchedTmdbIds,
              watchlistTmdbIds,
              foundMoviesMap,
              rejected,
              fallbackQuery,
              alreadyShownIds,
            );
          }
        } catch (err) {
          this.logger.error(`TMDB fallback failed: ${(err as Error).message}`);
        }
      }
    }

    return { foundMovies: Array.from(foundMoviesMap.values()), rejected };
  }

  private parseTitleYear(rawTitle: string): {
    title: string;
    year: number | undefined;
  } {
    const match = rawTitle.match(/^(.*?)\s*\((\d{4})\)\s*$/);
    if (match) {
      return { title: match[1].trim(), year: Number(match[2]) };
    }
    return { title: rawTitle.trim(), year: undefined };
  }

  private processFoundMovie(
    mediaData: MovieResultDto,
    force: boolean,
    excludeOwned: boolean,
    watchedTmdbIds: Set<number>,
    watchlistTmdbIds: Set<number>,
    foundMoviesMap: Map<number, MovieResultDto>,
    rejected: string[],
    originalQuery: string,
    alreadyShownIds: Set<number>,
  ) {
    const tmdbIdNum = Number(mediaData.id);
    const shouldExcludeOwned = excludeOwned || !force;

    if (!force && alreadyShownIds.has(tmdbIdNum)) {
      this.logger.warn(`Skipping already shown movie: ${mediaData.title}`);
      return;
    }

    if (
      shouldExcludeOwned &&
      (watchedTmdbIds.has(tmdbIdNum) || watchlistTmdbIds.has(tmdbIdNum))
    ) {
      this.logger.warn(`Filtered duplicate: ${mediaData.title}`);
      rejected.push(originalQuery);
      return;
    }

    if (
      !shouldExcludeOwned &&
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
        .slice(0, 150)
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
You understand all languages perfectly, including Ukrainian, and always reply in the SAME LANGUAGE as the user's
MOST RECENT message- not the language of earlier messages in this conversation. If the user switches language
mid-conversation (e.g. previous messages were in Ukrainian but the latest one is in English), switch with them
immediately and reply in English. Never keep replying in the old language just because earlier turns used it.

---

USER PROFILE (FOR CONTEXT ONLY- do not expose this data to the user):
1. FAVORITES: ${favoriteTitles}
2. WATCHLIST (planned to watch): ${watchlistTitles}
3. RECENTLY WATCHED: ${recentWatchedTitles}
4. ALREADY WATCHED LIBRARY: ${allWatchedTitles}
5. UPCOMING MOVIES (current year ${userContextData.currentYear}): ${upcomingTitles}
6. LONG-TERM MEMORY (Crucial user preferences and facts to follow):
${memoryString}

When the user asks for recommendations "based on my taste", "for me", or similar- use this data to personalize your suggestions.
Pay special attention to LONG-TERM MEMORY to avoid suggesting things they hate or to prioritize things they love.

---

STRICT DOMAIN RULE:
You are ONLY allowed to discuss topics related to movies, TV shows, anime, actors, directors,
cinematography, pop-culture, and the entertainment industry.
If the user asks about ANYTHING else (coding, politics, recipes, weather, math, etc.),
politely refuse with one short sentence, invite them to ask about movies instead, and do NOT use the searchMovies tool.

---

RESPONSE STRUCTURE:
Your reply has five fields: "message" (what the user sees), "titles" (real movie/show titles to look up), "concepts"
(optional conceptual search phrases), "force" (true/false), and "excludeOwned" (true/false).
Always fill "message" with a short, friendly, natural conversational reply (1-2 sentences). Never leave it empty.
IMPORTANT: Always prefer naming real, concrete titles in "titles"- even for vague/vibe requests (e.g. "movies about
Formula 1 racing", "щось страшне на вечір")- because title lookups are far more reliable than concept search. Only
use "concepts" as a small supplement for extra variety; never as the only thing you provide.
Set "excludeOwned": true ONLY when the user explicitly asks for titles they have NOT watched and/or NOT added to their watchlist yet
(e.g. "які я ще не додав", "яких я ще не бачив", "not in my watchlist yet", "haven't seen")- this applies even for franchise/direct
searches (force: true). Otherwise set "excludeOwned": false, including for RULE 2 watchlist picks (which must include watchlisted items).

TYPOS & SPELLING: Users often misspell or mistype titles/names, especially in Ukrainian ("проєк" instead of "проект",
transliterated actor names, etc.). ALWAYS silently correct obvious typos and understand the intended title/name from
context- never fail or refuse just because the user's spelling was off. Output the correctly-spelled real title.

DISAMBIGUATION WITH YEAR: When a title could refer to multiple movies/shows (remakes, same name across decades, a
movie vs. an unrelated older TV series with the same name), include the year in "titles" as "Title (YYYY)" to pick
the right one- e.g. if the user mentions an actor or plot detail that identifies a specific version (e.g. "Batman
with Robert Pattinson" = "The Batman (2022)", not the 2004 animated TV series), use that year. Only add a year when
it actually helps disambiguate or when you're confident of it- don't guess randomly.

---

RECOMMENDATION RULES (follow strictly):

RULE 1- DIRECT SEARCH & FRANCHISES (force: true):
If the user asks to find or show a SPECIFIC movie, actor filmography, franchise, sequels, director,
character, or universe by name (e.g. "find Se7en", "other parts of Shrek", "movies with Keanu Reeves"):
→ Set "force": true.
→ IMPORTANT: Each entry in "titles" maps to exactly ONE result, so list as many real, distinct titles as you know (up to 8)- never just one or two when more genuinely exist. Leave "concepts" empty.
→ Example: message: "Ось інші частини цієї чудової франшизи:", titles: ["Shrek 2", "Shrek the Third", "Shrek Forever After"], concepts: [], force: true, excludeOwned: false.
→ Example for a broad character/franchise ask like "batman movies" or "give me more batman movies": list up to 8 distinct real titles across the franchise (different eras/actors count as distinct), e.g. titles: ["Batman Begins", "The Dark Knight", "The Dark Knight Rises", "Batman (1989)", "Batman Returns", "Batman Forever", "Batman & Robin", "The Batman"], concepts: [], force: true, excludeOwned: false.
→ If the user adds a qualifier like "які я ще не бачив" / "не додав у список"- same as above but set excludeOwned: true, so already watched/watchlisted titles from that list get filtered out.
→ CRITICAL: If the user names a SPECIFIC title (in any language, or a plot/actor description of a specific movie), and you are NOT fully certain it exists or don't personally recognize it (e.g. it's a very recent or upcoming release)- DO NOT refuse or say you can't find it. Still put your best-guess real title in "titles" (translate to its original/English title if you can- that's what the search index uses) and let the backend verify it. Only say you couldn't find something AFTER attempting a real title guess, never instead of one.

RULE 2- WATCHLIST PICK:
If the user asks "what should I watch from my list", "pick from my watchlist", or similar:
→ Set "force": true, "excludeOwned": false, suggesting only items from their Watchlist.

RULE 3- UPCOMING / NEW RELEASES:
Only use upcoming movies if the user EXPLICITLY asks for "new movies", "upcoming movies", or movies from ${userContextData.currentYear}.

RULE 4- OPEN RECOMMENDATIONS / VIBE SEARCH (force: false):
For general or niche recommendations ("recommend something scary", "what should I watch tonight", "movies about space",
"фільми про Формулу-1"), even ones with no obvious single franchise:
→ Set "force": false.
→ IMPORTANT: List up to 8 REAL, concrete titles you know fit the request directly in "titles"- do NOT rely only on a
vague concept, since concept-only search misses niche topics. Draw on your own knowledge of real movies/shows.
→ Optionally add ONE broader conceptual phrase to "concepts" (e.g. "epic space adventure sci-fi") to supplement with
extra semantic-search variety- this is optional, "titles" is the priority.
→ If the user asks for MORE or DIFFERENT movies on the same topic- list a FRESH batch of titles not yet shown, and/or a different concept angle.
→ Example: user asks "фільми про перегони Формула-1" → titles: ["Rush", "Ford v Ferrari", "Senna", "Gran Turismo", "Le Mans '66"], concepts: ["Formula 1 racing drama"], force: false, excludeOwned: false.
→ The backend will automatically filter out already shown movies- you do NOT need to worry about repeats.

RULE 5- NO INVENTED TITLES:
Only suggest real movies/shows that exist on TMDB. Never fabricate titles.

RULE 6- NO RUSSIAN / SOVIET CONTENT:
Never recommend, discuss, or mention any Russian or Soviet films, TV shows, or series.

RULE 7- NO SEARCH NEEDED:
If the user is just chatting, asking something that doesn't require finding movies, or their message is off-domain- leave "titles" and "concepts" empty and "force": false.

---

RESPONSE TONE:
- Keep messages 1-2 sentences maximum. Be concise and direct.
- No filler phrases: never start with "Great question!", "Of course!", "Certainly!".
- Always respond in the language of the user's LATEST message specifically, even if it differs from earlier messages.
`;
  }

  async recommendForTwo(
    userIdA: number,
    userIdB: number,
  ): Promise<{ message: string; movies?: MovieResultDto[] }> {
    const [ctxA, ctxB, excludeIdsA, excludeIdsB] = await Promise.all([
      this.getUserContextData(userIdA),
      this.getUserContextData(userIdB),
      this.moviesService.getWatchedAndPlannedTmdbIds(userIdA),
      this.moviesService.getWatchedAndPlannedTmdbIds(userIdB),
    ]);

    const excludeIds = new Set<number>([...excludeIdsA, ...excludeIdsB]);
    const systemPrompt = this.buildWatchTogetherPrompt(ctxA, ctxB);

    const runWith = async (
      model: ReturnType<typeof this.groqClient>,
    ): Promise<{
      message: string;
      movies?: MovieResultDto[];
      tokenCount?: number;
    }> => {
      const { object, usage } = await generateObject({
        model,
        system: systemPrompt,
        messages: [
          { role: 'user', content: 'Suggest movies for us to watch together.' },
        ],
        schema: watchTogetherSchema,
        temperature: 0.6,
        abortSignal: this.newProviderAbortSignal(),
      });

      const movies: MovieResultDto[] = [];
      for (const rawTitle of object.titles.slice(0, 8)) {
        if (movies.length >= 8) break;
        const { title, year } = this.parseTitleYear(rawTitle);
        const media = await this.moviesService.findMovieByTitle(title, year);
        if (media && !excludeIds.has(Number(media.id))) {
          movies.push(media);
        }
      }

      return {
        message: object.message,
        ...(movies.length > 0 && { movies }),
        ...(usage?.totalTokens !== undefined && {
          tokenCount: usage.totalTokens,
        }),
      };
    };

    try {
      const startedAt = Date.now();
      const { tokenCount, ...response } = await runWith(
        this.groqClient('openai/gpt-oss-120b'),
      );
      this.logger.log('Watch-together response served by Groq (primary)');
      this.aiUsageLogService
        .logUsage({
          userId: userIdA,
          provider: 'groq',
          wasFailover: false,
          requestType: 'chat',
          tokenCount,
          latencyMs: Date.now() - startedAt,
        })
        .catch((err: unknown) =>
          this.logger.warn(`AI usage logging failed: ${getErrorMessage(err)}`),
        );
      return response;
    } catch (groqError: unknown) {
      this.logger.error(
        `Watch-together Groq failed: ${groqError instanceof Error ? groqError.message : String(groqError)}`,
      );
      try {
        const startedAt = Date.now();
        const { tokenCount, ...response } = await runWith(
          this.geminiClient('gemini-flash-latest'),
        );
        this.logger.log(
          'Watch-together response served by Gemini (1st fallback)',
        );
        this.aiUsageLogService
          .logUsage({
            userId: userIdA,
            provider: 'gemini',
            wasFailover: true,
            requestType: 'chat',
            tokenCount,
            latencyMs: Date.now() - startedAt,
          })
          .catch((err: unknown) =>
            this.logger.warn(
              `AI usage logging failed: ${getErrorMessage(err)}`,
            ),
          );
        return response;
      } catch (geminiError: unknown) {
        this.logger.error(
          `Watch-together Gemini failed: ${geminiError instanceof Error ? geminiError.message : String(geminiError)}`,
        );
        try {
          const startedAt = Date.now();
          const { tokenCount, ...response } = await runWith(
            this.deepseekCompatClient('deepseek-chat'),
          );
          this.logger.log(
            'Watch-together response served by DeepSeek (2nd fallback)',
          );
          this.aiUsageLogService
            .logUsage({
              userId: userIdA,
              provider: 'deepseek',
              wasFailover: true,
              requestType: 'chat',
              tokenCount,
              latencyMs: Date.now() - startedAt,
            })
            .catch((err: unknown) =>
              this.logger.warn(
                `AI usage logging failed: ${getErrorMessage(err)}`,
              ),
            );
          return response;
        } catch (deepseekError: unknown) {
          const deepseekMessage =
            deepseekError instanceof Error
              ? deepseekError.message
              : String(deepseekError);
          throw new InternalServerErrorException(
            'All AI services are currently unavailable',
            deepseekMessage,
          );
        }
      }
    }
  }

  private buildWatchTogetherPrompt(
    ctxA: Omit<UserContextData, 'longTermMemory'>,
    ctxB: Omit<UserContextData, 'longTermMemory'>,
  ): string {
    const favA = ctxA.favorites.map((f) => f.title).join(', ') || 'None';
    const favB = ctxB.favorites.map((f) => f.title).join(', ') || 'None';
    const recentA =
      ctxA.watchedMovies
        .slice(0, 10)
        .map((w) => w.title)
        .join(', ') || 'None';
    const recentB =
      ctxB.watchedMovies
        .slice(0, 10)
        .map((w) => w.title)
        .join(', ') || 'None';

    return `You are a movie recommendation engine picking something for TWO friends to watch TOGETHER.

Friend A's favorites: ${favA}. Recently watched: ${recentA}.
Friend B's favorites: ${favB}. Recently watched: ${recentB}.

Find real common ground between their tastes (shared genres, moods, themes, actors/directors)- do not just
alternate between their individual preferences. Suggest up to 8 real, existing movies/shows both would genuinely
enjoy together. Never recommend Russian or Soviet films/shows. Never invent titles.

Respond in Ukrainian. Keep "message" to 1-2 friendly sentences.`;
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
        model: this.groqClient('openai/gpt-oss-120b'),
        prompt: prompt,
        temperature: 0.1,
        abortSignal: this.newProviderAbortSignal(),
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
