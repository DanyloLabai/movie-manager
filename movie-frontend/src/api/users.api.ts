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

export default {
  getPublicProfile,
  updateProfile,
  getFriends,
  addFriend,
  removeFriend,
  searchUsers,
  getFriendsFeed,
};
