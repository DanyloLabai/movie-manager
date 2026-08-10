// One-off seeder: fills `movie_embeddings` with a wide pool of popular movies
// (~2500, sorted by TMDB popularity/vote_count) so the swipe discovery feed
// has enough breadth for its "diverse/exploratory" picks not to repeat
// quickly. This is a different, wider pool than `seed-imdb-top500.js`
// (which builds the curated 500-title `quiz_movie_pool` for the daily quiz).
//
// Usage: npm run seed:discovery
//
// Safe to re-run: movies already present in movie_embeddings (matched by
// metadata->>'tmdbId') are skipped before spending a Gemini embedding call.

require('dotenv').config();

const { Client } = require('pg');
const axios = require('axios');

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const GEMINI_EMBED_URL =
  'https://generativelanguage.googleapis.com/v1/models/gemini-embedding-2:embedContent';
const TARGET_POOL_SIZE = 2500;
const MIN_VOTE_COUNT = 100;
const TMDB_REQUEST_DELAY_MS = 250;
const GEMINI_REQUEST_DELAY_MS = 400;
const GEMINI_MAX_RETRIES = 5;
const MOVIES_PER_PAGE = 20;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchGenreMap(tmdbToken) {
  const { data } = await axios.get(`${TMDB_BASE_URL}/genre/movie/list`, {
    headers: { Authorization: `Bearer ${tmdbToken}` },
    params: { language: 'en-US' },
  });
  const map = new Map();
  for (const g of data.genres || []) map.set(g.id, g.name);
  return map;
}

async function fetchDiscoverPage(tmdbToken, page) {
  const { data } = await axios.get(`${TMDB_BASE_URL}/discover/movie`, {
    headers: { Authorization: `Bearer ${tmdbToken}` },
    params: {
      language: 'en-US',
      sort_by: 'popularity.desc',
      'vote_count.gte': MIN_VOTE_COUNT,
      include_adult: false,
      page,
    },
  });
  return data.results || [];
}

async function embed(text, geminiApiKey, attempt = 1) {
  try {
    const res = await axios.post(
      `${GEMINI_EMBED_URL}?key=${geminiApiKey}`,
      {
        model: 'models/gemini-embedding-2',
        content: { parts: [{ text }] },
      },
      { headers: { 'Content-Type': 'application/json' } },
    );
    return res.data.embedding.values;
  } catch (err) {
    const status = err.response?.status;
    if (status === 429 && attempt < GEMINI_MAX_RETRIES) {
      const retryAfterHeader = Number(err.response?.headers?.['retry-after']);
      const backoffMs =
        Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
          ? retryAfterHeader * 1000
          : Math.min(30000, 1000 * 2 ** attempt); // 2s, 4s, 8s, 16s, capped at 30s
      await sleep(backoffMs);
      return embed(text, geminiApiKey, attempt + 1);
    }
    throw err;
  }
}

async function run() {
  const tmdbToken = process.env.TMDB_API_TOKEN;
  if (!tmdbToken) {
    throw new Error('TMDB_API_TOKEN is not set in environment variables.');
  }
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment variables.');
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
    console.log('Fetching TMDB genre list...');
    const genreMap = await fetchGenreMap(tmdbToken);

    const totalPages = Math.ceil(TARGET_POOL_SIZE / MOVIES_PER_PAGE);
    console.log(
      `Fetching ~${TARGET_POOL_SIZE} candidates from TMDB /discover across ${totalPages} pages...`,
    );

    let inserted = 0;
    let skippedExisting = 0;
    let skippedError = 0;
    let processed = 0;

    for (let page = 1; page <= totalPages; page++) {
      let results;
      try {
        results = await fetchDiscoverPage(tmdbToken, page);
      } catch (err) {
        console.warn(
          `  Page ${page}: failed to fetch (${err.message}) — skipping page.`,
        );
        await sleep(TMDB_REQUEST_DELAY_MS);
        continue;
      }
      await sleep(TMDB_REQUEST_DELAY_MS);

      if (results.length === 0) break;

      for (const movie of results) {
        processed++;
        try {
          if (!movie.poster_path || !movie.overview) continue;

          const existing = await client.query(
            `SELECT 1 FROM movie_embeddings WHERE metadata->>'tmdbId' = $1 LIMIT 1`,
            [String(movie.id)],
          );
          if ((existing.rowCount ?? 0) > 0) {
            skippedExisting++;
            continue;
          }

          const genreIds = movie.genre_ids || [];
          const genreNames = genreIds
            .map((id) => genreMap.get(id))
            .filter(Boolean);
          const text = `Title: ${movie.title}. Description: ${movie.overview}. Genres: ${genreNames.join(', ')}.`;

          const embedding = await embed(text, geminiApiKey);
          await sleep(GEMINI_REQUEST_DELAY_MS);

          const metadata = {
            tmdbId: movie.id,
            title: movie.title,
            mediaType: 'movie',
          };
          const releaseYear = movie.release_date
            ? parseInt(movie.release_date.split('-')[0], 10) || null
            : null;

          await client.query(
            `INSERT INTO movie_embeddings
               (text, embedding, metadata, genre_ids, release_year, vote_average, runtime, media_type)
             VALUES ($1, $2::vector, $3, $4, $5, $6, NULL, $7)`,
            [
              text,
              JSON.stringify(embedding),
              JSON.stringify(metadata),
              genreIds,
              releaseYear,
              movie.vote_average ?? null,
              'movie',
            ],
          );
          inserted++;
          if (inserted % 50 === 0) {
            console.log(
              `  ...${inserted} inserted so far (page ${page}/${totalPages})`,
            );
          }
        } catch (err) {
          skippedError++;
          console.warn(
            `  Failed for tmdbId ${movie.id} (${movie.title}): ${err.message}`,
          );
        }
      }
    }

    console.log(
      `Done. Processed ${processed} candidates — inserted ${inserted}, already present ${skippedExisting}, errored ${skippedError}.`,
    );
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
