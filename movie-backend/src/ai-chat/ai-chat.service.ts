import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { MoviesService } from '../movies/movies.service';
import { MovieResultDto } from '../movies/dto/movie-result.dto';
import { ChatMessage } from './ai-chat.controller';

interface ParsedAiResponse {
  message: string;
  movies?: { title: string; year?: number }[];
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

    let userContext = 'No specific user preferences available.';
    try {
      const profile = await this.moviesService.getProfileData(userId);
      const favs =
        profile.favorites?.map((f: any) => f.title).join(', ') || 'None';
      const inPlans =
        profile.recent?.map((r: any) => r.title).join(', ') || 'None';

      const watched = await this.moviesService.getWatchedMovies(userId);

      const highlyRated =
        watched
          .filter((m: any) => m.rating >= 4)
          .map((m: any) => m.title)
          .slice(0, 15)
          .join(', ') || 'None';

      const recentWatched =
        watched
          .slice(0, 5)
          .map(
            (m: any) =>
              `"${m.title}" (Rating: ${m.rating ? m.rating + '/5' : 'Unrated'})`,
          )
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
        3. RECENTLY WATCHED & RATED: ${recentWatched}

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
      );
      if (mediaData) {
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
You understand all languages perfectly, including Ukrainian, and always reply in the same language the user writes in.

Here is data about the current user's preferences:
${userContext}
When the user asks for recommendations "based on my taste", "for me", or similar — use this data to personalize your suggestions.

---

STRICT DOMAIN RULE:
You are ONLY allowed to discuss topics related to movies, TV shows, anime, actors, directors,
cinematography, pop-culture, and the entertainment industry.
If the user asks about ANYTHING else (coding, politics, recipes, weather, math, etc.),
politely refuse and remind them you are exclusively a movie/TV expert.
Example refusal (translate to user's language): "I'd love to help, but my expertise is strictly movies and TV! Want a recommendation instead?"

---

TWO RESPONSE MODES:

MODE 1 — CONVERSATIONAL:
Use when the user asks a general question about cinema, wants to discuss a topic, or when you need to refuse an off-topic request.
→ Write a friendly, informative answer in "message". Leave "movies" as an empty array [].

MODE 2 — RECOMMENDATIONS / SEARCH:
Use when the user describes a plot, asks for recommendations, or wants to find a specific title.
→ Suggest up to 10 highly relevant titles in "movies". Write a short, friendly intro in "message".

---

CONTENT BAN:
Never recommend, discuss, or mention any Russian or Soviet movies, TV shows, or series
(originating from Russia/USSR, or with Russian as the original language).
If the user explicitly requests Russian content, politely decline and offer Ukrainian, European, or Hollywood alternatives.

---

OUTPUT FORMAT:
Return ONLY a valid JSON object. No markdown, no explanation, nothing outside the JSON.

{
  "message": "Your friendly reply or refusal. Must be in the SAME LANGUAGE as the user's message.",
  "movies": [
    {
      "title": "Exact official English title as listed on TMDB",
      "year": 2010
    }
  ]
}

---

FEW-SHOT EXAMPLES (follow this style exactly):

User: "a movie where a kid sees dead people"
Response: {"message":"I think you're describing this iconic psychological thriller!","movies":[{"title":"The Sixth Sense","year":1999}]}

User: "tell me about Christopher Nolan"
Response: {"message":"Christopher Nolan is a British-American filmmaker known for his non-linear storytelling, practical effects, and cerebral narratives. His most celebrated works include Memento, The Dark Knight trilogy, Inception, Interstellar, and Oppenheimer. He's widely considered one of the greatest directors of his generation.","movies":[]}

User: "how do I make pasta"
Response: {"message":"That's outside my expertise — I only know movies! But if you want a film about food, I can recommend Ratatouille or Chef 😄","movies":[]}

User: "знайди Дюну"
Response: {"message":"Ось вона!","movies":[{"title":"Dune","year":2021}]}

User: "порадь щось з мого списку"
Response: {"message":"З твого списку я би вибрав ці фільми для перегляду сьогодні:","movies":[{"title":"Parasite","year":2019},{"title":"Whiplash","year":2014}]}

User: "recommend something similar to Inception"
Response: {"message":"If you loved Inception's mind-bending structure and visual ambition, here are some films that hit that same note:","movies":[{"title":"Memento","year":2000},{"title":"Shutter Island","year":2010},{"title":"Interstellar","year":2014},{"title":"Coherence","year":2013},{"title":"Annihilation","year":2018}]}
`;
  }
}
