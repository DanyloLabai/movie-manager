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

interface ParsedAiResponse {
  title?: string;
  year?: number;
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
    prompt: string,
  ): Promise<MovieResultDto | { message: string }> {
    let aiResponse: { title?: string; year?: number; error?: string };

    try {
      this.logger.log('Attempting to guess movie with Groq (Primary)...');
      const rawText = await this.getMovieTitleFromGroq(prompt);
      aiResponse = this.parseJson(rawText) as ParsedAiResponse;
    } catch {
      this.logger.warn(
        `Groq failed or returned invalid data. Switching to Gemini (Fallback)...`,
      );
      try {
        const rawText = await this.getMovieTitleFromGemini(prompt);
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

    if (aiResponse.error === 'ERROR_NOT_FOUND' || !aiResponse.title) {
      return {
        message:
          'На жаль, я не зміг впізнати цей фільм. Спробуй описати його інакше або додати більше деталей!',
      };
    }

    this.logger.log(
      `AI Guessed: ${aiResponse.title} (${aiResponse.year || 'рік невідомий'})`,
    );
    const movieData = await this.moviesService.findMovieByTitle(
      aiResponse.title,
      aiResponse.year,
    );

    if (!movieData) {
      return {
        message: `Я зрозумів, що це фільм "${aiResponse.title}" (${aiResponse.year || '?'}), але не зміг знайти його постер та опис у базі даних.`,
      };
    }

    return movieData;
  }

  private parseJson(raw: string): any {
    try {
      const cleanRaw = raw.replace(/```json|```/gi, '').trim();
      return JSON.parse(cleanRaw);
    } catch {
      this.logger.error(
        `Failed to parse AI response as JSON. Raw text: ${raw}`,
      );
      throw new Error('Invalid JSON format from AI');
    }
  }

  private async getMovieTitleFromGemini(prompt: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: this.getSystemPrompt(),
    });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 },
    });
    return result.response.text().trim();
  }

  private async getMovieTitleFromGroq(prompt: string): Promise<string> {
    const completion = await this.groq.chat.completions.create({
      messages: [
        { role: 'system', content: this.getSystemPrompt() },
        { role: 'user', content: prompt },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
    });
    return (
      completion.choices[0]?.message?.content?.trim() ||
      '{"error": "ERROR_NOT_FOUND"}'
    );
  }

  private getSystemPrompt(): string {
    return `You are a movie expert. Identify the movie by description. 
    Return your answer ONLY as a valid JSON object with the following keys:
    "title": the exact official English title,
    "year": the release year as a number.
    
    If the movie is not found, or if the user prompt is not about a movie, return {"error": "ERROR_NOT_FOUND"}.
    Do not include any other text, greetings, markdown formatting, or explanations. Output STRICTLY JSON.`;
  }
}
