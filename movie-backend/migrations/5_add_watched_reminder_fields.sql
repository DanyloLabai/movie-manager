ALTER TABLE "watchlist" ADD COLUMN IF NOT EXISTS "watchedAt" TIMESTAMPTZ;

UPDATE "watchlist" SET "watchedAt" = "updatedAt" WHERE "isWatched" = true AND "watchedAt" IS NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastReminderSentAt" TIMESTAMPTZ;
