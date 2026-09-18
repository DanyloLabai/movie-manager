CREATE TABLE IF NOT EXISTS "watch_together_picks" (
  "id" SERIAL PRIMARY KEY,
  "userIdLow" integer NOT NULL,
  "userIdHigh" integer NOT NULL,
  "tmdbId" integer NOT NULL,
  "mediaType" varchar NOT NULL,
  "title" varchar NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_watch_together_picks_pair_movie" UNIQUE ("userIdLow", "userIdHigh", "tmdbId", "mediaType")
);

CREATE INDEX IF NOT EXISTS "IDX_watch_together_picks_pair" ON "watch_together_picks" ("userIdLow", "userIdHigh");
