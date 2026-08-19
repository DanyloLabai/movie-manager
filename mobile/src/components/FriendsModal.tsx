import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  acceptFriendRequest,
  declineFriendRequest,
  getFriendRequests,
  getFriendsFeed,
  removeFriend,
  searchUsers,
  addFriend,
  type Friend,
  type FriendRequest,
  type FeedItem,
  type SearchUser,
} from '../api/users.api';
import { colors, spacing, radius } from '../theme';
import type { MainStackParamList } from '../navigation/MainStack';

type Mode = 'list' | 'requests' | 'feed' | 'search';

interface FriendsModalProps {
  visible: boolean;
  friends: Friend[];
  onClose: () => void;
  onFriendsChange: (friends: Friend[]) => void;
}

function Avatar({ url, name, size = 38 }: { url: string | null; name: string; size?: number }) {
  return url ? (
    <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View
      style={[
        styles.avatarPlaceholder,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={styles.avatarInitial}>{name[0]?.toUpperCase()}</Text>
    </View>
  );
}

export default function FriendsModal({ visible, friends, onClose, onFriendsChange }: FriendsModalProps) {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [mode, setMode] = useState<Mode>('list');
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedLoaded, setFeedLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    getFriendRequests()
      .then(setRequests)
      .catch(() => {})
      .finally(() => setRequestsLoading(false));
  }, [visible]);

  useEffect(() => {
    if (mode !== 'feed' || feedLoaded) return;
    setFeedLoading(true);
    getFriendsFeed()
      .then(setFeedItems)
      .catch(() => {})
      .finally(() => {
        setFeedLoading(false);
        setFeedLoaded(true);
      });
  }, [mode, feedLoaded]);

  useEffect(() => {
    if (mode !== 'search') return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const timeout = setTimeout(() => {
      searchUsers(trimmed)
        .then(setSearchResults)
        .catch(() => {})
        .finally(() => setSearchLoading(false));
    }, 350);
    return () => clearTimeout(timeout);
  }, [searchQuery, mode]);

  const handleAccept = async (id: number) => {
    setBusyId(id);
    try {
      await acceptFriendRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      // Best-effort refresh — the accepted requester isn't in `friends` yet
      // locally, so refetching would need another round trip; the parent
      // will pick it up next time it reloads the profile.
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (id: number) => {
    setBusyId(id);
    try {
      await declineFriendRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (friendId: number) => {
    setBusyId(friendId);
    try {
      await removeFriend(friendId);
      onFriendsChange(friends.filter((f) => f.id !== friendId));
    } finally {
      setBusyId(null);
    }
  };

  const handleAdd = async (userId: number) => {
    setBusyId(userId);
    try {
      const result = await addFriend(userId);
      const accepted = result.status === 'accepted';
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, isFriend: accepted || u.isFriend, requestPending: !accepted }
            : u,
        ),
      );
    } finally {
      setBusyId(null);
    }
  };

  const goToUser = (userId: number) => {
    onClose();
    navigation.navigate('PublicProfile', { userId });
  };

  const tabs: Array<{ key: Mode; label: string; count?: number }> = [
    { key: 'list', label: 'Friends' },
    { key: 'requests', label: 'Requests', count: requests.length || undefined },
    { key: 'feed', label: 'Feed' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              FRIENDS <Text style={styles.headerCount}>· {friends.length}</Text>
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.tabRow}>
            {tabs.map((tab) => (
              <Pressable
                key={tab.key}
                style={[styles.tabPill, mode === tab.key && styles.tabPillActive]}
                onPress={() => setMode(tab.key)}
              >
                <Text style={[styles.tabPillText, mode === tab.key && styles.tabPillTextActive]}>
                  {tab.label}
                  {tab.count ? ` ${tab.count}` : ''}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.searchButton, mode === 'search' && styles.searchButtonActive]}
              onPress={() => setMode('search')}
            >
              <Ionicons
                name="search"
                size={16}
                color={mode === 'search' ? colors.accent : colors.textMuted}
              />
            </Pressable>
          </View>

          <View style={styles.body}>
            {mode === 'search' ? (
              <View style={styles.flexFill}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by username…"
                  placeholderTextColor={colors.textFaint}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
                {searchLoading ? (
                  <ActivityIndicator color={colors.accent} style={styles.loadingSpacer} />
                ) : (
                  <FlatList
                    data={searchResults}
                    keyExtractor={(u) => String(u.id)}
                    ListEmptyComponent={
                      searchQuery.trim().length < 2 ? null : (
                        <Text style={styles.emptyText}>No users found.</Text>
                      )
                    }
                    renderItem={({ item }) => (
                      <View style={styles.row}>
                        <Pressable style={styles.rowMain} onPress={() => goToUser(item.id)}>
                          <Avatar url={item.avatarUrl} name={item.username} />
                          <Text style={styles.rowName}>{item.username}</Text>
                        </Pressable>
                        {item.isFriend ? (
                          <Text style={styles.rowStatusText}>✓ Friends</Text>
                        ) : item.requestPending ? (
                          <Text style={styles.rowStatusTextMuted}>Sent</Text>
                        ) : (
                          <Pressable
                            style={styles.smallButton}
                            onPress={() => void handleAdd(item.id)}
                            disabled={busyId === item.id}
                          >
                            <Text style={styles.smallButtonText}>
                              {busyId === item.id ? '…' : 'ADD'}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    )}
                  />
                )}
              </View>
            ) : mode === 'requests' ? (
              requestsLoading ? (
                <ActivityIndicator color={colors.accent} style={styles.loadingSpacer} />
              ) : (
                <FlatList
                  data={requests}
                  keyExtractor={(r) => String(r.id)}
                  ListEmptyComponent={<Text style={styles.emptyText}>No pending requests.</Text>}
                  renderItem={({ item }) => (
                    <View style={styles.row}>
                      <Pressable
                        style={styles.rowMain}
                        onPress={() => goToUser(item.fromUser.id)}
                      >
                        <Avatar url={item.fromUser.avatarUrl} name={item.fromUser.username} />
                        <Text style={styles.rowName}>{item.fromUser.username}</Text>
                      </Pressable>
                      <View style={styles.requestActions}>
                        <Pressable
                          style={styles.acceptButton}
                          onPress={() => void handleAccept(item.id)}
                          disabled={busyId === item.id}
                        >
                          <Ionicons name="checkmark" size={14} color={colors.textOnAccent} />
                        </Pressable>
                        <Pressable
                          onPress={() => void handleDecline(item.id)}
                          disabled={busyId === item.id}
                          hitSlop={6}
                        >
                          <Ionicons name="close" size={18} color={colors.textFaint} />
                        </Pressable>
                      </View>
                    </View>
                  )}
                />
              )
            ) : mode === 'feed' ? (
              feedLoading ? (
                <ActivityIndicator color={colors.accent} style={styles.loadingSpacer} />
              ) : (
                <FlatList
                  data={feedItems}
                  keyExtractor={(f) => String(f.id)}
                  ListEmptyComponent={<Text style={styles.emptyText}>No recent activity.</Text>}
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.row}
                      onPress={() => {
                        onClose();
                        navigation.navigate('MovieDetail', {
                          movieId: item.tmdbId,
                          title: item.title,
                          mediaType: item.mediaType === 'tv' ? 'tv' : 'movie',
                        });
                      }}
                    >
                      <Avatar url={item.user.avatarUrl} name={item.user.username} />
                      <Text style={styles.feedText} numberOfLines={2}>
                        <Text style={styles.rowName}>{item.user.username}</Text>{' '}
                        <Text style={styles.rowStatusTextMuted}>{item.type.replace('_', ' ')}</Text>{' '}
                        <Text style={styles.rowStatusText}>{item.title}</Text>
                      </Text>
                      {item.posterUrl ? (
                        <Image source={{ uri: item.posterUrl }} style={styles.feedPoster} />
                      ) : null}
                    </Pressable>
                  )}
                />
              )
            ) : friends.length === 0 ? (
              <Text style={styles.emptyText}>No friends yet — try search.</Text>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(f) => String(f.id)}
                renderItem={({ item }) => (
                  <View style={styles.row}>
                    <Pressable style={styles.rowMain} onPress={() => goToUser(item.id)}>
                      <Avatar url={item.avatarUrl} name={item.username} />
                      <Text style={styles.rowName}>{item.username}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void handleRemove(item.id)}
                      disabled={busyId === item.id}
                      hitSlop={6}
                    >
                      <Ionicons name="close" size={18} color={colors.textFaint} />
                    </Pressable>
                  </View>
                )}
              />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surfaceMuted,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '80%',
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  headerCount: {
    color: colors.accentBright,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm + 4,
  },
  tabPill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  tabPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabPillText: {
    color: colors.textMuted,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tabPillTextActive: {
    color: colors.textOnAccent,
  },
  searchButton: {
    marginLeft: 'auto',
    width: 30,
    height: 30,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonActive: {
    borderColor: colors.accent,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    minHeight: 220,
  },
  flexFill: {
    flex: 1,
  },
  searchInput: {
    backgroundColor: colors.backgroundElevated,
    color: colors.textPrimary,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  loadingSpacer: {
    marginTop: spacing.lg,
  },
  emptyText: {
    color: colors.textFaint,
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowName: {
    color: colors.textPrimary,
    fontSize: 13.5,
    fontWeight: '600',
  },
  rowStatusText: {
    color: colors.accentBright,
    fontSize: 11,
    fontWeight: '700',
  },
  rowStatusTextMuted: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  acceptButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  smallButtonText: {
    color: colors.textOnAccent,
    fontSize: 10,
    fontWeight: '700',
  },
  feedText: {
    flex: 1,
    fontSize: 12.5,
  },
  feedPoster: {
    width: 32,
    height: 44,
    borderRadius: 4,
  },
  avatarPlaceholder: {
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.textOnAccent,
    fontSize: 15,
    fontWeight: '700',
  },
});
