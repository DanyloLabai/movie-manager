export interface TmdbCombinedCreditsCastDto {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  character?: string;
  popularity?: number;
}

export interface TmdbPersonRecordDto {
  id: number;
  name: string;
  biography: string;
  profile_path: string | null;
  birthday: string | null;
  place_of_birth: string | null;
  combined_credits: {
    cast: TmdbCombinedCreditsCastDto[];
  };
}
