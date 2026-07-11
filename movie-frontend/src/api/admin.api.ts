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

export default {
  getAiUsageStats,
};
