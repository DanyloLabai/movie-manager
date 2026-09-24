import { useEffect, useState } from 'react';
import { getUpcomingMovies } from '../api/movies.api';

// Picks a random poster from the public /movies/upcoming endpoint to use as
// the Login/Register hero photo — that endpoint is the only movie listing
// that works pre-auth (see @Public() in movie-backend's MoviesController).
// Silently falls back to no image (solid background) on any failure.
export function useAuthBackdrop(): string | null {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const movies = await getUpcomingMovies();
        const withPoster = movies.filter((m) => m.posterUrl);
        if (withPoster.length === 0) return;
        const pick = withPoster[Math.floor(Math.random() * withPoster.length)];
        if (!cancelled) setUri(pick.posterUrl);
      } catch {
        // No backdrop — screens fall back to a solid background.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return uri;
}
