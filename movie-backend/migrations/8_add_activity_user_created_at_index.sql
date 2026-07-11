-- Supports the activity heatmap query, which always filters by userId and
-- a createdAt date range.
CREATE INDEX IF NOT EXISTS "IDX_activity_userId_createdAt" ON "activity" ("userId", "createdAt");
