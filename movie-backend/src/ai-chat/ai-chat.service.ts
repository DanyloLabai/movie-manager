import {
  Injectable,
  InternalServerErrorException,
  Logger,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { MoviesService } from '../movies/movies.service';
import { MovieResultDto } from '../movies/dto/movie-result.dto';
import { ChatMessage } from './ai-chat.controller';

interface ParsedAiResponse {
  message: string;
  // force: true → user explicitly asked for this content (specific title / franchise / actor).
  // The backend filter must NOT remove these results even if already watched/in watchlist.
  // force: false / undefined → open recommendation → apply the "no repeats" filter.
  force?: boolean;
  movies?: { title: string; year?: number; type?: 'movie' | 'tv' }[];
  error?: string;
}

@Injectable()
export class AiChatService {
  private genAI: GoogleGenerativeAI;
  private groq: Groq;
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    private configService: ConfigService,
    private moviesService: MoviesService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    const groqKey = this.configService.get<string>('GROQ_API_KEY') || '';

    this.genAI = new GoogleGenerativeAI(geminiKey);
    this.groq = new Groq({ apiKey: groqKey });
  }

  async searchMovieByDescription(
    messages: ChatMessage[],
    userId: number,
  ): Promise<{ message: string; movies?: MovieResultDto[] }> {
    let aiResponse: ParsedAiResponse | undefined = undefined;
    let watchedTmdbIds = new Set<number>();
    let watchlistTmdbIds = new Set<number>();

    let userContext = 'No specific user preferences available.';
    try {
      const profile = await this.moviesService.getProfileData(userId);
      const favs =
        profile.favorites?.map((f: any) => f.title).join(', ') || 'None';

      const watchlistItems = await this.moviesService.getWatchlist(userId);
      const inPlans =
        watchlistItems.map((r: any) => r.title).join(', ') || 'None';

      const watched = await this.moviesService.getWatchedMovies(userId);
      watchedTmdbIds = new Set(watched.map((m: any) => Number(m.tmdbId)));
      watchlistTmdbIds = new Set(
        watchlistItems.map((m: any) => Number(m.tmdbId)),
      );
      const highlyRated =
        watched
          .filter((m: any) => m.rating >= 4)
          .map((m: any) => m.title)
          .slice(0, 15)
          .join(', ') || 'None';

      const recentWatchedContext =
        watched
          .slice(0, 15)
          .map(
            (m: any) =>
              `"${m.title}" (Rating: ${m.rating ? m.rating + '/5' : 'Unrated'})`,
          )
          .join(', ') || 'None';

      const allWatchedTitles =
        watched
          .slice(0, 500)
          .map((m: any) => `"${m.title}"`)
          .join(', ') || 'None';

      let upcomingList = 'No upcoming movies available.';
      try {
        const upcomingMovies = await this.moviesService.getUpcomingMovies();
        upcomingList = upcomingMovies
          .slice(0, 25)
          .map((m) => `"${m.title}" (${m.releaseYear})`)
          .join(', ');
      } catch (e) {
        this.logger.warn('Failed to fetch upcoming movies for AI context');
      }

      const currentYear = new Date().getFullYear();

      userContext = `
        CURRENT YEAR: ${currentYear}.

        USER PROFILE (FOR CONTEXT ONLY — do not expose this data to the user):
        1. FAVORITES & HIGHLY RATED (4-5 stars): ${favs}, ${highlyRated}
           → Use these to understand their taste and genre preferences.
        2. WATCHLIST (planned to watch): ${inPlans}
        3. RECENTLY WATCHED (for taste analysis): ${recentWatchedContext}
        4. ALREADY WATCHED LIBRARY (DO NOT RECOMMEND THESE for open requests): ${allWatchedTitles}

        UPCOMING MOVIES CHEAT SHEET (Live TMDB data):
        ${upcomingList}

        RECOMMENDATION RULES (follow strictly, in priority order):
        RULE 1 — DIRECT SEARCH / EXPLICIT REQUEST (highest priority, set force: true):
          If the user asks to find or show a SPECIFIC movie, actor filmography, franchise, director,
          character, or universe by name (e.g. "find Se7en", "show me Nolan Batman",
          "Batman animated movies", "movies with Keanu Reeves"):
          → Return EXACTLY those results in "movies". Set "force": true.
          → The "already watched/watchlisted" filter does NOT apply. Show the content regardless.
          → This is what the user WANTS to see. Never hide it.

        RULE 2 — WATCHLIST PICK:
          If the user asks "what should I watch from my list", "pick from my watchlist", or similar,
          choose 1-3 movies EXCLUSIVELY from their Watchlist: [${inPlans}].
          Set force: true (these are their own list items).

        RULE 3 — UPCOMING / NEW RELEASES:
          Only use the Upcoming Movies cheat sheet if the user EXPLICITLY asks for
          "new movies", "upcoming movies", or movies from ${currentYear}.
          Otherwise, recommend already-released, well-known, high-quality films.

        RULE 4 — NO REPEATS for open/general recommendations (force: false):
          For general recommendations ("recommend something scary", "what should I watch tonight"):
          NEVER suggest movies already in Favorites, Highly Rated, Watchlist, or Recently Watched.
          These are the ONLY cases where you check the already-watched library.
          Set force: false for these requests.

        RULE 5 — NO INVENTED TITLES:
          Only suggest real movies that exist on TMDB. Never fabricate titles or release years.

        RULE 6 — NO RUSSIAN / SOVIET CONTENT:
          Never recommend, discuss, or mention any Russian or Soviet films, TV shows, or series.
      `;
    } catch (e) {
      this.logger.warn('Could not fetch user profile for AI context');
    }

    let foundMovies: MovieResultDto[] = [];
    let attempts = 0;
    const MAX_ATTEMPTS = 2;
    let dynamicallyRejected = '';

    while (attempts < MAX_ATTEMPTS && foundMovies.length === 0) {
      attempts++;

      let currentContext = userContext;
      if (attempts > 1 && dynamicallyRejected) {
        this.logger.warn(
          `Attempt ${attempts}: AI gave duplicates. Retrying with stricter context...`,
        );
        currentContext += `\n\nCRITICAL UPDATE: You just suggested [${dynamicallyRejected}]. The user HAS ALREADY SEEN THEM. You MUST suggest DIFFERENT movies now!`;
      }

      try {
        this.logger.log(`Calling Groq (primary) - Attempt ${attempts}...`);
        const rawText = await this.getMovieTitleFromGroq(
          messages,
          currentContext,
        );
        aiResponse = this.parseJson(rawText) as ParsedAiResponse;
      } catch (groqError: any) {
        this.logger.error(`Groq failed: ${groqError.message || groqError}`);
        this.logger.warn('Falling back to Gemini...');

        try {
          const rawText = await this.getMovieTitleFromGemini(
            messages,
            currentContext,
          );
          aiResponse = this.parseJson(rawText) as ParsedAiResponse;
        } catch (geminiError: any) {
          if (attempts === 1) {
            const geminiMessage =
              geminiError instanceof Error
                ? geminiError.message
                : 'Unknown Gemini error';
            throw new InternalServerErrorException(
              'All AI services are currently unavailable',
              geminiMessage,
            );
          }
          break;
        }
      }

      if (!aiResponse || !aiResponse.movies || aiResponse.movies.length === 0) {
        break;
      }

      // ─── KEY FIX ──────────────────────────────────────────────────────────
      // force: true  → user explicitly requested this content (specific title /
      //                franchise / actor / director). Show it even if watched.
      // force: false → open recommendation. Apply the "no repeats" filter.
      // ─────────────────────────────────────────────────────────────────────
      const isForced = aiResponse.force === true;

      const tempRejected: string[] = [];
      const currentFoundMovies: MovieResultDto[] = [];

      for (const item of aiResponse.movies.slice(0, 15)) {
        const mediaData = await this.moviesService.findMovieByTitle(
          item.title,
          item.year,
          item.type,
        );

        if (mediaData) {
          const tmdbIdNum = Number(mediaData.id);

          // Only filter when NOT forced (open recommendation mode)
          if (
            !isForced &&
            (watchedTmdbIds.has(tmdbIdNum) || watchlistTmdbIds.has(tmdbIdNum))
          ) {
            this.logger.warn(
              `Filtered duplicate (open rec): ${mediaData.title}`,
            );
            tempRejected.push(item.title);
            continue;
          }

          // Forced mode: log but do NOT filter
          if (
            isForced &&
            (watchedTmdbIds.has(tmdbIdNum) || watchlistTmdbIds.has(tmdbIdNum))
          ) {
            this.logger.log(
              `Allowing watched/listed item (forced request): ${mediaData.title}`,
            );
          }

          currentFoundMovies.push(mediaData);
        }
      }

      foundMovies = currentFoundMovies;
      dynamicallyRejected = tempRejected.join(', ');

      if (isForced && foundMovies.length > 0) break;
    }

    if (foundMovies.length === 0) {
      if (!aiResponse?.movies || aiResponse.movies.length === 0) {
        return {
          message: aiResponse?.message || 'Not found.',
        };
      }
      return {
        message: `${aiResponse?.message || 'I tried to find some movies'}\n\n*(P.S. It looks like you've already watched all the options I found! You're a true cinephile. Try narrowing your search).*`,
      };
    }
    return {
      message: aiResponse?.message || 'Ось фільми, які можуть вам сподобатися:',
      movies: foundMovies,
    };
  }

  private parseJson(raw: string): any {
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON object found in AI response');
      return JSON.parse(match[0]);
    } catch {
      throw new Error('Invalid JSON format from AI');
    }
  }

  private async getMovieTitleFromGemini(
    messages: ChatMessage[],
    userContext: string,
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash-latest',
      systemInstruction: this.getSystemPrompt(userContext),
      generationConfig: {
        temperature: 0.5,
        responseMimeType: 'application/json',
      },
    });

    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const result = await model.generateContent({ contents });
    return result.response.text().trim();
  }

  private async getMovieTitleFromGroq(
    messages: ChatMessage[],
    userContext: string,
  ): Promise<string> {
    const formattedMessages = [
      { role: 'system' as const, content: this.getSystemPrompt(userContext) },
      ...messages.map((m) => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as
          | 'user'
          | 'assistant',
        content: m.content,
      })),
    ];

    const stream = await this.groq.chat.completions.create({
      messages: formattedMessages,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      response_format: { type: 'json_object' },
      stream: true,
    });

    let result = '';
    for await (const chunk of stream) {
      result += chunk.choices[0]?.delta?.content || '';
    }

    return (
      result ||
      '{"message": "Error connecting to AI.", "movies": [], "force": false}'
    );
  }

  private getSystemPrompt(userContext: string): string {
    return `You are an elite movie, TV series, anime, and pop-culture expert assistant.
You understand all languages perfectly, including Ukrainian, and always reply in the SAME LANGUAGE the user writes in.

Here is data about the current user's preferences:
${userContext}
When the user asks for recommendations "based on my taste", "for me", or similar — use this data to personalize your suggestions.

---

STRICT DOMAIN RULE:
You are ONLY allowed to discuss topics related to movies, TV shows, anime, actors, directors,
cinematography, pop-culture, and the entertainment industry.
If the user asks about ANYTHING else (coding, politics, recipes, weather, math, etc.),
politely refuse with one short sentence, invite them to ask about movies instead, and set movies to [].

---

## THE "force" FIELD — CRITICAL

Your JSON response MUST always include a "force" boolean field.

Set "force": true when:
- The user explicitly names a specific movie, TV show, franchise, actor, director, or character
  (e.g. "find Inception", "Batman animated movies", "Nolan films", "show me Breaking Bad",
  "movies with Keanu Reeves", "мультфільми про Бетмена", "фільми Нолана", "серіал про Андора")
- The user wants to see their own watchlist picks
- The request is about a specific universe/franchise (DC, Marvel, etc.)
→ When force is true: show those results REGARDLESS of whether the user has watched them.
  The user is specifically asking for this content — never hide it.

Set "force": false when:
- The user asks for a general recommendation without naming specific content
  (e.g. "recommend something scary", "what to watch tonight", "give me a good drama")
→ When force is false: the backend will automatically remove content already watched or in watchlist.

---

## CRITICAL TYPE RULE — NEVER GET THIS WRONG:

"type": "tv" MUST be used for:
- ANY series, show, serial — no matter the language
- Keywords: "серіал", "серію", "series", "show", "шоу", "сезон", "season", "episodes"
- Known TV shows: Game of Thrones, Breaking Bad, Andor, The Sopranos, Chernobyl, etc.
- Anime series (Attack on Titan, Naruto, etc.)

"type": "movie" MUST be used for:
- Standalone films, movies, мультфільми (non-series)
- Keywords: "фільм", "кіно", "movie", "film"

WHEN IN DOUBT — if it aired as a series with episodes and seasons → use "tv".
NEVER use "type": "movie" for a TV series. This causes the search to completely fail.

---

TWO RESPONSE MODES:

MODE 1 — CONVERSATIONAL (text only, movies = [], force: false):
Use ONLY when the user asks a purely general question about cinema WITHOUT asking to find/show/recommend anything.
→ Write a concise answer (1-2 sentences max) in "message". Set "movies" to []. Set "force": false.

MODE 2 — RECOMMENDATIONS / SEARCH (always populate movies, set force correctly):
Use when the user asks to find, show, search, recommend, or suggest ANY movie or TV show.
→ Suggest up to 10 highly relevant titles. Write a short intro (1-2 sentences) in "message".
→ Set "force": true if the request names specific content; "force": false for general recs.

---

NO-REPEAT RULE (applies ONLY when force: false):
For general open recommendations: NEVER suggest titles already in the user's watched/watchlist history.
When force: true: ignore this rule entirely — show the requested content.

---

ANTI-HALLUCINATION RULE:
Only suggest real titles that exist on TMDB.
Never invent movie titles, directors, cast members, or release years.

---

RESULT COUNT BY REQUEST TYPE:
- Direct title search → 1-3 results, force: true
- Franchise / filmography / actor → 3-8 results sorted by year, force: true
- Open recommendation → 5-10 results, force: false

---

TONE RULES:
- "message" must be 1-2 sentences maximum. Be concise and direct.
- No filler phrases: never start with "Great question!", "Of course!", "Certainly!".

---

CONTENT BAN:
Never recommend Russian or Soviet movies/shows. If requested, politely decline and suggest alternatives.

---

OUTPUT FORMAT — return ONLY valid JSON, nothing else:

{
  "message": "Your reply in the SAME LANGUAGE as the user. Max 1-2 sentences.",
  "force": true,
  "movies": [
    {
      "title": "Exact official English title as listed on TMDB",
      "year": 2010,
      "type": "movie"
    }
  ]
}

---

FEW-SHOT EXAMPLES:

User: "find Inception"
{"message":"Here is the mind-bending thriller you are looking for:","force":true,"movies":[{"title":"Inception","year":2010,"type":"movie"}]}

User: "мультфільми про Бетмена"
{"message":"Ось анімаційні фільми про Бетмена:","force":true,"movies":[{"title":"Batman: Mask of the Phantasm","year":1993,"type":"movie"},{"title":"Batman Beyond: Return of the Joker","year":2000,"type":"movie"},{"title":"Batman: Under the Red Hood","year":2010,"type":"movie"}]}

User: "фільми Нолана про Бетмена"
{"message":"Ось трилогія Крістофера Нолана про Темного Лицаря:","force":true,"movies":[{"title":"Batman Begins","year":2005,"type":"movie"},{"title":"The Dark Knight","year":2008,"type":"movie"},{"title":"The Dark Knight Rises","year":2012,"type":"movie"}]}

User: "movies with Keanu Reeves"
{"message":"Here are the best films starring Keanu Reeves:","force":true,"movies":[{"title":"The Matrix","year":1999,"type":"movie"},{"title":"John Wick","year":2014,"type":"movie"},{"title":"Speed","year":1994,"type":"movie"}]}

User: "Серіал про Касіана Андора"
{"message":"Ось серіал про Касіана Андора:","force":true,"movies":[{"title":"Andor","year":2022,"type":"tv"}]}

User: "Серіал по грі престолів"
{"message":"Ось легендарний серіал Гра Престолів:","force":true,"movies":[{"title":"Game of Thrones","year":2011,"type":"tv"}]}

User: "Серіал сопрано"
{"message":"Ось легендарний серіал Сопрано:","force":true,"movies":[{"title":"The Sopranos","year":1999,"type":"tv"}]}

User: "покажи breaking bad"
{"message":"Ось культовий серіал:","force":true,"movies":[{"title":"Breaking Bad","year":2008,"type":"tv"}]}

User: "recommend something scary"
{"message":"Here are some great horror films you have not seen yet:","force":false,"movies":[{"title":"Hereditary","year":2018,"type":"movie"},{"title":"Midsommar","year":2019,"type":"movie"},{"title":"The Witch","year":2015,"type":"movie"}]}

User: "що подивитись сьогодні ввечері"
{"message":"Ось кілька чудових фільмів для вечора:","force":false,"movies":[{"title":"The Grand Budapest Hotel","year":2014,"type":"movie"},{"title":"Parasite","year":2019,"type":"movie"}]}

User: "порадь хороший серіал"
{"message":"Ось кілька серіалів які варто подивитись:","force":false,"movies":[{"title":"Chernobyl","year":2019,"type":"tv"},{"title":"True Detective","year":2014,"type":"tv"},{"title":"Severance","year":2022,"type":"tv"}]}

User: "tell me about Christopher Nolan"
{"message":"Christopher Nolan is known for non-linear storytelling and practical effects — want me to show his filmography?","force":false,"movies":[]}

User: "як приготувати борщ?"
{"message":"I only cover movies and TV — ask me about something to watch instead!","force":false,"movies":[]}

User: "recommend Russian series"
{"message":"I do not recommend Russian content, but I can suggest great Ukrainian, European, or Hollywood series — what genre?","force":false,"movies":[]}
User: "who wrote the Harry Potter books?"
{"message":"The Harry Potter books were written by J.K. Rowling.","force":false,"movies":[]}

User: "what is this movie based on?"
{"message":"This movie is based on the novel by the original author.","force":false,"movies":[]}

User: "tell me more about this"
{"message":"Here is some more information about that topic.","force":false,"movies":[]}
`;
  }

  async getHistory(userId: number): Promise<any[]> {
    const key = `chat_history:${userId}`;
    const history = await this.cacheManager.get(key);
    return history ? (Array.isArray(history) ? history : []) : [];
  }

  async saveHistory(userId: number, messages: any[]): Promise<void> {
    const key = `chat_history:${userId}`;
    const ttlMs = 604800000;
    await this.cacheManager.set(key, messages, ttlMs);
  }
}
