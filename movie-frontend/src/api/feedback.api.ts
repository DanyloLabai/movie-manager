import { api } from "./index";

export interface SubmitFeedbackPayload {
  rating: number;
  message?: string;
}

export async function submitFeedback(
  payload: SubmitFeedbackPayload,
): Promise<{ success: true }> {
  const res = await api.post("/feedback", payload);
  return res.data as { success: true };
}

export async function getMyFeedbackStatus(): Promise<{
  hasSubmitted: boolean;
}> {
  const res = await api.get("/feedback/mine");
  return res.data as { hasSubmitted: boolean };
}

export default { submitFeedback, getMyFeedbackStatus };
