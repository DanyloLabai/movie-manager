import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed } from 'ai';

@Injectable()
export class VectorService implements OnModuleInit {
  private pool: Pool;
  private geminiApiKey: string;
  private readonly logger = new Logger(VectorService.name);

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!databaseUrl || !geminiApiKey) {
      throw new Error('DATABASE_URL and GEMINI_API_KEY are required.');
    }

    this.geminiApiKey = geminiApiKey;

    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : undefined,
    });

    await this.pool.query('SELECT 1');
    this.logger.log(
      'VectorService initialized with text-embedding-004 via @ai-sdk/google.',
    );
  }

  private async embed(text: string): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-embedding-2:embedContent?key=${this.geminiApiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-2',
        content: { parts: [{ text }] },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini embed ${res.status}: ${err}`);
    }
    const data = await res.json();
    return data.embedding.values;
  }
  async addMovieToVectorStore(movie: {
    id: number;
    title: string;
    description: string;
    genres: string[];
  }) {
    try {
      const text = `Title: ${movie.title}. Description: ${movie.description}. Genres: ${movie.genres.join(', ')}.`;
      const embedding = await this.embed(text);
      const metadata = { tmdbId: movie.id, title: movie.title };

      await this.pool.query(
        `INSERT INTO movie_embeddings (text, embedding, metadata)
         VALUES ($1, $2::vector, $3)
         ON CONFLICT DO NOTHING`,
        [text, JSON.stringify(embedding), JSON.stringify(metadata)],
      );
    } catch (error) {
      this.logger.error(`Failed to index movie: ${(error as Error).message}`);
    }
  }

  async saveUserFact(userId: number, fact: string) {
    try {
      const embedding = await this.embed(fact);
      const metadata = { userId, type: 'preference' };

      await this.pool.query(
        `INSERT INTO user_memory_embeddings (text, embedding, metadata)
         VALUES ($1, $2::vector, $3)`,
        [fact, JSON.stringify(embedding), JSON.stringify(metadata)],
      );
      this.logger.debug(`Saved memory for user ${userId}: "${fact}"`);
    } catch (error) {
      this.logger.error(
        `Failed to save user memory: ${(error as Error).message}`,
      );
    }
  }

  async searchSimilarMovies(
    query: string,
    k = 5,
  ): Promise<Array<{ pageContent: string; metadata: any }>> {
    const embedding = await this.embed(query);

    const result = await this.pool.query(
      `SELECT text, metadata
       FROM movie_embeddings
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [JSON.stringify(embedding), k],
    );

    return result.rows.map((row) => ({
      pageContent: row.text,
      metadata:
        typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : row.metadata,
    }));
  }

  async getRelevantUserFacts(
    userId: number,
    query: string,
    k = 3,
  ): Promise<string[]> {
    try {
      const embedding = await this.embed(query);

      const result = await this.pool.query(
        `SELECT text
         FROM user_memory_embeddings
         WHERE metadata->>'userId' = $1
         ORDER BY embedding <=> $2::vector
         LIMIT $3`,
        [String(userId), JSON.stringify(embedding), k],
      );

      return result.rows.map((row) => row.text);
    } catch (error) {
      this.logger.error(`Memory retrieval failed: ${(error as Error).message}`);
      return [];
    }
  }
}
