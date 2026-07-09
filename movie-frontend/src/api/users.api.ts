import { api } from "./index";

export async function getPublicProfile(userId: string | number) {
  const res = await api.get(`/users/public/${userId}?_t=${Date.now()}`);
  return res.data;
}

export async function updateProfile(formData: FormData) {
  const res = await api.patch(`/users/profile`, formData);
  return res.data;
}

export async function getFriends() {
  const res = await api.get(`/users/friends`);
  return res.data;
}

export async function addFriend(userId: string | number) {
  const res = await api.post(`/users/friends/${userId}`);
  return res.data;
}

export async function removeFriend(friendId: number) {
  const res = await api.delete(`/users/friends/${friendId}`);
  return res.data;
}

export async function searchUsers(query: string) {
  const res = await api.get(`/users/search`, { params: { query } });
  return res.data;
}

export async function getFriendsFeed(before?: string) {
  const res = await api.get(`/users/friends/feed`, {
    params: before ? { before } : undefined,
  });
  return res.data;
}

export async function getTasteCompatibility(userId: string | number) {
  const res = await api.get(`/users/public/${userId}/compatibility`);
  return res.data;
}

export type FriendRequest = {
  id: number;
  createdAt: string;
  fromUser: { id: number; username: string; avatarUrl: string | null };
};

export async function getFriendRequests(): Promise<FriendRequest[]> {
  const res = await api.get(`/users/friend-requests`);
  return res.data;
}

export async function acceptFriendRequest(requestId: number) {
  const res = await api.post(`/users/friend-requests/${requestId}/accept`);
  return res.data;
}

export async function declineFriendRequest(requestId: number) {
  const res = await api.post(`/users/friend-requests/${requestId}/decline`);
  return res.data;
}

export async function deleteAccount() {
  const res = await api.delete(`/users/me`);
  return res.data;
}

export default {
  getPublicProfile,
  updateProfile,
  getFriends,
  addFriend,
  removeFriend,
  searchUsers,
  getFriendsFeed,
  getTasteCompatibility,
  getFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  deleteAccount,
};
