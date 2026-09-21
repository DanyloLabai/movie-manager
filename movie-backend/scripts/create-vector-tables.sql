-- Run ONCE against the production database. VectorService (src/vector/vector.service.ts)
-- talks to these tables via raw SQL (pg.Pool), NOT TypeORM entities, so
-- `synchronize: true` never creates them. Without this, every AI-chat
-- request logs:
--   ERROR [VectorService] Memory retrieval failed: relation "user_memory_embeddings" does not exist
--   ERROR [AiChatService] Vector search failed for query "...": relation "movie_embeddings" does not exist
-- and silently falls back to plain TMDB search (still works, just skips
-- semantic/"vibe" search and long-term user memory).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS movie_embeddings (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  embedding vector(3072) NOT NULL,
  metadata JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS user_memory_embeddings (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  embedding vector(3072) NOT NULL,
  metadata JSONB NOT NULL
);

-- No ivfflat/hnsw index: both pgvector index types cap out at 2000
-- dimensions, and gemini-embedding-001 produces 3072-dim vectors by default.
-- At this table size (hundreds of rows), a sequential scan for
-- `ORDER BY embedding <=> ... LIMIT k` is plenty fast without one.

-- Sanity check
SELECT
  (SELECT count(*) FROM movie_embeddings) AS movie_embeddings_rows,
  (SELECT count(*) FROM user_memory_embeddings) AS user_memory_embeddings_rows;
