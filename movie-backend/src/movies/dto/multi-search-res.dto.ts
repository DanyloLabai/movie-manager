export class TmdbMultiSearchResultDto {
  id: number;
  media_type: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  poster_path: string | null;
  original_language: string;
  vote_count: number;
  genre_ids?: number[];
}

export class TmdbMultiSearchResponseDto {
  results: TmdbMultiSearchResultDto[];
}
