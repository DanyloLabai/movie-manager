import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileData, WatchlistItem } from '@movie-manager/shared';
import {
  getProfile,
  getWatchlist,
  getWatched,
  markAsWatched,
  rateMovie,
  removeFromWatchlist,
  toggleFavorite,
} from '../../api/movies.api';
import { getFriends, type Friend, type ActivityDay, type ActivityDayAction } from '../../api/users.api';
import { getMyStats, type QuizStats } from '../../api/quiz.api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { getAchievementsList } from '../../utils/achievements';
import { useActivityHeatmap } from '../../hooks/useActivityHeatmap';
import { useToast } from '../../hooks/useToast';
import ScreenHeader from '../../components/ScreenHeader';
import SegmentedTabs from '../../components/SegmentedTabs';
import MoviePosterCard from '../../components/MoviePosterCard';
import StarRating from '../../components/StarRating';
import ActivityHeatmap from '../../components/ActivityHeatmap';
import ActivityDayModal from '../../components/ActivityDayModal';
import FriendsModal from '../../components/FriendsModal';
import Toast from '../../components/Toast';
import ProfileHero from '../../components/profile/ProfileHero';
import ProfileStatsStrip from '../../components/profile/ProfileStatsStrip';
import ProfileFavoritesPanel from '../../components/profile/ProfileFavoritesPanel';
import ProfileWrappedPanel from '../../components/profile/ProfileWrappedPanel';
import ProfileChartsPanel from '../../components/profile/ProfileChartsPanel';
import { colors, spacing, radius } from '../../theme';
import type { AppTabsParamList } from '../../navigation/AppTabs';
import type { MainStackParamList } from '../../navigation/MainStack';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabsParamList, 'Profile'>,
  NativeStackScreenProps<MainStackParamList>
>;

const PAGE_SIZE = 30;

const isReleased = (item: WatchlistItem): boolean => {
  if (!item.releaseDate) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const release = new Date(item.releaseDate);
  release.setHours(0, 0, 0, 0);
  return release <= today;
};

export default function ProfileScreen({ route, navigation }: Props) {
  const [activeTab, setActiveTab] = useState<'profile' | 'watchlist' | 'watched'>(
    route.params?.tab ?? 'profile',
  );
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [movies, setMovies] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [quizStats, setQuizStats] = useState<QuizStats | null>(null);
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<{ tmdbId: number; title: string } | null>(
    null,
  );
  const [modalRating, setModalRating] = useState(0);
  const [selectedDay, setSelectedDay] = useState<ActivityDay | null>(null);
  const { toastMessage, showToast } = useToast();

  const activityHeatmap = useActivityHeatmap(activeTab === 'profile');

  useEffect(() => {
    getFriends().then(setFriends).catch(() => {});
    getMyStats().then(setQuizStats).catch(() => {});
  }, []);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      setProfileData(await getProfile());
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not load your profile.'));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMovies = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetcher = activeTab === 'watchlist' ? getWatchlist : getWatched;
      const data = await fetcher(PAGE_SIZE, 0);
      setMovies(data);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not load your list.'));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'profile') void fetchProfile();
      else void fetchMovies();
    }, [activeTab, fetchProfile, fetchMovies]),
  );

  useEffect(() => {
    if (route.params?.tab) setActiveTab(route.params.tab);
  }, [route.params?.tab]);

  const loadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const fetcher = activeTab === 'watchlist' ? getWatchlist : getWatched;
      const data = await fetcher(PAGE_SIZE, movies.length);
      setMovies((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleToggleFavorite = async (tmdbId: number) => {
    setMovies((prev) =>
      prev.map((m) => (m.tmdbId === tmdbId ? { ...m, isFavorite: !m.isFavorite } : m)),
    );
    try {
      await toggleFavorite(tmdbId);
    } catch {
      showToast('Could not update favorite.');
      void fetchMovies();
    }
  };

  // ProfileFavoritesPanel only lists already-favorited movies, so unlike
  // handleToggleFavorite above (which flips isFavorite in place on a full
  // list), toggling here always means "un-favorite" — drop it from the list
  // optimistically, matching movie-frontend's Watchlist.tsx profile-tab
  // behavior.
  const handleToggleFavoriteInProfile = async (tmdbId: number) => {
    setProfileData((prev) =>
      prev ? { ...prev, favorites: prev.favorites.filter((f) => f.tmdbId !== tmdbId) } : prev,
    );
    try {
      await toggleFavorite(tmdbId);
    } catch {
      showToast('Could not update favorite.');
      void fetchProfile();
    }
  };

  const handleDelete = async (tmdbId: number) => {
    setMovies((prev) => prev.filter((m) => m.tmdbId !== tmdbId));
    try {
      await removeFromWatchlist(tmdbId);
      showToast('Removed.');
    } catch {
      showToast('Could not remove.');
    }
  };

  const openRatingModal = (item: WatchlistItem) => {
    setModalRating(0);
    setRatingTarget({ tmdbId: item.tmdbId, title: item.title });
  };

  const confirmMarkWatched = async () => {
    if (!ratingTarget) return;
    const { tmdbId } = ratingTarget;
    setMovies((prev) => prev.filter((m) => m.tmdbId !== tmdbId));
    setRatingTarget(null);
    try {
      await markAsWatched(tmdbId);
      if (modalRating > 0) await rateMovie(tmdbId, modalRating);
      showToast('Moved to watched.');
    } catch {
      showToast('Could not update.');
      void fetchMovies();
    }
  };

  const handleRate = async (tmdbId: number, rating: number) => {
    setMovies((prev) => prev.map((m) => (m.tmdbId === tmdbId ? { ...m, rating } : m)));
    try {
      await rateMovie(tmdbId, rating);
    } catch {
      showToast('Could not update rating.');
    }
  };

  const goToMovie = (item: WatchlistItem) => {
    navigation.navigate('MovieDetail', {
      movieId: item.tmdbId,
      title: item.title,
      mediaType: item.mediaType === 'tv' ? 'tv' : 'movie',
    });
  };

  const watchedCount = profileData?.watchedCount ?? 0;
  const totalCount = profileData?.totalCount ?? 0;
  const displayedMovies = movies.filter(
    (m) => mediaFilter === 'all' || m.mediaType === mediaFilter,
  );

  const renderProfileTab = () => {
    const favoritesCount = profileData?.favorites?.length ?? 0;
    const achievements = getAchievementsList({
      favoritesCount,
      watchedCount,
      totalCount,
      quizSolvedCount: quizStats?.totalSolved,
      quizPerfectCount: quizStats?.perfectSolves,
      quizCurrentStreak: quizStats?.currentStreak,
    });
    const stats = profileData?.stats;
    const hasStats = Boolean(stats?.genreDistribution && stats.genreDistribution.length > 0);

    return (
      <View>
        <ProfileHero
          username={profileData?.username ?? ''}
          avatarUrl={profileData?.avatarUrl ?? null}
          watchedCount={watchedCount}
          memberSince={profileData?.memberSince}
          friendsCount={friends.length}
          onOpenFriends={() => setIsFriendsModalOpen(true)}
        />

        <View style={styles.section}>
          <ProfileStatsStrip
            stats={[
              { value: watchedCount, label: 'WATCHED' },
              { value: stats?.averageRating ?? '0.0', label: 'AVG' },
              { value: quizStats?.currentStreak ?? 0, label: 'STREAK' },
            ]}
            watchedCount={watchedCount}
            completionRate={stats?.completionRate ?? 0}
            totalCount={totalCount}
          />
        </View>

        <View style={styles.section}>
          <ActivityHeatmap
            days={activityHeatmap.days}
            year={activityHeatmap.year}
            isLoading={activityHeatmap.isLoading}
            onPrevYear={activityHeatmap.goToPreviousYear}
            onNextYear={activityHeatmap.goToNextYear}
            canGoNext={activityHeatmap.canGoNext}
            onPressDay={setSelectedDay}
          />
        </View>

        <View style={styles.section}>
          <ProfileFavoritesPanel
            favorites={profileData?.favorites ?? []}
            achievements={achievements}
            friends={friends}
            friendsCount={friends.length}
            onToggleFavorite={(tmdbId) => void handleToggleFavoriteInProfile(tmdbId)}
            onOpenFriends={() => setIsFriendsModalOpen(true)}
            onPressMovie={goToMovie}
          />
        </View>

        {hasStats && stats ? (
          <View style={styles.section}>
            <ProfileWrappedPanel username={profileData?.username ?? ''} stats={stats} />
          </View>
        ) : null}

        {hasStats && stats ? (
          <View style={styles.section}>
            <ProfileChartsPanel
              genreDistribution={stats.genreDistribution ?? []}
              ratingDistribution={stats.ratingDistribution ?? []}
              averageRating={stats.averageRating ?? '0.0'}
              topRated={stats.topRated ?? []}
              onPressMovie={goToMovie}
              interactiveRating
            />
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScreenHeader />

      <SegmentedTabs
        options={[
          { key: 'profile', label: 'Profile' },
          {
            key: 'watchlist',
            label: 'Watchlist',
            count: totalCount ? totalCount - watchedCount : null,
          },
          { key: 'watched', label: 'Watched', count: watchedCount || null },
        ]}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as typeof activeTab)}
      />

      {activeTab === 'watchlist' ? (
        <View style={styles.filterRow}>
          {(['all', 'movie', 'tv'] as const).map((f) => (
            <Pressable
              key={f}
              style={[styles.filterPill, mediaFilter === f && styles.filterPillActive]}
              onPress={() => setMediaFilter(f)}
            >
              <Text
                style={[styles.filterText, mediaFilter === f && styles.filterTextActive]}
              >
                {f === 'all' ? 'All' : f === 'movie' ? 'Movies' : 'TV'}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {isLoading && activeTab === 'profile' ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : activeTab === 'profile' ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {renderProfileTab()}
        </ScrollView>
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={displayedMovies}
          key={`grid-${activeTab}`}
          numColumns={2}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridColumn}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nothing here yet.</Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? <ActivityIndicator color={colors.accent} style={styles.footerSpinner} /> : null
          }
          renderItem={({ item }) => {
            const released = isReleased(item);
            return (
              <MoviePosterCard
                posterUrl={item.posterUrl}
                title={item.title}
                subtitle={
                  activeTab === 'watched'
                    ? `★ ${(item.rating ?? 0).toFixed(1)}`
                    : item.releaseDate
                      ? new Date(item.releaseDate).getFullYear().toString()
                      : undefined
                }
                topLeftBadge={activeTab === 'watchlist' && !released ? 'Upcoming' : undefined}
                isFavorite={released ? item.isFavorite : undefined}
                onToggleFavorite={released ? () => void handleToggleFavorite(item.tmdbId) : undefined}
                onPress={() => goToMovie(item)}
                footer={
                  <View style={styles.cardFooter}>
                    {activeTab === 'watched' ? (
                      <StarRating
                        size="sm"
                        value={item.rating ?? 0}
                        onRate={(r) => void handleRate(item.tmdbId, r)}
                      />
                    ) : (
                      <View style={styles.cardActionsRow}>
                        {released ? (
                          <Pressable onPress={() => openRatingModal(item)}>
                            <Text style={styles.cardActionText}>✓ Watched</Text>
                          </Pressable>
                        ) : (
                          <Text style={styles.cardActionMuted}>Upcoming</Text>
                        )}
                        <Pressable onPress={() => void handleDelete(item.tmdbId)}>
                          <Text style={styles.cardActionDanger}>Remove</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                }
              />
            );
          }}
        />
      )}

      <FriendsModal
        visible={isFriendsModalOpen}
        friends={friends}
        onClose={() => setIsFriendsModalOpen(false)}
        onFriendsChange={setFriends}
      />

      <ActivityDayModal
        day={selectedDay}
        onClose={() => setSelectedDay(null)}
        onPressMovie={(action: ActivityDayAction) => {
          setSelectedDay(null);
          navigation.navigate('MovieDetail', {
            movieId: action.tmdbId,
            title: action.title,
            mediaType: action.mediaType === 'tv' ? 'tv' : 'movie',
          });
        }}
      />

      <Modal visible={!!ratingTarget} transparent animationType="fade" onRequestClose={() => setRatingTarget(null)}>
        <View style={styles.ratingBackdrop}>
          <View style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>How was it?</Text>
            <Text style={styles.ratingSubtitle}>Rate "{ratingTarget?.title}"</Text>
            <View style={styles.ratingStars}>
              <StarRating size="lg" value={modalRating} onRate={setModalRating} />
            </View>
            <View style={styles.ratingActions}>
              <Pressable style={styles.ratingCancel} onPress={() => setRatingTarget(null)}>
                <Text style={styles.ratingCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable style={styles.ratingConfirm} onPress={() => void confirmMarkWatched()}>
                <Text style={styles.ratingConfirmText}>OK</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Toast message={toastMessage} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: spacing.xl },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  filterPill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  filterPillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  filterTextActive: { color: colors.textOnAccent },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    marginTop: spacing.lg,
  },
  grid: { padding: spacing.lg, paddingBottom: spacing.xl },
  gridColumn: { gap: spacing.md, marginBottom: spacing.lg },
  emptyContainer: { alignItems: 'center', paddingTop: spacing.xl * 2 },
  emptyText: { color: colors.textMuted, fontSize: 13 },
  footerSpinner: { marginVertical: spacing.md },
  cardFooter: { marginTop: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  cardActionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardActionText: { color: colors.accentBright, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  cardActionMuted: { color: colors.textFaint, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  cardActionDanger: { color: colors.textFaint, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  ratingBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  ratingCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  ratingTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  ratingSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: spacing.md },
  ratingStars: { marginBottom: spacing.md },
  ratingActions: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  ratingCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  ratingCancelText: { color: colors.textPrimary, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  ratingConfirm: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  ratingConfirmText: { color: colors.textOnAccent, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
});
