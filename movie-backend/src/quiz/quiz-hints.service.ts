import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { z } from 'zod';
import { createGroq } from '@ai-sdk/groq';
import { QuizMoviePool } from './quiz-movie-pool.entity';
import { QuizHint, QuizHintsByLanguage } from './daily-movie-quiz.entity';

const HINT_COUNT = 5;

const hintSetSchema = z
  .array(z.object({ text: z.string() }))
  .length(HINT_COUNT);

const hintsSchema = z.object({
  en: hintSetSchema.describe(
    `Exactly ${HINT_COUNT} English hints, ordered from the vaguest (level 1) to the most obvious (level ${HINT_COUNT}).`,
  ),
  uk: hintSetSchema.describe(
    `The same ${HINT_COUNT} hints translated into natural Ukrainian, same order, same facts — not a literal word-for-word translation, write as a native Ukrainian speaker would.`,
  ),
});

const toHints = (texts: string[]): QuizHint[] =>
  texts.map((text, i) => ({ level: i + 1, text }));

const FALLBACK_HINTS_EN = (pool: QuizMoviePool): string[] => [
  pool.releaseYear
    ? `Released in ${pool.releaseYear}.`
    : 'A well-known feature film.',
  pool.overview ? pool.overview.split('. ')[0] + '.' : 'Has a memorable, widely discussed plot.',
  pool.cast?.[0] ? `Stars ${pool.cast[0].name}.` : 'Features a well-known cast.',
  pool.director ? `Directed by ${pool.director}.` : 'Directed by an acclaimed filmmaker.',
  `The title starts with "${pool.title.charAt(0).toUpperCase()}".`,
];

const FALLBACK_HINTS_UK = (pool: QuizMoviePool): string[] => [
  pool.releaseYear ? `Вийшов у ${pool.releaseYear} році.` : 'Відомий повнометражний фільм.',
  'Має запам\'ятовуваний, широко обговорюваний сюжет.',
  pool.cast?.[0] ? `У головній ролі ${pool.cast[0].name}.` : 'У фільмі знялись відомі актори.',
  pool.director ? `Режисер — ${pool.director}.` : 'Знятий відомим режисером.',
  `Назва починається на "${pool.title.charAt(0).toUpperCase()}".`,
];

@Injectable()
export class QuizHintsService {
  private readonly logger = new Logger(QuizHintsService.name);
  private groqClient: ReturnType<typeof createGroq>;

  constructor(private readonly configService: ConfigService) {
    const groqApiKey = this.configService.get<string>('GROQ_API_KEY') || '';
    this.groqClient = createGroq({ apiKey: groqApiKey });
  }

  async generateHints(pool: QuizMoviePool): Promise<QuizHintsByLanguage> {
    try {
      const castNames = (pool.cast || [])
        .slice(0, 5)
        .map((c) => c.name)
        .join(', ');

      const systemPrompt = `You write hints for a daily "guess the movie" game, similar to Wordle.
Given the movie's data below, write exactly ${HINT_COUNT} short hints (max ~15 words each) in English, ordered from the VAGUEST (level 1, e.g. genre/decade/tone) to the MOST OBVIOUS (level ${HINT_COUNT}, e.g. a very recognizable plot beat or star). Then provide the same hints translated naturally into Ukrainian.
Rules:
- NEVER mention or spell out the movie title, or any word that is part of the title, in either language.
- NEVER mention the release year in more than one hint.
- Base every hint strictly on the facts given — do not invent actors, plot details, or trivia.
- Write in a punchy, playful tone.

Movie facts:
Title (for your reference only, do not leak it): ${pool.title}
Year: ${pool.releaseYear ?? 'unknown'}
Director: ${pool.director ?? 'unknown'}
Top cast: ${castNames || 'unknown'}
Overview: ${pool.overview ?? 'unknown'}`;

      const { object } = await generateObject({
        model: this.groqClient('llama-3.3-70b-versatile'),
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Generate the hints now.' }],
        schema: hintsSchema,
        temperature: 0.7,
      });

      return {
        en: toHints(object.en.map((h) => h.text)),
        uk: toHints(object.uk.map((h) => h.text)),
      };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `AI hint generation failed, falling back to templated hints: ${errorMsg}`,
      );
      return {
        en: toHints(FALLBACK_HINTS_EN(pool)),
        uk: toHints(FALLBACK_HINTS_UK(pool)),
      };
    }
  }
}
