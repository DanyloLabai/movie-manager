CREATE TABLE IF NOT EXISTS "feedback" (
  "id" SERIAL PRIMARY KEY,
  "rating" smallint NOT NULL,
  "message" text,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "userId" integer NOT NULL,
  CONSTRAINT "FK_feedback_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_feedback_createdAt" ON "feedback" ("createdAt");
