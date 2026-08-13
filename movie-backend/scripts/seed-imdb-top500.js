// One-off seeder: builds the `quiz_movie_pool` table (source pool for the
// daily movie quiz) from IMDb's official non-commercial datasets, ranked
// with IMDb's own weighted-rating formula, then enriched via TMDB.
//
// Usage: npm run seed:quiz
//
// Safe to re-run: existing rows (matched by imdbId) are left untouched.
//
// Russian- and Indian-origin titles are excluded (see lib/exclude-regions.js).

require('dotenv').config();

const https = require('https');
const zlib = require('zlib');
const readline = require('readline');
const { Client } = require('pg');
const axios = require('axios');
const { isExcludedRegion } = require('./lib/exclude-regions');

const BASICS_URL = 'https://datasets.imdbws.com/title.basics.tsv.gz';
const RATINGS_URL = 'https://datasets.imdbws.com/title.ratings.tsv.gz';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const POOL_SIZE = 500;
const MIN_VOTES = 25000; // floor before a title is even eligible, like IMDb's Top 250 methodology
const TMDB_REQUEST_DELAY_MS = 250;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function streamTsvGz(url, onLine) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch ${url}: HTTP ${res.statusCode}`));
          return;
        }
        const gunzip = zlib.createGunzip();
        const rl = readline.createInterface({ input: res.pipe(gunzip) });
        let isFirstLine = true;
        rl.on('line', (line) => {
          if (isFirstLine) {
            isFirstLine = false;
            return; // header row
          }
          onLine(line.split('\t'));
        });
        rl.on('close', resolve);
        rl.on('error', reject);
      })
      .on('error', reject);
  });
}

async function buildTopPool() {
  console.log('Downloading and parsing title.basics.tsv.gz...');
  const basics = new Map(); // tconst -> { title, year }
  await streamTsvGz(BASICS_URL, (cols) => {
    const [tconst, titleType, primaryTitle, , isAdult, startYear] = cols;
    if (titleType !== 'movie' || isAdult === '1') return;
    basics.set(tconst, {
      title: primaryTitle,
      year: startYear === '\\N' ? null : parseInt(startYear, 10),
    });
  });
  console.log(`Parsed ${basics.size} movie titles.`);

  console.log('Downloading and parsing title.ratings.tsv.gz...');
  const candidates = [];
  let ratingSum = 0;
  let ratingCount = 0;
  await streamTsvGz(RATINGS_URL, (cols) => {
    const [tconst, averageRatingStr, numVotesStr] = cols;
    const basic = basics.get(tconst);
    if (!basic) return;
    const numVotes = parseInt(numVotesStr, 10);
    if (numVotes < MIN_VOTES) return;
    const averageRating = parseFloat(averageRatingStr);
    ratingSum += averageRating;
    ratingCount += 1;
    candidates.push({
      imdbId: tconst,
      title: basic.title,
      year: basic.year,
      rating: averageRating,
      votes: numVotes,
    });
  });

  const meanRating = ratingSum / ratingCount;
  console.log(
    `${candidates.length} titles pass the ${MIN_VOTES}-vote floor (mean rating ${meanRating.toFixed(2)}).`,
  );

  // IMDb's own weighted-rating (Bayesian average) formula:
  // WR = (v / (v + m)) * R + (m / (v + m)) * C
  for (const c of candidates) {
    c.weightedRating =
      (c.votes / (c.votes + MIN_VOTES)) * c.rating +
      (MIN_VOTES / (c.votes + MIN_VOTES)) * meanRating;
  }

  candidates.sort((a, b) => b.weightedRating - a.weightedRating);
  return candidates.slice(0, POOL_SIZE);
}

async function enrichWithTmdb(candidate, tmdbToken) {
  const headers = { Authorization: `Bearer ${tmdbToken}` };

  const findRes = await axios.get(`${TMDB_BASE_URL}/find/${candidate.imdbId}`, {
    headers,
    params: { external_source: 'imdb_id' },
  });
  const movie = findRes.data?.movie_results?.[0];
  if (!movie) return null;
  if (isExcludedRegion(movie)) return { excluded: true };

  const creditsRes = await axios.get(
    `${TMDB_BASE_URL}/movie/${movie.id}/credits`,
    { headers },
  );
  const cast = (creditsRes.data?.cast || [])
    .slice(0, 5)
    .map((c) => ({ name: c.name, character: c.character || undefined }));
  const director = (creditsRes.data?.crew || []).find(
    (c) => c.job === 'Director',
  )?.name;

  return {
    tmdbId: movie.id,
    title: movie.title || candidate.title,
    releaseYear:
      candidate.year ??
      (movie.release_date
        ? parseInt(movie.release_date.slice(0, 4), 10)
        : null),
    posterPath: movie.poster_path || null,
    genres: movie.genre_ids || [],
    overview: movie.overview || null,
    cast,
    director: director || null,
  };
}

async function run() {
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
    const top500 = await buildTopPool();
    console.log(
      `Selected top ${top500.length} candidates. Enriching via TMDB...`,
    );

    let inserted = 0;
    let skipped = 0;
    let skippedRegion = 0;
    for (let i = 0; i < top500.length; i++) {
      const candidate = top500[i];
      try {
        const enriched = await enrichWithTmdb(candidate, tmdbToken);
        if (enriched?.excluded) {
          console.log(
            `  [${i + 1}/${top500.length}] Excluded (RU/IN origin): ${candidate.title}`,
          );
          skippedRegion++;
          continue;
        }
        if (!enriched) {
          console.warn(
            `  [${i + 1}/${top500.length}] No TMDB match for ${candidate.imdbId} (${candidate.title})- skipped.`,
          );
          skipped++;
          continue;
        }

        const result = await client.query(
          `INSERT INTO "quiz_movie_pool"
             ("imdbId", "tmdbId", "title", "releaseYear", "posterPath", "genres", "overview", "cast", "director")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT ("imdbId") DO NOTHING`,
          [
            candidate.imdbId,
            enriched.tmdbId,
            enriched.title,
            enriched.releaseYear,
            enriched.posterPath,
            enriched.genres,
            enriched.overview,
            JSON.stringify(enriched.cast),
            enriched.director,
          ],
        );
        if (result.rowCount > 0) {
          inserted++;
          console.log(
            `  [${i + 1}/${top500.length}] Added: ${enriched.title} (${enriched.releaseYear ?? '?'})`,
          );
        } else {
          console.log(
            `  [${i + 1}/${top500.length}] Already in pool: ${enriched.title}`,
          );
        }
      } catch (err) {
        console.warn(
          `  [${i + 1}/${top500.length}] Failed for ${candidate.imdbId} (${candidate.title}): ${err.message}`,
        );
        skipped++;
      }
      await sleep(TMDB_REQUEST_DELAY_MS);
    }

    console.log(
      `Done. Inserted ${inserted} new movies, skipped ${skipped}, excluded (RU/IN) ${skippedRegion}.`,
    );
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
