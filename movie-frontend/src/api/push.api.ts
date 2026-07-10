import { api } from "./index";

export async function getPublicKey(): Promise<string> {
  const res = await api.get("/push/public-key");
  return res.data?.publicKey || "";
}

export async function subscribe(subscription: PushSubscriptionJSON): Promise<void> {
  await api.post("/push/subscribe", subscription);
}

export async function unsubscribe(endpoint: string): Promise<void> {
  await api.delete("/push/subscribe", { data: { endpoint } });
}

export default { getPublicKey, subscribe, unsubscribe };
