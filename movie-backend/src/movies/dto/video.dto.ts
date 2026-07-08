export interface TmdbVideoDto {
  site: string;
  type: string;
  key: string;
}

export interface TmdbVideosWrapperDto {
  results: TmdbVideoDto[];
}

export interface TmdbWatchProviderEntryDto {
  logo_path: string;
  provider_id: number;
  provider_name: string;
  display_priority: number;
}

export interface TmdbWatchProviderDto {
  link?: string;
  flatrate?: TmdbWatchProviderEntryDto[];
  rent?: TmdbWatchProviderEntryDto[];
  buy?: TmdbWatchProviderEntryDto[];
}

export interface TmdbWatchProvidersWrapperDto {
  results: Record<string, TmdbWatchProviderDto>;
}
