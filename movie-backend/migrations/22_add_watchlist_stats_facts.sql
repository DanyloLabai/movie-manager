ALTER TABLE "watchlist" ADD COLUMN IF NOT EXISTS "runtimeMinutes" integer;
ALTER TABLE "watchlist" ADD COLUMN IF NOT EXISTS "episodeCount" integer;
ALTER TABLE "watchlist" ADD COLUMN IF NOT EXISTS "genres" text[];
ALTER TABLE "watchlist" ADD COLUMN IF NOT EXISTS "rewatchCount" integer NOT NULL DEFAULT 0;

UPDATE "watchlist" w
SET "rewatchCount" = sub.cnt
FROM (
  SELECT "userId", "tmdbId", COUNT(*)::int AS cnt
  FROM "activity"
  WHERE "type" = 'rewatched'
  GROUP BY "userId", "tmdbId"
) sub
WHERE w."userId" = sub."userId"
  AND w."tmdbId" = sub."tmdbId"
  AND w."rewatchCount" = 0;
