export class MovieDetailsResponse {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  vote_average: number;
  poster_path: string | null;
  backdrop_path: string | null;
  runtime: number;
  genres: { id: number; name: string }[];
  mediaType?: 'movie' | 'tv';
  [key: string]: unknown;
}
