export class TmdbTvDetailsResponse {
  id: number;
  name: string;
  overview: string;
  first_air_date: string;
  vote_average: number;
  poster_path: string | null;
  backdrop_path: string | null;
  episode_run_time?: number[];
  genres: { id: number; name: string }[];
}
