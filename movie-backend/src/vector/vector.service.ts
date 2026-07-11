import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Pool } from 'pg';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed } from 'ai';

interface MovieEmbeddingMetadata {
  tmdbId: number;
  title: string;
  [key: string]: unknown;
}

@Injectable()
export class VectorService implements OnModuleInit {
  private pool: Pool;
  private geminiApiKey: string;
  private readonly logger = new Logger(VectorService.name);

  // Below this distance, two preference embeddings are considered
  // near-duplicates (e.g. "I hate horror movies" vs "horror scares me").
  private readonly PREFERENCE_DUPLICATE_DISTANCE_THRESHOLD = 0.05;

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
      'VectorService initialized with gemini-embedding-2 via the Gemini REST API.',
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
  }): Promise<boolean> {
    try {
      const existing = await this.pool.query(
        `SELECT 1 FROM movie_embeddings WHERE metadata->>'tmdbId' = $1 LIMIT 1`,
        [String(movie.id)],
      );
      if ((existing.rowCount ?? 0) > 0) {
        return true;
      }

      const text = `Title: ${movie.title}. Description: ${movie.description}. Genres: ${movie.genres.join(', ')}.`;
      const embedding = await this.embed(text);
      const metadata = { tmdbId: movie.id, title: movie.title };

      await this.pool.query(
        `INSERT INTO movie_embeddings (text, embedding, metadata)
         VALUES ($1, $2::vector, $3)`,
        [text, JSON.stringify(embedding), JSON.stringify(metadata)],
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to index movie: ${(error as Error).message}`);
      return false;
    }
  }

  async saveUserFact(userId: number, fact: string) {
    const SIMILAR_FACT_DISTANCE_THRESHOLD = 0.15;

    try {
      const embedding = await this.embed(fact);
      const metadata = { userId, type: 'preference' };

      // Replace near-duplicate/contradicting facts instead of accumulating
      // both, e.g. "hates horror" followed later by "loves horror".
      await this.pool.query(
        `DELETE FROM user_memory_embeddings
         WHERE metadata->>'userId' = $1
           AND embedding <=> $2::vector < $3`,
        [
          String(userId),
          JSON.stringify(embedding),
          SIMILAR_FACT_DISTANCE_THRESHOLD,
        ],
      );

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

  // Runs off-peak, after the other daily cron jobs (movies.service's 9am
  // release check, watched-reminder's 10am job).
  @Cron('0 4 * * *')
  async consolidateDuplicatePreferences() {
    this.logger.log('Running daily preference deduplication...');

    try {
      const { rows: users } = await this.pool.query<{ userId: string }>(
        `SELECT DISTINCT metadata->>'userId' AS "userId"
         FROM user_memory_embeddings
         WHERE metadata->>'type' = 'preference'`,
      );

      for (const { userId } of users) {
        if (!userId) continue;

        try {
          const mergedCount = await this.consolidateUserPreferences(userId);
          if (mergedCount > 0) {
            this.logger.log(
              `Merged ${mergedCount} duplicate preference(s) for user ${userId}`,
            );
          }
        } catch (err) {
          this.logger.error(
            `Failed to consolidate preferences for user ${userId}: ${(err as Error).message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Preference deduplication job failed: ${(error as Error).message}`,
      );
    }
  }

  // Plain pairwise comparison via pgvector's `<=>` operator, O(n^2) pairs
  // per user — no clustering library. Fine at this scale: a single user's
  // preference count stays in the tens, not thousands. Re-running this is
  // safe: once near-duplicates are merged, no pair remains under the
  // threshold, so a second run finds nothing to delete.
  private async consolidateUserPreferences(userId: string): Promise<number> {
    const { rows: pairs } = await this.pool.query<{
      idA: string;
      idB: string;
      createdAtA: string;
      createdAtB: string;
    }>(
      `SELECT a.id AS "idA", b.id AS "idB",
              a."createdAt" AS "createdAtA", b."createdAt" AS "createdAtB"
       FROM user_memory_embeddings a
       JOIN user_memory_embeddings b ON a.id < b.id
       WHERE a.metadata->>'userId' = $1 AND a.metadata->>'type' = 'preference'
         AND b.metadata->>'userId' = $1 AND b.metadata->>'type' = 'preference'
         AND a.embedding <=> b.embedding < $2
       ORDER BY a.embedding <=> b.embedding ASC`,
      [userId, this.PREFERENCE_DUPLICATE_DISTANCE_THRESHOLD],
    );

    const toDelete = new Set<string>();

    for (const pair of pairs) {
      if (toDelete.has(pair.idA) || toDelete.has(pair.idB)) continue;

      const idToDelete =
        new Date(pair.createdAtA) >= new Date(pair.createdAtB)
          ? pair.idB
          : pair.idA;
      toDelete.add(idToDelete);
    }

    if (toDelete.size === 0) return 0;

    await this.pool.query(
      `DELETE FROM user_memory_embeddings WHERE id = ANY($1::uuid[])`,
      [Array.from(toDelete)],
    );

    return toDelete.size;
  }

  async searchSimilarMovies(
    query: string,
    k = 5,
  ): Promise<Array<{ pageContent: string; metadata: MovieEmbeddingMetadata }>> {
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
          ? (JSON.parse(row.metadata) as MovieEmbeddingMetadata)
          : (row.metadata as MovieEmbeddingMetadata),
    }));
  }

  async computeTasteCompatibility(
    tmdbIdsA: number[],
    tmdbIdsB: number[],
  ): Promise<number | null> {
    const MIN_SAMPLE_SIZE = 3;
    if (tmdbIdsA.length === 0 || tmdbIdsB.length === 0) return null;

    try {
      const result = await this.pool.query(
        `WITH vec_a AS (
           SELECT AVG(embedding) AS v, COUNT(*) AS n
           FROM movie_embeddings
           WHERE (metadata->>'tmdbId')::int = ANY($1::int[])
         ),
         vec_b AS (
           SELECT AVG(embedding) AS v, COUNT(*) AS n
           FROM movie_embeddings
           WHERE (metadata->>'tmdbId')::int = ANY($2::int[])
         )
         SELECT
           vec_a.n AS "countA",
           vec_b.n AS "countB",
           CASE WHEN vec_a.n = 0 OR vec_b.n = 0 THEN NULL
                ELSE 1 - (vec_a.v <=> vec_b.v) END AS similarity
         FROM vec_a, vec_b`,
        [tmdbIdsA, tmdbIdsB],
      );

      const row = result.rows[0];
      if (!row) return null;
      if (Number(row.countA) < MIN_SAMPLE_SIZE || Number(row.countB) < MIN_SAMPLE_SIZE) {
        return null;
      }
      return row.similarity === null ? null : Number(row.similarity);
    } catch (error) {
      this.logger.error(
        `Taste compatibility calc failed: ${(error as Error).message}`,
      );
      return null;
    }
  }

  // Returns each preference's own text alongside its cosine similarity
  // (1 - distance) to the query, so callers can both feed the AI's system
  // prompt (preferenceText) and surface an explainability "reasoning" trail
  // to the user (similarityScore) from a single embed + query round trip.
  async getRelevantUserFactsWithScores(
    userId: number,
    query: string,
    k = 3,
  ): Promise<Array<{ preferenceText: string; similarityScore: number }>> {
    try {
      const embedding = await this.embed(query);

      const result = await this.pool.query(
        `SELECT text, 1 - (embedding <=> $2::vector) AS similarity
         FROM user_memory_embeddings
         WHERE metadata->>'userId' = $1 AND metadata->>'type' = 'preference'
         ORDER BY embedding <=> $2::vector
         LIMIT $3`,
        [String(userId), JSON.stringify(embedding), k],
      );

      return result.rows.map((row) => ({
        preferenceText: row.text as string,
        similarityScore: Number(row.similarity),
      }));
    } catch (error) {
      this.logger.error(`Memory retrieval failed: ${(error as Error).message}`);
      return [];
    }
  }

}
