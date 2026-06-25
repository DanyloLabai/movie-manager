export class TmdbMovieDto {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  vote_average: number;
  poster_path: string | null;
}

export class TmdbSearchResponseDto {
  page: number;
  results: TmdbMovieDto[];
  total_pages: number;
  total_results: number;
}
