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
    prompt: string,
  ): Promise<MovieResultDto | { message: string }> {
    let movieTitle: string;

    try {
      this.logger.log('Attempting to guess movie with Gemini...');
      movieTitle = await this.getMovieTitleFromGemini(prompt);
    } catch (error: any) {
      this.logger.warn(`Gemini failed. Switching to Groq...`);
      try {
        movieTitle = await this.getMovieTitleFromGroq(prompt);
      } catch (groqError) {
        throw new InternalServerErrorException(
          'All AI services are currently unavailable',
          groqError.message,
        );
      }
    }

    if (movieTitle === 'ERROR_NOT_FOUND') {
      return { message: "Sorry, I couldn't recognize this movie." };
    }

    const movieData = await this.moviesService.findMovieByTitle(movieTitle);

    if (!movieData) {
      return {
        message: `Movie "${movieTitle}" recognized but not found in the database.`,
      };
    }

    return movieData;
  }

  private async getMovieTitleFromGemini(prompt: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: this.getSystemPrompt(),
    });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  }

  private async getMovieTitleFromGroq(prompt: string): Promise<string> {
    const completion = await this.groq.chat.completions.create({
      messages: [
        { role: 'system', content: this.getSystemPrompt() },
        { role: 'user', content: prompt },
      ],
      model: 'llama-3.3-70b-versatile',
    });
    return completion.choices[0]?.message?.content?.trim() || 'ERROR_NOT_FOUND';
  }

  private getSystemPrompt(): string {
    return `You are a movie expert. Identify the movie by description. 
    Return ONLY the English title. If not found, return ERROR_NOT_FOUND.`;
  }
}
