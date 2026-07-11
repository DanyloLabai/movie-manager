CREATE TABLE IF NOT EXISTS "ai_usage_log" (
  "id" SERIAL PRIMARY KEY,
  "userId" integer NOT NULL,
  "provider" varchar NOT NULL,
  "wasFailover" boolean NOT NULL DEFAULT false,
  "requestType" varchar NOT NULL,
  "tokenCount" integer,
  "latencyMs" integer,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_ai_usage_log_createdAt" ON "ai_usage_log" ("createdAt");
