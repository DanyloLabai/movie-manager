import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { GenreDto } from '../movies/dto/genre.dto';
import {
  MovieTextMetadataRow,
  MovieTextMetadataDistanceRow,
  MovieMetadataRow,
  TasteCompatibilityRow,
  UserFactSimilarityRow,
  GeminiEmbedResponse,
} from './types/vector-row.types';

export interface MovieEmbeddingMetadata {
  tmdbId: number;
  title: string;
  mediaType?: 'movie' | 'tv';
  [key: string]: unknown;
}

export interface MovieSearchFilters {
  genreId?: number;
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  runtimeFrom?: number;
  runtimeTo?: number;
  excludeWatched?: boolean;
}

export interface DiscoveryCandidate {
  tmdbId: number;
  title: string;
}

@Injectable()
export class VectorService implements OnModuleInit {
  private geminiApiKey: string;
  private readonly logger = new Logger(VectorService.name);

  private readonly PREFERENCE_DUPLICATE_DISTANCE_THRESHOLD = 0.05;

  private readonly MAX_PREFERENCES_PER_CONSOLIDATION = 300;

  private readonly SEARCH_RELEVANCE_DISTANCE_THRESHOLD = 0.6;
  private readonly EMBED_TIMEOUT_MS = 15000;

  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  onModuleInit() {
    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is required.');
    }

    this.geminiApiKey = geminiApiKey;

    this.logger.log(
      'VectorService initialized with gemini-embedding-001 via the Gemini REST API, sharing the TypeORM connection pool.',
    );
  }

  private async embed(text: string): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-embedding-001:embedContent?key=${this.geminiApiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text }] },
      }),
      signal: AbortSignal.timeout(this.EMBED_TIMEOUT_MS),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini embed ${res.status}: ${err}`);
    }
    const data = (await res.json()) as GeminiEmbedResponse;
    return data.embedding.values;
  }
  async addMovieToVectorStore(movie: {
    id: number;
    title: string;
    description: string;
    genres: GenreDto[];
    releaseYear: number | null;
    voteAverage: number | null;
    runtime: number | null;
    mediaType: 'movie' | 'tv';
  }): Promise<boolean> {
    try {
      const existing = await this.dataSource.query<unknown[]>(
        `SELECT 1 FROM movie_embeddings WHERE metadata->>'tmdbId' = $1 LIMIT 1`,
        [String(movie.id)],
      );
      if (existing.length > 0) {
        return true;
      }

      const genreNames = movie.genres.map((g) => g.name);
      const genreIds = movie.genres.map((g) => g.id);
      const text = `Title: ${movie.title}. Description: ${movie.description}. Genres: ${genreNames.join(', ')}.`;
      const embedding = await this.embed(text);
      const metadata = {
        tmdbId: movie.id,
        title: movie.title,
        mediaType: movie.mediaType,
      };

      await this.dataSource.query(
        `INSERT INTO movie_embeddings
           (text, embedding, metadata, genre_ids, release_year, vote_average, runtime, media_type)
         VALUES ($1, $2::vector, $3, $4, $5, $6, $7, $8)`,
        [
          text,
          JSON.stringify(embedding),
          JSON.stringify(metadata),
          genreIds,
          movie.releaseYear,
          movie.voteAverage,
          movie.runtime,
          movie.mediaType,
        ],
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

      await this.dataSource.query(
        `DELETE FROM user_memory_embeddings
         WHERE metadata->>'userId' = $1
           AND embedding <=> $2::vector < $3`,
        [
          String(userId),
          JSON.stringify(embedding),
          SIMILAR_FACT_DISTANCE_THRESHOLD,
        ],
      );

      await this.dataSource.query(
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

  @Cron('0 4 * * *')
  async consolidateDuplicatePreferences() {
    this.logger.log('Running daily preference deduplication...');

    try {
      const users = await this.dataSource.query<Array<{ userId: string }>>(
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

  private async consolidateUserPreferences(userId: string): Promise<number> {
    const pairs = await this.dataSource.query<
      Array<{
        idA: string;
        idB: string;
        createdAtA: string;
        createdAtB: string;
      }>
    >(
      `WITH candidates AS (
         SELECT id, embedding, "createdAt"
         FROM user_memory_embeddings
         WHERE metadata->>'userId' = $1 AND metadata->>'type' = 'preference'
         ORDER BY "createdAt" DESC
         LIMIT $3
       )
       SELECT a.id AS "idA", b.id AS "idB",
              a."createdAt" AS "createdAtA", b."createdAt" AS "createdAtB"
       FROM candidates a
       JOIN candidates b ON a.id < b.id
       WHERE a.embedding <=> b.embedding < $2
       ORDER BY a.embedding <=> b.embedding ASC`,
      [
        userId,
        this.PREFERENCE_DUPLICATE_DISTANCE_THRESHOLD,
        this.MAX_PREFERENCES_PER_CONSOLIDATION,
      ],
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

    await this.dataSource.query(
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

    const rows = await this.dataSource.query<MovieTextMetadataDistanceRow[]>(
      `SELECT text, metadata, embedding <=> $1::vector AS distance
       FROM movie_embeddings
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [JSON.stringify(embedding), k],
    );

    return rows
      .filter(
        (row) =>
          Number(row.distance) <= this.SEARCH_RELEVANCE_DISTANCE_THRESHOLD,
      )
      .map((row) => ({
        pageContent: row.text,
        metadata:
          typeof row.metadata === 'string'
            ? (JSON.parse(row.metadata) as MovieEmbeddingMetadata)
            : (row.metadata as MovieEmbeddingMetadata),
      }));
  }

  private buildFilterClause(
    filters: MovieSearchFilters,
    userId: number | undefined,
    startParamIndex: number,
  ): { clause: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = startParamIndex;

    if (filters.genreId !== undefined) {
      conditions.push(`genre_ids @> ARRAY[$${i++}]::int[]`);
      params.push(filters.genreId);
    }
    if (filters.yearFrom !== undefined) {
      conditions.push(`release_year >= $${i++}`);
      params.push(filters.yearFrom);
    }
    if (filters.yearTo !== undefined) {
      conditions.push(`release_year <= $${i++}`);
      params.push(filters.yearTo);
    }
    if (filters.minRating !== undefined) {
      conditions.push(`vote_average >= $${i++}`);
      params.push(filters.minRating);
    }
    if (filters.runtimeFrom !== undefined) {
      conditions.push(`runtime >= $${i++}`);
      params.push(filters.runtimeFrom);
    }
    if (filters.runtimeTo !== undefined) {
      conditions.push(`runtime <= $${i++}`);
      params.push(filters.runtimeTo);
    }
    if (filters.excludeWatched && userId !== undefined) {
      conditions.push(
        `NOT EXISTS (
           SELECT 1 FROM watchlist w
           WHERE w."userId" = $${i++}
             AND w."isWatched" = true
             AND w."tmdbId" = (movie_embeddings.metadata->>'tmdbId')::int
         )`,
      );
      params.push(userId);
    }

    return {
      clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
      params,
    };
  }

  async searchSimilarMoviesFiltered(
    query: string,
    filters: MovieSearchFilters,
    userId?: number,
    k = 20,
  ): Promise<Array<{ pageContent: string; metadata: MovieEmbeddingMetadata }>> {
    const embedding = await this.embed(query);
    const { clause, params } = this.buildFilterClause(filters, userId, 3);

    const rows = await this.dataSource.query<MovieTextMetadataDistanceRow[]>(
      `SELECT text, metadata, embedding <=> $1::vector AS distance
       FROM movie_embeddings
       ${clause}
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [JSON.stringify(embedding), k, ...params],
    );

    return rows
      .filter(
        (row) =>
          Number(row.distance) <= this.SEARCH_RELEVANCE_DISTANCE_THRESHOLD,
      )
      .map((row) => ({
        pageContent: row.text,
        metadata:
          typeof row.metadata === 'string'
            ? (JSON.parse(row.metadata) as MovieEmbeddingMetadata)
            : (row.metadata as MovieEmbeddingMetadata),
      }));
  }

  async searchSimilarToMovie(
    tmdbId: number,
    filters: MovieSearchFilters,
    userId?: number,
    k = 20,
  ): Promise<Array<{ pageContent: string; metadata: MovieEmbeddingMetadata }>> {
    const tmdbIdStr = String(tmdbId);
    const { clause, params } = this.buildFilterClause(filters, userId, 3);
    const filterClause = clause
      ? `${clause} AND metadata->>'tmdbId' != $1`
      : `WHERE metadata->>'tmdbId' != $1`;

    const rows = await this.dataSource.query<MovieTextMetadataRow[]>(
      `WITH target AS (
         SELECT embedding FROM movie_embeddings
         WHERE metadata->>'tmdbId' = $1
         LIMIT 1
       )
       SELECT movie_embeddings.text, movie_embeddings.metadata
       FROM movie_embeddings, target
       ${filterClause}
       ORDER BY movie_embeddings.embedding <=> target.embedding
       LIMIT $2`,
      [tmdbIdStr, k, ...params],
    );

    return rows.map((row) => ({
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
      const rows = await this.dataSource.query<TasteCompatibilityRow[]>(
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

      const row = rows[0];
      if (!row) return null;
      if (
        Number(row.countA) < MIN_SAMPLE_SIZE ||
        Number(row.countB) < MIN_SAMPLE_SIZE
      ) {
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

  async getRelevantUserFactsWithScores(
    userId: number,
    query: string,
    k = 3,
  ): Promise<Array<{ preferenceText: string; similarityScore: number }>> {
    try {
      const embedding = await this.embed(query);

      const rows = await this.dataSource.query<UserFactSimilarityRow[]>(
        `SELECT text, 1 - (embedding <=> $2::vector) AS similarity
         FROM user_memory_embeddings
         WHERE metadata->>'userId' = $1 AND metadata->>'type' = 'preference'
         ORDER BY embedding <=> $2::vector
         LIMIT $3`,
        [String(userId), JSON.stringify(embedding), k],
      );

      return rows.map((row) => ({
        preferenceText: row.text,
        similarityScore: Number(row.similarity),
      }));
    } catch (error) {
      this.logger.error(`Memory retrieval failed: ${(error as Error).message}`);
      return [];
    }
  }

  async searchPersonalizedForUser(
    likedTmdbIds: number[],
    excludeTmdbIds: number[],
    k: number,
  ): Promise<DiscoveryCandidate[]> {
    if (likedTmdbIds.length === 0) return [];

    const rows = await this.dataSource.query<MovieMetadataRow[]>(
      `WITH centroid AS (
         SELECT AVG(embedding) AS v
         FROM movie_embeddings
         WHERE (metadata->>'tmdbId')::int = ANY($1::int[])
       )
       SELECT movie_embeddings.metadata
       FROM movie_embeddings, centroid
       WHERE media_type = 'movie'
         AND NOT (metadata->>'tmdbId')::int = ANY($2::int[])
         AND centroid.v IS NOT NULL
       ORDER BY movie_embeddings.embedding <=> centroid.v
       LIMIT $3`,
      [likedTmdbIds, excludeTmdbIds, k],
    );

    return this.rowsToCandidates(rows);
  }

  async searchDiverseForUser(
    familiarGenreIds: number[],
    excludeTmdbIds: number[],
    minRating: number,
    k: number,
  ): Promise<DiscoveryCandidate[]> {
    const conditions = [
      `media_type = 'movie'`,
      `NOT (metadata->>'tmdbId')::int = ANY($1::int[])`,
      `vote_average >= $2`,
    ];
    const params: unknown[] = [excludeTmdbIds, minRating];

    if (familiarGenreIds.length > 0) {
      conditions.push(`NOT (genre_ids && $3::int[])`);
      params.push(familiarGenreIds);
    }

    params.push(k);
    const limitParamIndex = params.length;

    const rows = await this.dataSource.query<MovieMetadataRow[]>(
      `SELECT metadata
       FROM movie_embeddings
       WHERE ${conditions.join(' AND ')}
       ORDER BY RANDOM()
       LIMIT $${limitParamIndex}`,
      params,
    );

    return this.rowsToCandidates(rows);
  }

  private rowsToCandidates(
    rows: Array<{ metadata: unknown }>,
  ): DiscoveryCandidate[] {
    return rows.map((row) => {
      const metadata: MovieEmbeddingMetadata =
        typeof row.metadata === 'string'
          ? (JSON.parse(row.metadata) as MovieEmbeddingMetadata)
          : (row.metadata as MovieEmbeddingMetadata);
      return { tmdbId: Number(metadata.tmdbId), title: metadata.title };
    });
  }
}
