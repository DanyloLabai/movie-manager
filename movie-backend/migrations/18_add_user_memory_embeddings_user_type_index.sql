-- Speeds up per-user preference lookups (VectorService.saveUserFact,
-- consolidateUserPreferences, getRelevantUserFactsWithScores), which all
-- filter user_memory_embeddings by metadata->>'userId' (and usually also
-- metadata->>'type'). Previously an unindexed full-table scan on every call.
CREATE INDEX IF NOT EXISTS "IDX_user_memory_embeddings_userId_type"
  ON "user_memory_embeddings" ((metadata->>'userId'), (metadata->>'type'));
