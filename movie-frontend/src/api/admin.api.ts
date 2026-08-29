import { api } from "./index";

export interface AiUsageWindowStats {
  totalRequests: number;
  failoverRequests: number;
  failoverRate: number;
  byProvider: Array<{ provider: "groq" | "gemini"; count: number }>;
}

export interface AiUsageStats {
  last24h: AiUsageWindowStats;
  last7d: AiUsageWindowStats;
  last30d: AiUsageWindowStats;
}

export async function getAiUsageStats(): Promise<AiUsageStats> {
  const res = await api.get("/admin/ai-usage/stats");
  return res.data;
}

export interface FeedbackEntry {
  id: number;
  rating: number;
  message: string | null;
  createdAt: string;
  user: {
    id: number;
    username: string;
    email: string;
  };
}

export async function getFeedback(): Promise<FeedbackEntry[]> {
  const res = await api.get("/admin/feedback");
  return res.data;
}

export default {
  getAiUsageStats,
  getFeedback,
};
