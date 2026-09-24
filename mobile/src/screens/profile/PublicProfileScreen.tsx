import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MovieResult, WatchlistItem } from '@movie-manager/shared';
import {
  addFriend,
  getPublicFavorites,
  getPublicProfile,
  getPublicWatched,
  getTasteCompatibility,
  type PublicProfile,
  type TasteCompatibility,
} from '../../api/users.api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { useToast } from '../../hooks/useToast';
import MoviePosterCard from '../../components/MoviePosterCard';
import SegmentedTabs from '../../components/SegmentedTabs';
import Toast from '../../components/Toast';
import ProfileHero from '../../components/profile/ProfileHero';
import ProfileStatsStrip from '../../components/profile/ProfileStatsStrip';
import ProfileFavoritesPanel from '../../components/profile/ProfileFavoritesPanel';
import ProfileWrappedPanel from '../../components/profile/ProfileWrappedPanel';
import ProfileChartsPanel from '../../components/profile/ProfileChartsPanel';
import ProfileQuizStatsPanel from '../../components/profile/ProfileQuizStatsPanel';
import JourneyPath from '../../components/journey/JourneyPath';
import PublicFriendsModal from '../../components/profile/PublicFriendsModal';
import TasteMatchModal from '../../components/profile/TasteMatchModal';
import { colors, spacing, fontWeight } from '../../theme';
import type { MainStackParamList } from '../../navigation/MainStack';

type Props = NativeStackScreenProps<MainStackParamList, 'PublicProfile'>;

const PUBLIC_TAB_PAGE_SIZE = 30;

export default function PublicProfileScreen({ route, navigation }: Props) {
  const { t } = useTranslation('profile');
  const { userId } = route.params;
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [activeTab, setActiveTab] = useState<'favorites' | 'watched'>('favorites');
  const [hasQuizStats, setHasQuizStats] = useState(false);
  const { toastMessage, showToast } = useToast();

  // Favorites/watched are paged from their own endpoints rather than read off
  // the truncated `favorites`/`recent` arrays on the profile payload.
  const [tabMovies, setTabMovies] = useState<WatchlistItem[]>([]);
  const [tabLoading, setTabLoading] = useState(true);
  const [tabLoadingMore, setTabLoadingMore] = useState(false);
  const [tabHasMore, setTabHasMore] = useState(false);

  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  const [compat, setCompat] = useState<TasteCompatibility | null>(null);
  const [isCompatOpen, setIsCompatOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPublicProfile(userId)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        navigation.setOptions({ title: data.username ?? '' });
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, t('errors.loadPublicProfile')));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, navigation, t]);

  const isLoaded = profile !== null;
  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    setTabLoading(true);
    const fetcher = activeTab === 'favorites' ? getPublicFavorites : getPublicWatched;
    fetcher(userId, { limit: PUBLIC_TAB_PAGE_SIZE, offset: 0 })
      .then((data) => {
        if (cancelled) return;
        setTabMovies(data);
        setTabHasMore(data.length === PUBLIC_TAB_PAGE_SIZE);
      })
      .catch(() => {
        if (cancelled) return;
        setTabMovies([]);
        setTabHasMore(false);
      })
      .finally(() => {
        if (!cancelled) setTabLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, userId, isLoaded]);

  const loadMoreTabMovies = async () => {
    if (tabLoading || tabLoadingMore || !tabHasMore) return;
    setTabLoadingMore(true);
    try {
      const fetcher = activeTab === 'favorites' ? getPublicFavorites : getPublicWatched;
      const data = await fetcher(userId, { limit: PUBLIC_TAB_PAGE_SIZE, offset: tabMovies.length });
      setTabMovies((prev) => [...prev, ...data]);
      setTabHasMore(data.length === PUBLIC_TAB_PAGE_SIZE);
    } catch {
      // Leave the list as is; the user can scroll again to retry.
    } finally {
      setTabLoadingMore(false);
    }
  };

  const isFriend = profile?.isFriend ?? false;
  useEffect(() => {
    if (!isFriend) return;
    getTasteCompatibility(userId)
      .then(setCompat)
      .catch(() => setCompat(null));
  }, [userId, isFriend]);

  const handleAddFriend = async () => {
    setIsAddingFriend(true);
    try {
      const result = await addFriend(userId);
      if (result?.status === 'accepted') {
        setProfile((prev) => (prev ? { ...prev, isFriend: true, requestPending: false } : prev));
        showToast(t('publicProfile.friendAdded'));
      } else {
        setProfile((prev) => (prev ? { ...prev, requestPending: true } : prev));
      }
    } catch (err) {
      showToast(getErrorMessage(err, t('errors.sendFriendRequest')));
    } finally {
      setIsAddingFriend(false);
    }
  };

  const goToMovie = (item: WatchlistItem) => {
    navigation.push('MovieDetail', {
      movieId: item.tmdbId,
      title: item.title,
      mediaType: item.mediaType === 'tv' ? 'tv' : 'movie',
    });
  };

  const goToSuggestedMovie = (movie: MovieResult) => {
    setIsCompatOpen(false);
    navigation.push('MovieDetail', {
      movieId: movie.id,
      title: movie.title,
      mediaType: movie.mediaType === 'tv' ? 'tv' : 'movie',
    });
  };

  const favoritesCount = profile?.favorites?.length ?? 0;
  const watchedCount = profile?.watchedCount ?? 0;
  const totalCount = profile?.totalCount ?? 0;
  const friendsCount = profile?.friendsCount ?? 0;
  const stats = profile?.stats;
  const hasStats = Boolean(stats?.genreDistribution && stats.genreDistribution.length > 0);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? t('publicProfile.notFound')}</Text>
      </View>
    );
  }

  const friendActionSlot = (
    <>
      <Pressable style={[styles.pill, styles.friendsPill]} onPress={() => setIsFriendsModalOpen(true)}>
        <Ionicons name="people-outline" size={13} color={colors.accentBright} />
        <Text style={styles.friendsPillText}>
          {t('hero.friendsCount', { count: friendsCount }).toUpperCase()}
        </Text>
      </Pressable>
      {profile.isFriend ? (
        <View style={[styles.pill, styles.friendsPill]}>
          <Text style={styles.friendsPillText}>✓ {t('publicProfile.friends').toUpperCase()}</Text>
        </View>
      ) : profile.requestPending ? (
        <View style={[styles.pill, styles.mutedPill]}>
          <Text style={styles.mutedPillText}>{t('publicProfile.requestSent').toUpperCase()}</Text>
        </View>
      ) : (
        <Pressable
          style={[styles.pill, styles.addPill]}
          onPress={() => void handleAddFriend()}
          disabled={isAddingFriend}
        >
          <Text style={styles.addPillText}>
            {isAddingFriend ? '…' : t('publicProfile.addFriend').toUpperCase()}
          </Text>
        </Pressable>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.container}
        data={tabLoading ? [] : tabMovies}
        key={`grid-${activeTab}`}
        numColumns={2}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridColumn}
        onEndReached={() => void loadMoreTabMovies()}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          tabLoading ? (
            <ActivityIndicator color={colors.accent} style={styles.tabSpinner} />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t('empty')}</Text>
            </View>
          )
        }
        ListFooterComponent={
          tabLoadingMore ? <ActivityIndicator color={colors.accent} style={styles.tabSpinner} /> : null
        }
        renderItem={({ item }) => (
          <MoviePosterCard
            posterUrl={item.posterUrl}
            title={item.title}
            subtitle={
              (item.rating ?? 0) > 0 ? `★ ${Number(item.rating).toFixed(1)}` : undefined
            }
            onPress={() => goToMovie(item)}
          />
        )}
        ListHeaderComponent={
          <View>
            <ProfileHero
              username={profile.username ?? ''}
              avatarUrl={profile.avatarUrl ?? null}
              watchedCount={watchedCount}
              memberSince={profile.memberSince}
              friendsCount={friendsCount}
              onOpenFriends={() => setIsFriendsModalOpen(true)}
              rightSlot={friendActionSlot}
            />

            {profile.isFriend && compat && compat.score !== null ? (
              <View style={styles.section}>
                <Pressable style={styles.compatTeaser} onPress={() => setIsCompatOpen(true)}>
                  <View style={styles.compatLabelRow}>
                    <Ionicons name="bulb-outline" size={16} color={colors.accentBright} />
                    <Text style={styles.compatLabel}>{t('compat.title').toUpperCase()}</Text>
                  </View>
                  <Text style={styles.compatScore}>
                    {Math.round(Math.max(0, Math.min(1, compat.score)) * 100)}%
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.section}>
              <ProfileStatsStrip
                stats={[
                  { value: watchedCount, label: t('stats.watched').toUpperCase() },
                  { value: stats?.averageRating ?? '0.0', label: t('stats.avg').toUpperCase() },
                  { value: favoritesCount, label: t('stats.favorites').toUpperCase() },
                ]}
                watchedCount={watchedCount}
                completionRate={stats?.completionRate ?? 0}
                totalCount={totalCount}
              />
            </View>

            <View style={styles.section}>
              <ProfileFavoritesPanel
                favorites={profile.favorites ?? []}
                onToggleFavorite={() => {}}
                onPressMovie={goToMovie}
                readOnly
              />
            </View>

            <View style={styles.section}>
              <JourneyPath totalCount={totalCount} ownerName={profile.username ?? undefined} />
            </View>

            {hasStats && stats ? (
              <View style={styles.section}>
                <ProfileWrappedPanel username={profile.username ?? ''} stats={stats} />
              </View>
            ) : null}

            <View style={hasQuizStats ? styles.section : undefined}>
              <ProfileQuizStatsPanel
                username={profile.username ?? ''}
                userId={profile.id ?? userId}
                onAvailabilityChange={setHasQuizStats}
              />
            </View>

            {hasStats && stats ? (
              <View style={styles.section}>
                <ProfileChartsPanel
                  genreDistribution={stats.genreDistribution ?? []}
                  ratingDistribution={stats.ratingDistribution ?? []}
                  averageRating={stats.averageRating ?? '0.0'}
                  topRated={stats.topRated ?? []}
                  onPressMovie={goToMovie}
                />
              </View>
            ) : null}

            <View style={styles.tabsWrap}>
              <SegmentedTabs
                options={[
                  { key: 'favorites', label: t('tabs.favorites') },
                  { key: 'watched', label: t('tabs.watched') },
                ]}
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as typeof activeTab)}
              />
            </View>
          </View>
        }
      />

      <PublicFriendsModal
        visible={isFriendsModalOpen}
        userId={profile.id ?? userId}
        username={profile.username ?? ''}
        onClose={() => setIsFriendsModalOpen(false)}
        onPressFriend={(friend) => {
          setIsFriendsModalOpen(false);
          navigation.push('PublicProfile', { userId: friend.id, username: friend.username });
        }}
      />

      {compat ? (
        <TasteMatchModal
          visible={isCompatOpen}
          friendId={userId}
          compat={compat}
          onClose={() => setIsCompatOpen(false)}
          onOpenMovie={goToSuggestedMovie}
        />
      ) : null}

      <Toast message={toastMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  tabsWrap: {
    marginTop: spacing.lg,
  },
  tabSpinner: { marginVertical: spacing.lg },
  grid: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  gridColumn: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  emptyContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  compatTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.25)',
    borderRadius: 10,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  compatLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  compatLabel: {
    color: colors.textMuted,
    fontSize: 10.5,
    fontWeight: fontWeight.semibold,
    letterSpacing: 2,
  },
  compatScore: { color: colors.accentBright, fontSize: 18, fontWeight: fontWeight.bold },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm + 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  friendsPill: {
    borderColor: 'rgba(217,172,84,.45)',
  },
  friendsPillText: {
    color: colors.accentBright,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.5,
  },
  mutedPill: {
    borderColor: colors.borderSubtle,
  },
  mutedPillText: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.5,
  },
  addPill: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  addPillText: {
    color: colors.textOnAccent,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.5,
  },
});
