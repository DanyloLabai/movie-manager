import { MovieResultDto } from '../../movies/dto/movie-result.dto';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  movies?: MovieResultDto[];
}
