import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { Document } from '@langchain/core/documents';
import { PoolConfig } from 'pg';

@Injectable()
export class VectorService implements OnModuleInit {
  private vectorStore: PGVectorStore | null = null;
  private readonly logger = new Logger(VectorService.name);

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL is required for VectorService initialization.',
      );
    }

    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error(
        'GEMINI_API_KEY is required for GoogleGenerativeAIEmbeddings.',
      );
    }

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: geminiApiKey,
      modelName: 'text-embedding-004',
    });

    const dbConfig: PoolConfig = {
      connectionString: databaseUrl,
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : undefined,
    };

    const config = {
      postgresConnectionOptions: dbConfig,
      tableName: 'movie_embeddings',
      columns: {
        idColumnName: 'id',
        vectorColumnName: 'embedding',
        contentColumnName: 'text',
        metadataColumnName: 'metadata',
      },
    };

    this.vectorStore = await PGVectorStore.initialize(embeddings, config);
    this.logger.log('Vector store (pgvector) successfully initialized.');
  }

  get store(): PGVectorStore {
    if (!this.vectorStore) {
      throw new Error('VectorStore not initialized yet.');
    }
    return this.vectorStore;
  }

  async addMovieToVectorStore(movie: {
    id: number;
    title: string;
    description: string;
    genres: string[];
  }) {
    const safeTitle = movie.title || 'Unknown Title';
    const safeDesc = movie.description || 'No description available';
    const safeGenres = Array.isArray(movie.genres)
      ? movie.genres.join(', ')
      : '';

    const pageContent = `Title: ${safeTitle}. Description: ${safeDesc}. Genres: ${safeGenres}.`;

    if (pageContent.length < 15) {
      this.logger.warn(`Skipped movie ID ${movie.id} - not enough text data.`);
      return;
    }

    const doc = new Document({
      pageContent: pageContent,
      metadata: {
        tmdbId: movie.id,
        title: safeTitle,
      },
    });

    try {
      await this.store.addDocuments([doc]);
      this.logger.log(`Indexed movie into vector DB: ${safeTitle}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(
        `Failed to index movie ${movie.id} (${safeTitle}): ${errorMessage}`,
      );
    }
  }

  async searchSimilarMovies(query: string, k = 5): Promise<Document[]> {
    return this.store.similaritySearch(query, k);
  }
}
