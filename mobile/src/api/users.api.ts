import type { ProfileData } from '@movie-manager/shared';
import { api } from './client';

export interface Friend {
  id: number;
  username: string;
  avatarUrl: string | null;
}

export async function getFriends(): Promise<Friend[]> {
  const res = await api.get('/users/friends');
  return res.data as Friend[];
}

export async function addFriend(userId: number): Promise<{ status: 'pending' | 'accepted' }> {
  const res = await api.post(`/users/friends/${userId}`);
  return res.data as { status: 'pending' | 'accepted' };
}

export async function removeFriend(friendId: number): Promise<void> {
  await api.delete(`/users/friends/${friendId}`);
}

export interface SearchUser {
  id: number;
  username: string;
  avatarUrl: string | null;
  isFriend: boolean;
  requestPending?: boolean;
}

export async function searchUsers(query: string): Promise<SearchUser[]> {
  const res = await api.get('/users/search', { params: { query } });
  return (res.data as SearchUser[]) ?? [];
}

export type ActivityActionType = 'watched' | 'rated' | 'added_watchlist' | 'favorited';

export interface ActivityDayAction {
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  mediaType: string;
  actionType: ActivityActionType;
  rating: number | null;
}

export interface ActivityDay {
  date: string;
  count: number;
  actions: ActivityDayAction[];
}

export async function getActivityHeatmap(year: number): Promise<ActivityDay[]> {
  const res = await api.get('/users/me/activity', { params: { year } });
  return (res.data as ActivityDay[]) ?? [];
}

export interface FeedItem {
  id: number;
  type: ActivityActionType;
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  mediaType: string;
  rating: number | null;
  createdAt: string;
  user: { id: number; username: string; avatarUrl: string | null };
}

export async function getFriendsFeed(before?: string): Promise<FeedItem[]> {
  const res = await api.get('/users/friends/feed', { params: before ? { before } : undefined });
  return (res.data as FeedItem[]) ?? [];
}

export interface FriendRequest {
  id: number;
  createdAt: string;
  fromUser: { id: number; username: string; avatarUrl: string | null };
}

export async function getFriendRequests(): Promise<FriendRequest[]> {
  const res = await api.get('/users/friend-requests');
  return (res.data as FriendRequest[]) ?? [];
}

export async function acceptFriendRequest(requestId: number): Promise<void> {
  await api.post(`/users/friend-requests/${requestId}/accept`);
}

export async function declineFriendRequest(requestId: number): Promise<void> {
  await api.post(`/users/friend-requests/${requestId}/decline`);
}

// GET /users/public/:id returns the same shape as getProfileData()
// (movie-backend/src/movies/movies.service.ts) plus these two fields.
export type PublicProfile = ProfileData & {
  isFriend: boolean;
  requestPending: boolean;
};

export async function getPublicProfile(userId: number): Promise<PublicProfile> {
  const res = await api.get(`/users/public/${userId}`);
  return res.data as PublicProfile;
}

export async function deleteAccount(): Promise<void> {
  await api.delete('/users/me');
}

export interface SearchHistoryItem {
  queryText: string;
  createdAt: string;
}

export async function getSearchHistory(limit = 10): Promise<SearchHistoryItem[]> {
  const res = await api.get('/users/me/search-history', { params: { limit } });
  return (res.data as SearchHistoryItem[]) ?? [];
}

export async function clearSearchHistory(): Promise<void> {
  await api.delete('/users/me/search-history');
}

export interface FriendLastWatched {
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  mediaType: string;
  rating: number | null;
  watchedAt: string | null;
  user: { id: number; username: string; avatarUrl: string | null };
}

export async function getFriendsLastWatched(): Promise<FriendLastWatched[]> {
  const res = await api.get('/users/friends/last-watched');
  return (res.data as FriendLastWatched[]) ?? [];
}

export async function updateProfile(
  formData: FormData,
): Promise<Pick<ProfileData, 'username' | 'avatarUrl'>> {
  const res = await api.patch('/users/profile', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data as Pick<ProfileData, 'username' | 'avatarUrl'>;
}
