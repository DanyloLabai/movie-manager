import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiChatService {
  private genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('Api key is not set in enviroment variable');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async searchMovieByDescription(
    prompt: string,
  ): Promise<{ title: string; rawText?: string }> {
    try {
      const systemInstruction = `
        You are an expert movie assistant. Your only goal is to identify a movie based on the user's description.
        The user will provide the description in Ukrainian or any other language.
        
        RULES:
        1. If you successfully recognize the movie, return ONLY its original English title (e.g., Inception, The Martian). Do not add any punctuation, quotes, or extra text.
        2. If the user's prompt is not about movies, or you cannot guess the movie, return exactly this word: ERROR_NOT_FOUND
      `;

      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction,
      });

      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();

      if (responseText === 'ERROR_NOT_FOUND') {
        return {
          title: '',
          rawText: `Sorry, I couldn't recognize this movie. Try providing more details!`,
        };
      }

      return { title: responseText };
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new InternalServerErrorException(
        'Error communicating with the AI service',
      );
    }
  }
}
