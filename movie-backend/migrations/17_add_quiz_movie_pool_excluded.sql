-- Marks quiz_movie_pool rows that must never be picked again (e.g. RU/IN
-- titles found by scripts/clean-ru-in-movies.js). Rows already referenced
-- by daily_movie_quiz can't be hard-deleted (ON DELETE RESTRICT), so they're
-- flagged instead; QuizService's pool-selection and pool-rotation queries
-- both filter on this column so flagged rows never re-enter rotation.
ALTER TABLE "quiz_movie_pool"
  ADD COLUMN IF NOT EXISTS "excluded" boolean NOT NULL DEFAULT false;
