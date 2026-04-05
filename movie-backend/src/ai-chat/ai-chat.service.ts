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
      this.logger.log('Attempting to guess media with Groq (Primary)...');
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
          "Unfortunately, I couldn't find relevant media for this request.",
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
    type GroqMessage = {
      role: 'system' | 'user' | 'assistant';
      content: string;
    };

    const systemMsg: GroqMessage = {
      role: 'system',
      content: this.getSystemPrompt(),
    };

    const userMsgs: GroqMessage[] = messages.map((m) => {
      const groqRole: 'user' | 'assistant' =
        m.role === 'assistant' ? 'assistant' : 'user';
      return {
        role: groqRole,
        content: m.content,
      };
    });

    const formattedMessages: GroqMessage[] = [systemMsg, ...userMsgs];

    const completion = await this.groq.chat.completions.create({
      messages: formattedMessages,
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
    return `You are an elite movie, TV series, anime, and pop-culture expert assistant. You perfectly understand all languages, including Ukrainian.
    
    Analyze the conversation history and the user's latest request carefully. Users might describe plots, character appearances (e.g., 'a boy with an arrow on his head' -> The Last Airbender), memes, or vague memories. 
    Internally translate the request to English to find the absolute best match across global cinema, TV series, live-action adaptations, and anime.
    Suggest up to 10 highly relevant titles.
    
    Return your answer ONLY as a valid JSON object with the exact following structure (NOTE: put TV shows and anime in the "movies" array as well):
    {
      "message": "A short, friendly conversational reply explaining your choices. THIS MESSAGE MUST BE IN THE SAME LANGUAGE AS THE USER'S PROMPT.",
      "movies": [
        {
          "title": "Exact official English title on TMDB",
          "year": 2010
        }
      ]
    }
    
    CRITICAL RULE: Output ABSOLUTELY NOTHING EXCEPT THE JSON OBJECT. No markdown formatting. 
    If no titles match, return {"message": "A polite message IN THE USER'S LANGUAGE stating you couldn't find a match.", "movies": [], "error": "ERROR_NOT_FOUND"}.`;
  }
}
