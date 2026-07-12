ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "type" varchar NOT NULL DEFAULT 'release';
ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "body" text;
ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "url" varchar;
ALTER TABLE "notification" ALTER COLUMN "tmdbId" DROP NOT NULL;
ALTER TABLE "notification" ALTER COLUMN "mediaType" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "IDX_notification_userId_createdAt" ON "notification" ("userId", "createdAt");
