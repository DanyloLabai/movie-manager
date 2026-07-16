import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { z } from 'zod';
import { createGroq } from '@ai-sdk/groq';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { QuizMoviePool } from './quiz-movie-pool.entity';
import { QuizHint, QuizHintsByLanguage } from './daily-movie-quiz.entity';

const HINT_COUNT = 5;
/** Must support structured outputs (json_schema) — see console.groq.com/docs/structured-outputs#supported-models */
const GROQ_HINTS_MODEL = 'openai/gpt-oss-120b';
const GEMINI_HINTS_MODEL = 'gemini-flash-latest';

const hintSetSchema = z
  .array(z.object({ text: z.string() }))
  .length(HINT_COUNT);

const hintsSchema = z.object({
  en: hintSetSchema.describe(
    'Exactly 5 English hints, in this fixed order: [1] genre+decade+tone, [2] a deliberately silly/absurd one-line retelling of the plot, [3] the lead actor, [4] the director, [5] the single most recognizable, obvious detail.',
  ),
  uk: hintSetSchema.describe(
    'The same 5 hints translated into natural Ukrainian, same order, same facts — not a literal word-for-word translation, write as a native Ukrainian speaker would.',
  ),
});

const toHints = (texts: string[]): QuizHint[] =>
  texts.map((text, i) => ({ level: i + 1, text }));

const FALLBACK_HINTS_EN = (pool: QuizMoviePool): string[] => [
  pool.releaseYear
    ? `Released in ${pool.releaseYear}.`
    : 'A well-known feature film.',
  "One of the most talked-about films of its year — that's all you're getting for free.",
  pool.cast?.[0] ? `Stars ${pool.cast[0].name}.` : 'Features a well-known cast.',
  pool.director ? `Directed by ${pool.director}.` : 'Directed by an acclaimed filmmaker.',
  `The title starts with "${pool.title.charAt(0).toUpperCase()}".`,
];

const FALLBACK_HINTS_UK = (pool: QuizMoviePool): string[] => [
  pool.releaseYear ? `Вийшов у ${pool.releaseYear} році.` : 'Відомий повнометражний фільм.',
  'Один із найобговорюваніших фільмів свого року — і це все, що ти отримуєш безкоштовно.',
  pool.cast?.[0] ? `У головній ролі ${pool.cast[0].name}.` : 'У фільмі знялись відомі актори.',
  pool.director ? `Режисер — ${pool.director}.` : 'Знятий відомим режисером.',
  `Назва починається на "${pool.title.charAt(0).toUpperCase()}".`,
];

@Injectable()
export class QuizHintsService {
  private readonly logger = new Logger(QuizHintsService.name);
  private groqClient: ReturnType<typeof createGroq>;
  private geminiClient: ReturnType<typeof createGoogleGenerativeAI>;

  constructor(private readonly configService: ConfigService) {
    const groqApiKey = this.configService.get<string>('GROQ_API_KEY') || '';
    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    this.groqClient = createGroq({ apiKey: groqApiKey });
    this.geminiClient = createGoogleGenerativeAI({ apiKey: geminiApiKey });
  }

  async generateHints(pool: QuizMoviePool): Promise<QuizHintsByLanguage> {
    const castNames = (pool.cast || [])
      .slice(0, 5)
      .map((c) => c.name)
      .join(', ');

    const systemPrompt = `You write hints for a daily "guess the movie" game, similar to Wordle. Write exactly 5 hints in English, in this EXACT order and role — do not reorder or blend them:

1. Genre + decade + general tone. No specifics.
2. A deliberately silly, absurd, or comedically vague one-line retelling of the premise — think "so-bad-it's-funny synopsis", NOT a paraphrase of the real plot. Do not reuse specific character names, place names, or plot beats from the overview below — invent a jokey, deliberately unhelpful framing instead. Replace every proper noun (character names, locations, organizations, made-up in-universe terms) with a generic descriptor instead — e.g. instead of "Harry Potter" write "a boy with a scar", instead of "Hogwarts" write "a magic school", instead of "Frodo" write "a small guy with hairy feet". If a character or place name is itself so iconic that using it (or a thin rewording of it) would identify the movie or its franchise, you MUST NOT use it, even translated or slightly altered — describe it generically instead. This must NOT make the movie or its franchise obvious.
3. The lead actor's name, one short sentence.
4. The director's name, one short sentence.
5. The single most recognizable, obvious detail about the movie (a famous scene/line, or its first letter + year) — this one CAN be a giveaway, it's the last hint.

Then provide the same 5 hints translated naturally into Ukrainian (same order, same facts, not a literal translation).

Rules:
- NEVER mention or spell out the movie title, or any word that is part of the title, in either language.
- In hint 2 specifically, NEVER use any proper noun from the movie or its franchise (no character names, place names, or invented in-universe terms) — always substitute a generic description instead.
- NEVER mention the release year outside of hint 1 and hint 5.
- Hints 3 and 4 must be based strictly on the facts given — do not invent actors or crew.
- Write in a punchy, playful tone.

Movie facts:
Title (for your reference only, do not leak it): ${pool.title}
Year: ${pool.releaseYear ?? 'unknown'}
Director: ${pool.director ?? 'unknown'}
Top cast: ${castNames || 'unknown'}
Overview (for your own understanding only — hint 2 must NOT closely paraphrase this): ${pool.overview ?? 'unknown'}`;

    try {
      const object = await this.runHintGeneration(
        this.groqClient(GROQ_HINTS_MODEL),
        systemPrompt,
      );
      return {
        en: toHints(object.en.map((h) => h.text)),
        uk: toHints(object.uk.map((h) => h.text)),
      };
    } catch (groqError: unknown) {
      this.logger.warn(
        `Groq hint generation failed, trying Gemini fallback: ${this.errorMsg(groqError)}`,
      );
      try {
        const object = await this.runHintGeneration(
          this.geminiClient(GEMINI_HINTS_MODEL),
          systemPrompt,
        );
        return {
          en: toHints(object.en.map((h) => h.text)),
          uk: toHints(object.uk.map((h) => h.text)),
        };
      } catch (geminiError: unknown) {
        this.logger.warn(
          `AI hint generation failed on both providers, falling back to templated hints: ${this.errorMsg(geminiError)}`,
        );
        return {
          en: toHints(FALLBACK_HINTS_EN(pool)),
          uk: toHints(FALLBACK_HINTS_UK(pool)),
        };
      }
    }
  }

  private async runHintGeneration(
    model: Parameters<typeof generateObject>[0]['model'],
    systemPrompt: string,
  ): Promise<z.infer<typeof hintsSchema>> {
    const { object } = await generateObject({
      model,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Generate the hints now.' }],
      schema: hintsSchema,
      temperature: 0.8,
    });
    return object;
  }

  private errorMsg(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
