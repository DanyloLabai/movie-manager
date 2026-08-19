import type { AuthUser } from '@movie-manager/shared';
import { api } from './client';

export interface SignInResponse {
  access_token: string;
  // Only present because this client sends X-Client-Platform: mobile — see
  // movie-backend/src/auth/auth.controller.ts.
  refresh_token?: string;
  user: AuthUser;
}

export async function signIn(body: {
  email: string;
  password: string;
}): Promise<SignInResponse> {
  const res = await api.post('/auth/signin', body);
  return res.data as SignInResponse;
}

export async function signUp(body: {
  username: string;
  email: string;
  password: string;
  captchaToken?: string | null;
}): Promise<{ message: string }> {
  const res = await api.post('/auth/signup', body);
  return res.data as { message: string };
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export async function changePassword(body: {
  oldPassword: string;
  newPassword: string;
}): Promise<{ message: string }> {
  const res = await api.patch('/auth/change-password', body);
  return res.data as { message: string };
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const res = await api.post('/auth/forgot-password', { email });
  return res.data as { message: string };
}

export async function resetPassword(body: {
  token: string;
  newPassword: string;
}): Promise<{ message: string }> {
  const res = await api.patch('/auth/reset-password', body);
  return res.data as { message: string };
}
