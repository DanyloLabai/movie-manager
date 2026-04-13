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
        this.logger.warn('Failed to fetch upcoming movies for AI cheat sheet');
      }

      const currentYear = new Date().getFullYear();

      userContext = `
        CURRENT YEAR: ${currentYear}.
        
        USER DATA (STRICTLY FOR CONTEXT):
        1. FAVORITES & MASTERPIECES: ${favs}, ${highlyRated}. (Use these to understand their taste).
        2. IN PLANS TO WATCH (Watchlist): ${inPlans}.
        3. RECENTLY WATCHED & RATED: ${recentWatched}.

        UPCOMING MOVIES CHEAT SHEET (From Live TMDB Database): 
        ${upcomingList}.
        
        CRITICAL RECOMMENDATION RULES:
        1. IGNORE THE CHEAT SHEET for general requests. If the user just asks for "a good movie", "action movies", or general recommendations, you MUST recommend ALREADY RELEASED, well-known, high-quality movies from past years.
        2. ONLY use the "UPCOMING MOVIES CHEAT SHEET" if the user EXPLICITLY asks for "new movies", "upcoming movies", "in theaters", or specifically asks about ${currentYear}.
        3. If the user mentions a movie they recently watched or rated, LOOK AT THE "RECENTLY WATCHED & RATED" list to identify it, and base your answer on that context.
        4. GENERAL RULE: NEVER recommend movies already in the user's lists (${favs}, ${highlyRated}, ${recentWatched}) UNLESS explicitly asked.
        5. WATCHLIST RULE: If the user asks "what should I watch from my list", "pick from my plans", or "з мого списку", you MUST choose 1-3 movies EXCLUSIVELY from their "IN PLANS TO WATCH" list (${inPlans}) and explain why they should watch it today based on their taste.
        6. NEVER invent movie titles. Only suggest real movies that exist on TMDB.
        7. Do NOT guess release years for unreleased/upcoming movies unless you are 100% absolutely sure.
      `;
    } catch (e) {
      this.logger.warn('Could not fetch user profile for AI context');
    }

    try {
      this.logger.log('Attempting to guess media with Groq (Primary)...');
      const rawText = await this.getMovieTitleFromGroq(messages, userContext);
      aiResponse = this.parseJson(rawText) as ParsedAiResponse;
    } catch (groqError: any) {
      this.logger.error(
        `Groq Failed. Reason: ${groqError.message || groqError}`,
      );
      this.logger.warn(`Switching to Gemini (Fallback)...`);

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
          'Я не знайшов конкретних фільмів, але завжди готовий поговорити!',
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
        message: `${aiResponse.message}\n\n(P.S. Я знайшов кілька назв, але не зміг підтягнути їхні постери з бази).`,
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
      if (!match) throw new Error('No JSON object found in response');
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

    const completion = await this.groq.chat.completions.create({
      messages: formattedMessages,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      response_format: { type: 'json_object' },
    });

    return (
      completion.choices[0]?.message?.content?.trim() ||
      '{"message": "Error connecting to AI.", "movies": []}'
    );
  }

  private getSystemPrompt(userContext: string): string {
    return `You are an elite movie, TV series, anime, and pop-culture expert assistant. You perfectly understand all languages, including Ukrainian.
    
    Here is the data about the current user's preferences:
    ${userContext}
    If the user asks for recommendations "based on my taste", "for me", or something similar, use this data to tailor your suggestions.

    STRICT DOMAIN RULE: You are ONLY allowed to discuss topics related to movies, TV shows, anime, actors, directors, cinematography, pop-culture, and the entertainment industry. 
    If the user asks about ANYTHING else (e.g., coding, politics, recipes, weather, general science), you MUST politely refuse to answer and remind them that you are exclusively a movie expert.
    Example refusal: "I'd love to chat about that, but my expertise is strictly limited to movies and TV shows! Want a movie recommendation instead?" (Translate this to the user's language).

    You have TWO modes of answering, depending on the user's request:
    MODE 1 (Conversational/Refusal): If the user asks a general movie question, OR if you need to refuse an off-topic request, answer accurately and friendly in the 'message' field, and leave the 'movies' array EMPTY [].
    MODE 2 (Recommendations/Search): If the user describes a movie plot, asks for recommendations, or tries to remember a title, act as a search engine. Suggest up to 10 highly relevant titles in the 'movies' array, and provide a short friendly intro in the 'message' field.
    
    Return your answer ONLY as a valid JSON object with the exact following structure:
    {
      "message": "Your friendly reply or polite refusal. THIS MUST BE IN THE SAME LANGUAGE AS THE USER'S PROMPT.",
      "movies": [
        {
          "title": "Exact official English title on TMDB",
          "year": 2010
        }
      ]
    }
    
    CRITICAL RULE: Output ABSOLUTELY NOTHING EXCEPT THE JSON OBJECT. No markdown formatting outside the JSON.`;
  }
}
