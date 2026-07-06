import { api } from "./index";

export async function login(body: { email: string; password: string }) {
  const res = await api.post("/auth/signin", body);
  return res.data;
}

export async function register(body: {
  username: string;
  email: string;
  password: string;
  captchaToken?: string | null;
}) {
  const res = await api.post("/auth/signup", body);
  return res.data;
}

export async function verifyEmailGet(token: string) {
  const res = await api.get(
    `/auth/verify-email?token=${encodeURIComponent(token)}`,
  );
  return res.data;
}

export async function resendVerification(email: string) {
  const res = await api.post(`/auth/resend-verification`, { email });
  return res.data;
}

export async function forgotPassword(email: string) {
  const res = await api.post(`/auth/forgot-password`, { email });
  return res.data;
}

export async function resetPassword(body: {
  token: string;
  newPassword: string;
}) {
  const res = await api.patch(`/auth/reset-password`, body);
  return res.data;
}

export async function changePassword(body: {
  oldPassword: string;
  newPassword: string;
}) {
  const res = await api.patch(`/auth/change-password`, body);
  return res.data;
}

export async function refreshToken() {
  const res = await api.post(`/auth/refresh`);
  return res.data;
}

export async function logout() {
  const res = await api.post(`/auth/logout`);
  return res.data;
}

export default {
  login,
  register,
  verifyEmailGet,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  refreshToken,
  logout,
};
