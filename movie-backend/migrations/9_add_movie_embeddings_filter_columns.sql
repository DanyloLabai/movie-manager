ALTER TABLE "movie_embeddings"
  ADD COLUMN IF NOT EXISTS "genre_ids" int[],
  ADD COLUMN IF NOT EXISTS "release_year" int,
  ADD COLUMN IF NOT EXISTS "vote_average" double precision,
  ADD COLUMN IF NOT EXISTS "runtime" int,
  ADD COLUMN IF NOT EXISTS "media_type" varchar(10);

CREATE INDEX IF NOT EXISTS "idx_movie_embeddings_genre_ids" ON "movie_embeddings" USING GIN ("genre_ids");
CREATE INDEX IF NOT EXISTS "idx_movie_embeddings_release_year" ON "movie_embeddings" ("release_year");
CREATE INDEX IF NOT EXISTS "idx_movie_embeddings_vote_average" ON "movie_embeddings" ("vote_average");
CREATE INDEX IF NOT EXISTS "idx_movie_embeddings_runtime" ON "movie_embeddings" ("runtime");
