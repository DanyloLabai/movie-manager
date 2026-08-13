// One-off cleanup: removes already-seeded Russian- and Indian-origin titles
// from `movie_embeddings` (swipe discovery pool) and `quiz_movie_pool`
// (daily quiz pool). Needed because those tables don't store language/
// country, so existing rows have to be re-checked against TMDB one by one.
// Going forward, seed-discovery-pool.js and seed-imdb-top500.js already
// filter these out at insert time (see lib/exclude-regions.js) — this
// script only cleans up what was seeded before that filter existed.
//
// quiz_movie_pool rows already used in a daily_movie_quiz can't be
// hard-deleted (ON DELETE RESTRICT keeps quiz history/answers intact), so
// those are flagged `excluded = true` instead — QuizService's pool-pick and
// pool-rotation queries both skip excluded rows, so they never get reused.
//
// Usage:
//   node scripts/clean-ru-in-movies.js            # dry run, just reports
//   node scripts/clean-ru-in-movies.js --execute   # actually deletes

require('dotenv').config();

const { Client } = require('pg');
const axios = require('axios');
const { isExcludedRegion } = require('./lib/exclude-regions');

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_REQUEST_DELAY_MS = 250;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchMovie(tmdbId, tmdbToken) {
  const { data } = await axios.get(`${TMDB_BASE_URL}/movie/${tmdbId}`, {
    headers: { Authorization: `Bearer ${tmdbToken}` },
  });
  return data;
}

async function run() {
  const execute = process.argv.includes('--execute');
  const tmdbToken = process.env.TMDB_API_TOKEN;
  if (!tmdbToken) {
    throw new Error('TMDB_API_TOKEN is not set in environment variables.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  const client = new Client(
    databaseUrl
      ? {
          connectionString: databaseUrl,
          ssl:
            process.env.NODE_ENV === 'production'
              ? { rejectUnauthorized: false }
              : false,
        }
      : {
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT) || 5432,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
        },
  );
  await client.connect();

  try {
    console.log(execute ? 'Running in EXECUTE mode (will delete rows).' : 'Running in DRY-RUN mode (no rows will be deleted; pass --execute to delete).');

    const embeddingRows = await client.query(
      `SELECT id, metadata->>'tmdbId' AS "tmdbId", metadata->>'title' AS title
       FROM movie_embeddings
       WHERE metadata->>'tmdbId' IS NOT NULL`,
    );
    const quizRows = await client.query(
      `SELECT id, "tmdbId", title FROM quiz_movie_pool`,
    );
    const usedQuizIds = new Set(
      (
        await client.query(`SELECT DISTINCT "poolId" FROM daily_movie_quiz`)
      ).rows.map((r) => r.poolId),
    );

    const byTmdbId = new Map(); // tmdbId (string) -> { title, embeddingIds: [], quizIds: [] }
    for (const row of embeddingRows.rows) {
      const key = String(row.tmdbId);
      if (!byTmdbId.has(key)) byTmdbId.set(key, { title: row.title, embeddingIds: [], quizIds: [] });
      byTmdbId.get(key).embeddingIds.push(row.id);
    }
    for (const row of quizRows.rows) {
      const key = String(row.tmdbId);
      if (!byTmdbId.has(key)) byTmdbId.set(key, { title: row.title, embeddingIds: [], quizIds: [] });
      byTmdbId.get(key).quizIds.push(row.id);
    }

    console.log(`Checking ${byTmdbId.size} unique TMDB titles against TMDB origin/language...`);

    const excludedEmbeddingIds = [];
    const deletableQuizIds = [];
    const flaggedQuizIds = [];
    let checked = 0;
    let excludedCount = 0;
    let notFound = 0;
    let errored = 0;

    for (const [tmdbId, entry] of byTmdbId) {
      checked++;
      try {
        const movie = await fetchMovie(tmdbId, tmdbToken);
        if (isExcludedRegion(movie)) {
          excludedCount++;
          excludedEmbeddingIds.push(...entry.embeddingIds);
          for (const quizId of entry.quizIds) {
            if (usedQuizIds.has(quizId)) flaggedQuizIds.push(quizId);
            else deletableQuizIds.push(quizId);
          }
          console.log(
            `  [${checked}/${byTmdbId.size}] Excluded: ${entry.title} (tmdbId ${tmdbId}, lang=${movie.original_language}, origin=${(movie.origin_country || []).join('/')})`,
          );
        }
      } catch (err) {
        if (err.response?.status === 404) {
          notFound++;
        } else {
          errored++;
          console.warn(`  [${checked}/${byTmdbId.size}] Failed to check tmdbId ${tmdbId}: ${err.message}`);
        }
      }
      await sleep(TMDB_REQUEST_DELAY_MS);
    }

    console.log(
      `\nChecked ${checked} titles: ${excludedCount} excluded (RU/IN), ${notFound} not found on TMDB, ${errored} errored.`,
    );
    console.log(
      `Would remove ${excludedEmbeddingIds.length} rows from movie_embeddings and ${deletableQuizIds.length} rows from quiz_movie_pool ` +
        `(plus flag ${flaggedQuizIds.length} more quiz_movie_pool rows as excluded — already used in a past daily_movie_quiz, can't be deleted).`,
    );

    if (execute) {
      if (excludedEmbeddingIds.length > 0) {
        await client.query(`DELETE FROM movie_embeddings WHERE id = ANY($1::uuid[])`, [excludedEmbeddingIds]);
      }
      if (deletableQuizIds.length > 0) {
        await client.query(`DELETE FROM quiz_movie_pool WHERE id = ANY($1::int[])`, [deletableQuizIds]);
      }
      if (flaggedQuizIds.length > 0) {
        await client.query(`UPDATE quiz_movie_pool SET excluded = true WHERE id = ANY($1::int[])`, [flaggedQuizIds]);
      }
      console.log('Deleted/flagged.');
    } else {
      console.log('Dry run only — re-run with --execute to actually delete these rows.');
    }
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
