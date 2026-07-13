CREATE TABLE IF NOT EXISTS "quiz_movie_pool" (
  "id" SERIAL PRIMARY KEY,
  "imdbId" varchar NOT NULL,
  "tmdbId" integer NOT NULL,
  "title" varchar NOT NULL,
  "releaseYear" integer,
  "posterPath" varchar,
  "genres" int[] NOT NULL DEFAULT '{}',
  "overview" text,
  "cast" jsonb NOT NULL DEFAULT '[]',
  "director" varchar,
  "usedAt" timestamptz,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_quiz_movie_pool_imdbId" UNIQUE ("imdbId")
);

CREATE INDEX IF NOT EXISTS "idx_quiz_movie_pool_usedAt" ON "quiz_movie_pool" ("usedAt");

CREATE TABLE IF NOT EXISTS "daily_movie_quiz" (
  "id" SERIAL PRIMARY KEY,
  "date" date NOT NULL,
  "poolId" integer NOT NULL,
  "hints" jsonb NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_daily_movie_quiz_date" UNIQUE ("date"),
  CONSTRAINT "FK_daily_movie_quiz_poolId" FOREIGN KEY ("poolId") REFERENCES "quiz_movie_pool"("id") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS "quiz_attempt" (
  "id" SERIAL PRIMARY KEY,
  "userId" integer NOT NULL,
  "quizDate" date NOT NULL,
  "difficulty" varchar NOT NULL,
  "guesses" jsonb NOT NULL DEFAULT '[]',
  "isSolved" boolean NOT NULL DEFAULT false,
  "isFailed" boolean NOT NULL DEFAULT false,
  "completedAt" timestamptz,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "FK_quiz_attempt_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "UQ_quiz_attempt_userId_quizDate" UNIQUE ("userId", "quizDate")
);
