-- Baseline for the pgvector tables used by VectorService. Like the other
-- baseline, these were never captured by a migration- they were created
-- out-of-band (originally via a LangChain PGVectorStore default schema:
-- id/text/metadata/embedding) and have been queried directly via pg.Pool
-- ever since.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "movie_embeddings" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "text" text,
  "metadata" jsonb,
  "embedding" vector
);

CREATE TABLE IF NOT EXISTS "user_memory_embeddings" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "text" text,
  "metadata" jsonb,
  "embedding" vector
);
