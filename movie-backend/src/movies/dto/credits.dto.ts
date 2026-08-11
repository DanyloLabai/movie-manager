import { CastMemberDto } from './cast-member.dto';
import {
  TmdbVideosWrapperDto,
  TmdbWatchProvidersWrapperDto,
} from './video.dto';

export interface TmdbCrewMemberDto {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TmdbCreditsDto {
  cast: CastMemberDto[];
  crew: TmdbCrewMemberDto[];
}

export interface TmdbAppendedFieldsDto {
  videos: TmdbVideosWrapperDto;
  'watch/providers': TmdbWatchProvidersWrapperDto;
  credits: TmdbCreditsDto;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
}
