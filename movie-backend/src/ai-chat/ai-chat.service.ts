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
  movies: { title: string; year?: number }[];
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
  ): Promise<{ message: string; movies?: MovieResultDto[] }> {
    let aiResponse: ParsedAiResponse;

    try {
      this.logger.log('Attempting to guess movie with Groq (Primary)...');
      const rawText = await this.getMovieTitleFromGroq(messages);
      aiResponse = this.parseJson(rawText) as ParsedAiResponse;
    } catch (groqError: any) {
      this.logger.error(
        `Groq Failed. Reason: ${groqError.message || groqError}`,
      );
      this.logger.warn(`Switching to Gemini (Fallback)...`);

      try {
        const rawText = await this.getMovieTitleFromGemini(messages);
        aiResponse = this.parseJson(rawText) as ParsedAiResponse;
      } catch (geminiError: any) {
        const geminiMessage =
          geminiError instanceof Error
            ? geminiError.message
            : 'Unknown Gemini error';
        this.logger.error(
          `Both AI services failed. Last error: ${geminiMessage}`,
        );
        throw new InternalServerErrorException(
          'All AI services are currently unavailable',
          geminiMessage,
        );
      }
    }

    if (
      aiResponse.error === 'ERROR_NOT_FOUND' ||
      !aiResponse.movies ||
      aiResponse.movies.length === 0
    ) {
      return {
        message:
          aiResponse.message ||
          "Unfortunately, I couldn't find relevant movies for this request.",
      };
    }

    const foundMovies: MovieResultDto[] = [];

    for (const movie of aiResponse.movies.slice(0, 3)) {
      const movieData = await this.moviesService.findMovieByTitle(
        movie.title,
        movie.year,
      );
      if (movieData) {
        foundMovies.push(movieData);
      }
    }

    if (foundMovies.length === 0) {
      return {
        message: `I found some titles, but couldn't locate their details in the database.`,
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
      if (!match) {
        throw new Error('No JSON object found in response');
      }
      return JSON.parse(match[0]);
    } catch {
      this.logger.error(
        `Failed to parse AI response as JSON. Raw text: ${raw}`,
      );
      throw new Error('Invalid JSON format from AI');
    }
  }

  private async getMovieTitleFromGemini(
    messages: ChatMessage[],
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash-latest',
      systemInstruction: this.getSystemPrompt(),
      generationConfig: {
        temperature: 0.3,
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
  ): Promise<string> {
    const formattedMessages = [
      { role: 'system', content: this.getSystemPrompt() },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const completion = await this.groq.chat.completions.create({
      messages: formattedMessages as any,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    return (
      completion.choices[0]?.message?.content?.trim() ||
      '{"error": "ERROR_NOT_FOUND"}'
    );
  }

  private getSystemPrompt(): string {
    return `You are a movie expert assistant. Analyze the conversation history and the user's latest request.
    If the user asks for a movie, or asks for alternatives, suggest up to 3 relevant movies.
    
    Return your answer ONLY as a valid JSON object with the following structure:
    {
      "message": "A short, friendly conversational reply explaining your choices.",
      "movies": [
        {
          "title": "Exact official English title",
          "year": 2023
        }
      ]
    }
    
    CRITICAL RULE: Output ABSOLUTELY NOTHING EXCEPT THE JSON OBJECT. No markdown formatting.
    If no movies match, return {"message": "Sorry, I couldn't find anything matching that.", "movies": [], "error": "ERROR_NOT_FOUND"}.`;
  }
}
