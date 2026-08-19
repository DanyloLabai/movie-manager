import type { AiSearchResponse, AiUsage, ChatMessage } from '@movie-manager/shared';
import { api } from './client';

export async function getHistory(): Promise<ChatMessage[]> {
  const res = await api.get('/ai/history');
  return res.data as ChatMessage[];
}

export async function postHistory(messages: ChatMessage[]): Promise<{ success: boolean }> {
  const res = await api.post('/ai/history', { messages });
  return res.data as { success: boolean };
}

export async function aiSearch(payload: {
  messages: ChatMessage[];
  shownMovieIds?: number[];
}): Promise<AiSearchResponse> {
  const res = await api.post('/ai/search', payload);
  return res.data as AiSearchResponse;
}

export async function getUsage(): Promise<AiUsage> {
  const res = await api.get('/ai/usage');
  return res.data as AiUsage;
}
