export class MovieResultDto {
  id: number;
  title: string;
  originalTitle: string;
  description: string;
  releaseYear: string;
  rating: number;
  posterUrl: string | null;
  mediaType: 'movie' | 'tv';
  releaseDate: string | null;
}
