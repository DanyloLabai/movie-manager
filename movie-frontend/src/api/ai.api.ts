import { api } from "./index";
import type { MovieResult } from "../types/movie.types";

export type AIMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AIHistoryEntry = {
  id: number;
  messages: AIMessage[];
  createdAt?: string;
};

export async function getHistory(): Promise<AIHistoryEntry[]> {
  const res = await api.get("/ai/history");
  return res.data as AIHistoryEntry[];
}

export async function postHistory(
  messages: AIMessage[],
): Promise<AIHistoryEntry> {
  const res = await api.post("/ai/history", { messages });
  return res.data as AIHistoryEntry;
}

export async function aiSearch(payload: {
  messages: AIMessage[];
  shownMovieIds?: number[];
}): Promise<{ message?: string; movies?: MovieResult[] }> {
  const res = await api.post("/ai/search", payload);
  return res.data as { message?: string; movies?: MovieResult[] };
}

export default { getHistory, postHistory, aiSearch };
