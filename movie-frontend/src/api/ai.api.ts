import { api } from "./index";
import type { MovieResult } from "../types/movie.types";

export type RecommendationReason = {
  preferenceText: string;
  similarityScore: number;
};

export type AIMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  movies?: MovieResult[];
  reasoning?: RecommendationReason[];
};

export async function getHistory(): Promise<AIMessage[]> {
  const res = await api.get("/ai/history");
  return res.data as AIMessage[];
}

export async function postHistory(
  messages: AIMessage[],
): Promise<{ success: boolean }> {
  const res = await api.post("/ai/history", { messages });
  return res.data as { success: boolean };
}

export async function aiSearch(payload: {
  messages: AIMessage[];
  shownMovieIds?: number[];
}): Promise<{
  message?: string;
  movies?: MovieResult[];
  reasoning?: RecommendationReason[];
}> {
  const res = await api.post("/ai/search", payload);
  return res.data as {
    message?: string;
    movies?: MovieResult[];
    reasoning?: RecommendationReason[];
  };
}

export async function watchTogether(
  friendId: number,
): Promise<{ message?: string; movies?: MovieResult[] }> {
  const res = await api.post(`/ai/watch-together/${friendId}`);
  return res.data as { message?: string; movies?: MovieResult[] };
}

export type AiUsage = {
  requestCount: number;
  totalTokens: number;
  requestLimit: number;
  tokenLimit: number;
};

export async function getUsage(): Promise<AiUsage> {
  const res = await api.get("/ai/usage");
  return res.data as AiUsage;
}

export default { getHistory, postHistory, aiSearch, watchTogether, getUsage };
