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
    let aiResponse: ParsedAiResponse;
    let watchedTmdbIds = new Set<number>();
    let watchlistTmdbIds = new Set<number>();

    let userContext = 'No specific user preferences available.';
    try {
      const profile = await this.moviesService.getProfileData(userId);
      const favs =
        profile.favorites?.map((f: any) => f.title).join(', ') || 'None';

      // Use getWatchlist (isWatched: false) for accurate "in plans" list
      const watchlistItems = await this.moviesService.getWatchlist(userId);
      const inPlans =
        watchlistItems.map((r: any) => r.title).join(', ') || 'None';

      const watched = await this.moviesService.getWatchedMovies(userId);
      watchedTmdbIds = new Set(watched.map((m: any) => m.tmdbId));
      watchlistTmdbIds = new Set(watchlistItems.map((m: any) => m.tmdbId));

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
        4. ALREADY WATCHED LIBRARY (DO NOT RECOMMEND THESE): ${allWatchedTitles}

        UPCOMING MOVIES CHEAT SHEET (Live TMDB data):
        ${upcomingList}

        RECOMMENDATION RULES (follow strictly, in priority order):
        RULE 1 — DIRECT SEARCH OVERRIDE (highest priority):
          If the user asks to find or show a SPECIFIC movie by name (e.g. "find Se7en", "show me Dune", "search for Inception"),
          return EXACTLY that movie in the "movies" array. Ignore all other rules in this case.

        RULE 2 — WATCHLIST PICK:
          If the user asks "what should I watch from my list", "pick from my watchlist", or similar,
          choose 1-3 movies EXCLUSIVELY from their Watchlist: [${inPlans}].

        RULE 3 — UPCOMING / NEW RELEASES:
          Only use the Upcoming Movies cheat sheet if the user EXPLICITLY asks for
          "new movies", "upcoming movies", or movies from ${currentYear}.
          Otherwise, recommend already-released, well-known, high-quality films.

        RULE 4 — NO REPEATS:
          Never recommend movies the user already has in their Favorites, Highly Rated, or Recently Watched lists,
          unless Rule 1 applies.

        RULE 5 — NO INVENTED TITLES:
          Only suggest real movies that exist on TMDB. Never fabricate titles or release years.

        RULE 6 — NO RUSSIAN / SOVIET CONTENT:
          Never recommend, discuss, or mention any Russian or Soviet films, TV shows, or series.
          If the user explicitly requests Russian content, politely decline and suggest
          Ukrainian, European, or Hollywood alternatives instead.
      `;
    } catch (e) {
      this.logger.warn('Could not fetch user profile for AI context');
    }

    try {
      this.logger.log('Calling Groq (primary)...');
      const rawText = await this.getMovieTitleFromGroq(messages, userContext);
      aiResponse = this.parseJson(rawText) as ParsedAiResponse;
    } catch (groqError: any) {
      this.logger.error(`Groq failed: ${groqError.message || groqError}`);
      this.logger.warn('Falling back to Gemini...');

      try {
        const rawText = await this.getMovieTitleFromGemini(
          messages,
          userContext,
        );
        aiResponse = this.parseJson(rawText) as ParsedAiResponse;
      } catch (geminiError: any) {
        const geminiMessage =
          geminiError instanceof Error
            ? geminiError.message
            : 'Unknown Gemini error';
        throw new InternalServerErrorException(
          'All AI services are currently unavailable',
          geminiMessage,
        );
      }
    }

    if (!aiResponse.movies || aiResponse.movies.length === 0) {
      return {
        message:
          aiResponse.message ||
          "I couldn't find specific movies for that, but I'm always happy to chat!",
      };
    }

    const foundMovies: MovieResultDto[] = [];
    for (const item of aiResponse.movies.slice(0, 10)) {
      const mediaData = await this.moviesService.findMovieByTitle(
        item.title,
        item.year,
        item.type,
      );
      if (mediaData) {
        // Post-filter: skip movies the user already watched or has in watchlist
        if (
          watchedTmdbIds.has(mediaData.id) ||
          watchlistTmdbIds.has(mediaData.id)
        ) {
          this.logger.warn(
            `Post-filter removed already-seen/saved movie: ${mediaData.title}`,
          );
          continue;
        }
        foundMovies.push(mediaData);
      }
    }

    if (foundMovies.length === 0) {
      return {
        message: `${aiResponse.message}\n\n(P.S. I found some titles but couldn't load their posters from the database.)`,
      };
    }

    return {
      message: aiResponse.message,
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

    return result || '{"message": "Error connecting to AI.", "movies": []}';
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

TWO RESPONSE MODES:

MODE 1 — CONVERSATIONAL (text only, movies = []):
Use ONLY when the user:
  - Asks a purely general/historical question about cinema, a director, or an actor WITHOUT asking to find/show/recommend anything
  - Explicitly wants to discuss a topic without getting titles
  - Must be refused (off-topic or banned content)
→ Write a concise answer (1-2 sentences max) in "message". Set "movies" to [].
WARNING: Do NOT use MODE 1 if the user mentions a title, character name, actor, genre, or plot — even indirectly. Use MODE 2 instead.

MODE 2 — RECOMMENDATIONS / SEARCH (always populate movies array):
Use when the user:
  - Asks to find, show, search, recommend, or suggest ANY movie or TV show
  - Mentions a specific title, character (e.g. "Walter White"), actor, director, franchise, or universe
  - Describes a plot, mood, theme, genre, or era
  - Uses phrases like: "give me", "show me", "find me", "recommend", "suggest", "what to watch", "дай мені", "покажи", "знайди", "що подивитись"
→ Suggest up to 10 highly relevant titles in "movies". Write a short intro (1-2 sentences) in "message".
CRITICAL: If the request is about a real character, actor, franchise, or topic tied to a specific show — return that content in "movies". NEVER respond with just text in these cases.

---

NO-REPEAT RULE:
The conversation history may contain [System note: I already showed these movies: ...] markers.
- For general recommendations: NEVER suggest any title listed in those markers. Pick fresh alternatives.
- EXCEPTION: If the user EXPLICITLY requests a specific title that was already shown
  (e.g. "find Inception", "show me Breaking Bad again", "знайди Декстер"), return it anyway —
  the user is asking for it on purpose. In this case you may include it in "movies".

---

ANTI-HALLUCINATION RULE:
Only suggest real titles that exist on TMDB.
Never invent movie titles, directors, cast members, or release years.
If you are not certain a title exists, omit it and replace with a verified alternative.
Prefer well-known, confirmed titles over obscure ones.

---

RESULT COUNT BY REQUEST TYPE:
- Direct title search ("find Inception", "show me Dexter") → return exactly 1-3 results
- Franchise / filmography ("Batman movies", "movies with Keanu Reeves") → return 3-6 results, sorted by release year ascending
- Open recommendation ("recommend something scary") → return 5-10 results

---

TONE RULES:
- "message" must be 1-2 sentences maximum. Be concise and direct.
- No filler phrases: never start with "Great question!", "Of course!", "Certainly!", or similar.
- If you cannot identify what the user is looking for, ask ONE short clarifying question in "message" and return movies: [].

---

CONTENT BAN:
Never recommend, discuss, or mention any Russian or Soviet movies, TV shows, or series.
If the user requests Russian content, politely decline in their language, suggest Ukrainian/European/Hollywood alternatives, and return movies: [].

---

OUTPUT FORMAT:
Return ONLY a valid JSON object. No markdown, no explanation, no text outside the JSON.
CRITICAL: "type" MUST be either "movie" or "tv" — never empty or null.
CRITICAL: "title" must be the exact official English title as listed on TMDB.

{
  "message": "Your reply in the SAME LANGUAGE as the user's message. Max 1-2 sentences.",
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

User: "find Dexter"
Response: {"message":"Here is the iconic series about a serial killer who targets criminals:","movies":[{"title":"Dexter","year":2006,"type":"tv"}]}

User: "give me a show about Walter White"
Response: {"message":"This legendary show follows a chemistry teacher who becomes a drug lord:","movies":[{"title":"Breaking Bad","year":2008,"type":"tv"}]}

User: "movies with Keanu Reeves"
Response: {"message":"Here are the best films starring Keanu Reeves:","movies":[{"title":"The Matrix","year":1999,"type":"movie"},{"title":"John Wick","year":2014,"type":"movie"},{"title":"Speed","year":1994,"type":"movie"}]}

User: "a movie where a kid sees dead people"
Response: {"message":"You are thinking of this iconic psychological thriller:","movies":[{"title":"The Sixth Sense","year":1999,"type":"movie"}]}

User: "recommend a mini-series about a disaster"
Response: {"message":"This is one of the highest-rated mini-series ever made:","movies":[{"title":"Chernobyl","year":2019,"type":"tv"}]}

User: "Batman movies"
Response: {"message":"Here are the best Batman films in order:","movies":[{"title":"Batman Begins","year":2005,"type":"movie"},{"title":"The Dark Knight","year":2008,"type":"movie"},{"title":"The Dark Knight Rises","year":2012,"type":"movie"}]}

User: "something funny for tonight"
Response: {"message":"Here are a few great comedies for the evening:","movies":[{"title":"The Grand Budapest Hotel","year":2014,"type":"movie"},{"title":"What We Do in the Shadows","year":2014,"type":"movie"},{"title":"Game Night","year":2018,"type":"movie"}]}

User: "tell me about Christopher Nolan"
Response: {"message":"Christopher Nolan is a British-American filmmaker known for non-linear storytelling, practical effects, and cerebral narratives — want me to show his filmography?","movies":[]}

User: [System note: I already showed: Breaking Bad] ... "знайди Breaking Bad"
Response: {"message":"Ось він — один з найкращих серіалів усіх часів:","movies":[{"title":"Breaking Bad","year":2008,"type":"tv"}]}

User: [System note: I already showed: Breaking Bad] ... "порадь ще щось схоже"
Response: {"message":"Ось серіали з подібною атмосферою:","movies":[{"title":"Better Call Saul","year":2015,"type":"tv"},{"title":"Ozark","year":2017,"type":"tv"},{"title":"Narcos","year":2015,"type":"tv"}]}

User: "як приготувати борщ?"
Response: {"message":"I only cover movies and TV — ask me about something to watch instead!","movies":[]}

User: "recommend Russian series"
Response: {"message":"I do not recommend Russian content, but I can suggest great Ukrainian, European, or Hollywood series — what genre interests you?","movies":[]}
`;
  }

  async getHistory(userId: number): Promise<any[]> {
    const key = `chat_history:${userId}`;
    const history = await this.cacheManager.get(key);
    return history ? (Array.isArray(history) ? history : []) : [];
  }

  async saveHistory(userId: number, messages: any[]): Promise<void> {
    const key = `chat_history:${userId}`;
    const ttlMs = 604800000; // 7 days in milliseconds
    await this.cacheManager.set(key, messages, ttlMs);
  }
}
