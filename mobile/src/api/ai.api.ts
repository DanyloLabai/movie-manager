import type {
  AiMoviesResponse,
  AiSearchResponse,
  AiUsage,
  ChatMessage,
} from '@movie-manager/shared';
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

// RN's FormData takes a { uri, name, type } descriptor rather than a Blob —
// same pattern as the avatar upload in users.api.ts / SettingsScreen.
export async function identifyPhoto(
  photo: { uri: string; name: string; type: string },
  note: string,
  lang: string,
): Promise<AiMoviesResponse> {
  const formData = new FormData();
  formData.append('photo', photo as unknown as Blob);
  if (note) formData.append('note', note);
  formData.append('lang', lang);
  const res = await api.post('/ai/identify-photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data as AiMoviesResponse;
}

// Capped per day server-side (TasteMatchDailyLimitGuard) — a 429 means the
// daily taste-match tries are used up.
export async function watchTogether(friendId: number): Promise<AiMoviesResponse> {
  const res = await api.post(`/ai/watch-together/${friendId}`);
  return res.data as AiMoviesResponse;
}
