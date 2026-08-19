import { api } from './client';

export async function subscribeExpoPush(token: string): Promise<void> {
  await api.post('/push/subscribe-expo', { token });
}

export async function unsubscribeExpoPush(token: string): Promise<void> {
  await api.delete('/push/subscribe', { data: { endpoint: token } });
}
