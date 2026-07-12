CREATE TABLE IF NOT EXISTS "user_achievements" (
  "id" SERIAL PRIMARY KEY,
  "achievementId" varchar NOT NULL,
  "unlockedAt" TIMESTAMP NOT NULL DEFAULT now(),
  "userId" integer NOT NULL,
  CONSTRAINT "FK_user_achievements_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "UQ_user_achievements_userId_achievementId" UNIQUE ("userId", "achievementId")
);
