CREATE TABLE IF NOT EXISTS "search_history" (
  "id" SERIAL PRIMARY KEY,
  "queryText" varchar NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "userId" integer NOT NULL,
  CONSTRAINT "FK_search_history_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_search_history_userId_createdAt" ON "search_history" ("userId", "createdAt");
