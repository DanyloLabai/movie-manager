import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppNotification } from '@movie-manager/shared';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/movies.api';
import { getFriendRequests, acceptFriendRequest, declineFriendRequest, type FriendRequest } from '../../api/users.api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { formatTimeAgo } from '../../utils/time';
import { colors, spacing, radius, fontWeight } from '../../theme';
import type { MainStackParamList } from '../../navigation/MainStack';

type Props = NativeStackScreenProps<MainStackParamList, 'Notifications'>;

type FilterKey = 'all' | 'friends' | 'achievements' | 'releases';

const FILTER_TYPES: Record<FilterKey, AppNotification['type'][] | null> = {
  all: null,
  friends: ['friend_request', 'friend_accepted'],
  achievements: ['achievement'],
  releases: ['release'],
};

const FILTERS: { key: FilterKey }[] = [
  { key: 'all' },
  { key: 'friends' },
  { key: 'achievements' },
  { key: 'releases' },
];

const ICONS: Record<AppNotification['type'], keyof typeof Ionicons.glyphMap> = {
  release: 'film-outline',
  achievement: 'trophy-outline',
  friend_request: 'person-add-outline',
  friend_accepted: 'people-outline',
};

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface Group {
  key: 'today' | 'yesterday' | 'older';
  items: AppNotification[];
}

function groupByDate(items: AppNotification[]): Group[] {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const today: AppNotification[] = [];
  const yday: AppNotification[] = [];
  const older: AppNotification[] = [];

  for (const n of items) {
    const d = new Date(n.createdAt);
    if (isSameDay(d, now)) today.push(n);
    else if (isSameDay(d, yesterday)) yday.push(n);
    else older.push(n);
  }

  const groups: Group[] = [
    { key: 'today', items: today },
    { key: 'yesterday', items: yday },
    { key: 'older', items: older },
  ];
  return groups.filter((g) => g.items.length > 0);
}

// Row union so a single FlatList can render both friend-request cards and
// date-group headers/notification rows without two separate lists.
type ListRow =
  | { kind: 'requestsHeader' }
  | { kind: 'request'; request: FriendRequest }
  | { kind: 'groupHeader'; groupKey: 'today' | 'yesterday' | 'older' }
  | { kind: 'notification'; notification: AppNotification };

export default function NotificationsScreen({ navigation }: Props) {
  const { t } = useTranslation('social');
  const [items, setItems] = useState<AppNotification[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [processingRequestId, setProcessingRequestId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [notifs, reqs] = await Promise.all([getNotifications(), getFriendRequests()]);
      setItems(notifs);
      setRequests(reqs);
    } catch (err) {
      setError(getErrorMessage(err, t('notifications.loadError')));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handlePress = async (item: AppNotification) => {
    if (!item.isRead) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
      void markNotificationRead(item.id).catch(() => {});
    }
    if (item.tmdbId && item.mediaType) {
      navigation.navigate('MovieDetail', {
        movieId: item.tmdbId,
        title: item.title,
        mediaType: item.mediaType === 'tv' ? 'tv' : 'movie',
      });
    }
  };

  const handleMarkAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      void load();
    }
  };

  const handleAcceptRequest = async (id: number) => {
    setProcessingRequestId(id);
    try {
      await acceptFriendRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch {
      /* leave the row in place so the user can retry */
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleDeclineRequest = async (id: number) => {
    setProcessingRequestId(id);
    try {
      await declineFriendRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch {
      /* leave the row in place so the user can retry */
    } finally {
      setProcessingRequestId(null);
    }
  };

  const unreadCount = items.filter((n) => !n.isRead).length;
  const allowedTypes = FILTER_TYPES[activeFilter];
  const filteredNotifications = allowedTypes ? items.filter((n) => allowedTypes.includes(n.type)) : items;
  const showRequests = requests.length > 0 && (activeFilter === 'all' || activeFilter === 'friends');

  const rows: ListRow[] = [];
  if (showRequests) {
    rows.push({ kind: 'requestsHeader' });
    for (const r of requests) rows.push({ kind: 'request', request: r });
  }
  for (const group of groupByDate(filteredNotifications)) {
    rows.push({ kind: 'groupHeader', groupKey: group.key });
    for (const n of group.items) rows.push({ kind: 'notification', notification: n });
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTextGroup}>
          <Text style={styles.headerTitle}>{t('notifications.title').toUpperCase()}</Text>
          <Text style={styles.headerSubtitle}>{t('notifications.subtitle')}</Text>
        </View>
        {unreadCount > 0 ? (
          <Pressable style={styles.markAllButton} onPress={() => void handleMarkAllRead()}>
            <Text style={styles.markAllText}>{t('notifications.markAllRead').toUpperCase()}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable key={f.key} style={styles.filterTab} onPress={() => setActiveFilter(f.key)}>
            <Text style={[styles.filterTabText, activeFilter === f.key && styles.filterTabTextActive]}>
              {t(`notifications.filters.${f.key}`).toUpperCase()}
            </Text>
            {activeFilter === f.key ? <View style={styles.filterTabUnderline} /> : null}
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={rows}
        keyExtractor={(row, index) => {
          if (row.kind === 'request') return `request-${row.request.id}`;
          if (row.kind === 'notification') return `notif-${row.notification.id}`;
          return `${row.kind}-${index}`;
        }}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={40} color={colors.textFaint} />
            <Text style={styles.empty}>{t('notifications.nothingHereYet')}</Text>
          </View>
        }
        renderItem={({ item: row }) => {
          if (row.kind === 'requestsHeader') {
            return <Text style={styles.sectionLabel}>{t('notifications.friendRequests').toUpperCase()}</Text>;
          }
          if (row.kind === 'groupHeader') {
            return <Text style={styles.sectionLabel}>{t(`notifications.groups.${row.groupKey}`).toUpperCase()}</Text>;
          }
          if (row.kind === 'request') {
            const req = row.request;
            const isProcessing = processingRequestId === req.id;
            return (
              <View style={styles.requestRow}>
                {req.fromUser.avatarUrl ? (
                  <Image source={{ uri: req.fromUser.avatarUrl }} style={styles.requestAvatar} />
                ) : (
                  <View style={[styles.requestAvatar, styles.requestAvatarFallback]}>
                    <Text style={styles.requestAvatarInitial}>
                      {req.fromUser.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.requestName} numberOfLines={1}>
                  {req.fromUser.username}
                </Text>
                <Pressable
                  style={styles.requestAccept}
                  onPress={() => void handleAcceptRequest(req.id)}
                  disabled={isProcessing}
                >
                  <Ionicons name="checkmark" size={14} color={colors.textOnAccent} />
                </Pressable>
                <Pressable
                  style={styles.requestDecline}
                  onPress={() => void handleDeclineRequest(req.id)}
                  disabled={isProcessing}
                >
                  <Ionicons name="close" size={16} color={colors.textFaint} />
                </Pressable>
              </View>
            );
          }

          const item = row.notification;
          return (
            <Pressable style={styles.row} onPress={() => void handlePress(item)}>
              {!item.isRead ? <View style={styles.dot} /> : <View style={styles.dotSpacer} />}
              {item.posterUrl ? (
                <Image source={{ uri: item.posterUrl }} style={styles.thumb} />
              ) : (
                <View style={styles.thumbFallback}>
                  <Ionicons name={ICONS[item.type]} size={16} color={colors.accentBright} />
                </View>
              )}
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, item.isRead && styles.rowTitleRead]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.rowTimestamp}>{formatTimeAgo(item.createdAt)}</Text>
              </View>
              <Text style={styles.viewLabel}>{t('notifications.view').toUpperCase()}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  headerTextGroup: { flex: 1, gap: 2 },
  headerTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: fontWeight.bold, letterSpacing: 2 },
  headerSubtitle: { color: colors.textMuted, fontSize: 11.5 },
  markAllButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.12)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  markAllText: { color: colors.textMuted, fontSize: 9.5, fontWeight: fontWeight.semibold, letterSpacing: 1 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg - spacing.md,
    marginTop: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  filterTab: { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  filterTabText: { color: colors.textMuted, fontSize: 10.5, fontWeight: fontWeight.semibold, letterSpacing: 1 },
  filterTabTextActive: { color: colors.accentBright },
  filterTabUnderline: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, backgroundColor: colors.accentBright },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: spacing.sm },
  listContent: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingTop: spacing.xl * 2 },
  empty: { color: colors.textMuted },
  sectionLabel: {
    color: colors.textFaint,
    fontSize: 9.5,
    fontWeight: fontWeight.semibold,
    letterSpacing: 2,
    marginTop: spacing.sm,
    marginBottom: 2,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
  },
  requestAvatar: { width: 36, height: 36, borderRadius: 18 },
  requestAvatarFallback: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  requestAvatarInitial: { color: colors.textOnAccent, fontSize: 13, fontWeight: fontWeight.bold },
  requestName: { flex: 1, minWidth: 0, color: colors.textPrimary, fontSize: 13.5, fontWeight: fontWeight.semibold },
  requestAccept: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestDecline: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.accentBright },
  dotSpacer: { width: 7 },
  thumb: { width: 38, height: 38, borderRadius: 19 },
  thumbFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { color: colors.textPrimary, fontSize: 13.5 },
  rowTitleRead: { color: colors.textSubtle },
  rowTimestamp: { color: colors.textFaint, fontSize: 10.5 },
  viewLabel: { color: colors.accentBright, fontSize: 9.5, fontWeight: fontWeight.semibold, letterSpacing: 1 },
});
