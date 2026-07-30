CREATE TABLE IF NOT EXISTS "swipe_actions" (
  "id" SERIAL PRIMARY KEY,
  "tmdbId" integer NOT NULL,
  "mediaType" varchar NOT NULL DEFAULT 'movie',
  "action" varchar NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "userId" integer NOT NULL,
  CONSTRAINT "FK_swipe_actions_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_swipe_actions_userId_createdAt" ON "swipe_actions" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "IDX_swipe_actions_userId_action_tmdbId" ON "swipe_actions" ("userId", "action", "tmdbId");
