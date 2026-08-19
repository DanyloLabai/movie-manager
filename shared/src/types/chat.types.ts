import type { MovieResult } from './movie.types';

// Mirrors movie-backend/src/ai-chat/interfaces/chat-message.interface.ts —
// the backend only ever sends/persists role 'user' | 'assistant'. Frontend's
// local AIMessage type adds a 'system' role and a `reasoning` field that
// don't exist in the actual /ai/history persisted contract; if mobile wants a
// transient "system" bubble in its chat UI, that's a mobile-local display
// type, not part of this shared wire type.
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  movies?: MovieResult[];
}

export interface RecommendationReason {
  preferenceText: string;
  similarityScore: number;
}

// Response shape of POST /ai/search (movie-frontend/src/api/ai.api.ts) —
// there's no backend DTO class for this, inferred from actual usage.
export interface AiSearchResponse {
  message?: string;
  movies?: MovieResult[];
  reasoning?: RecommendationReason[];
}

export interface AiUsage {
  requestCount: number;
  totalTokens: number;
  requestLimit: number;
  tokenLimit: number;
}
