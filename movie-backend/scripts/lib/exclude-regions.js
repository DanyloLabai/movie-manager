// Shared filter for keeping Russian- and Indian-origin titles out of the
// swipe discovery pool (movie_embeddings) and the daily quiz pool
// (quiz_movie_pool). Used by the seed scripts and by the one-off cleanup
// script that purges already-seeded matches.

// TMDB movie objects include origin_country (production country codes) on
// newer API responses; original_language is always present and catches
// older cached responses that predate origin_country.
const EXCLUDED_ORIGIN_COUNTRIES = new Set(['RU', 'IN']);
const EXCLUDED_LANGUAGES = new Set([
  'ru', // Russian
  'hi', 'ta', 'te', 'ml', 'kn', 'bn', 'mr', 'pa', 'gu', // Indian regional languages
]);

function isExcludedRegion(movie) {
  const originCountries = movie.origin_country || [];
  if (originCountries.some((c) => EXCLUDED_ORIGIN_COUNTRIES.has(c))) return true;
  return EXCLUDED_LANGUAGES.has(movie.original_language);
}

module.exports = { isExcludedRegion, EXCLUDED_ORIGIN_COUNTRIES, EXCLUDED_LANGUAGES };
