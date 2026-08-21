import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WatchlistItem } from '@movie-manager/shared';
import { getPublicProfile, addFriend, type PublicProfile } from '../../api/users.api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { getAchievementsList } from '../../utils/achievements';
import MoviePosterCard from '../../components/MoviePosterCard';
import SegmentedTabs from '../../components/SegmentedTabs';
import ProfileHero from '../../components/profile/ProfileHero';
import ProfileStatsStrip from '../../components/profile/ProfileStatsStrip';
import ProfileFavoritesPanel from '../../components/profile/ProfileFavoritesPanel';
import ProfileWrappedPanel from '../../components/profile/ProfileWrappedPanel';
import ProfileChartsPanel from '../../components/profile/ProfileChartsPanel';
import { colors, spacing, fontWeight } from '../../theme';
import type { MainStackParamList } from '../../navigation/MainStack';

type Props = NativeStackScreenProps<MainStackParamList, 'PublicProfile'>;

export default function PublicProfileScreen({ route, navigation }: Props) {
  const { t } = useTranslation('profile');
  const { userId } = route.params;
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [activeTab, setActiveTab] = useState<'favorites' | 'watched'>('favorites');

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleAddFriend = async () => {
    setIsAddingFriend(true);
    try {
      await addFriend(userId);
      setProfile((prev) => (prev ? { ...prev, isFriend: true, requestPending: false } : prev));
    } catch (err) {
      setError(getErrorMessage(err, t('errors.sendFriendRequest')));
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

  const favoritesCount = profile?.favorites?.length ?? 0;
  const watchedCount = profile?.watchedCount ?? 0;
  const totalCount = profile?.totalCount ?? 0;
  const stats = profile?.stats;
  const hasStats = Boolean(stats?.genreDistribution && stats.genreDistribution.length > 0);

  const achievements = useMemo(
    () => getAchievementsList({ favoritesCount, watchedCount, totalCount }),
    [favoritesCount, watchedCount, totalCount],
  );

  const watchedRecent = useMemo(
    () => (profile?.recent ?? []).filter((m) => m.isWatched),
    [profile?.recent],
  );
  const displayedMovies = activeTab === 'favorites' ? (profile?.favorites ?? []) : watchedRecent;

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

  const friendRightSlot = profile.isFriend ? (
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
      <Text style={styles.addPillText}>{isAddingFriend ? '…' : t('publicProfile.addFriend').toUpperCase()}</Text>
    </Pressable>
  );

  return (
    <FlatList
      style={styles.container}
      data={displayedMovies}
      key={`grid-${activeTab}`}
      numColumns={2}
      keyExtractor={(item, index) => `${item.id}-${index}`}
      contentContainerStyle={styles.grid}
      columnWrapperStyle={styles.gridColumn}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('empty')}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <MoviePosterCard
          posterUrl={item.posterUrl}
          title={item.title}
          subtitle={activeTab === 'watched' ? `★ ${(item.rating ?? 0).toFixed(1)}` : undefined}
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
            friendsCount={0}
            onOpenFriends={() => {}}
            rightSlot={friendRightSlot}
          />

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
              achievements={achievements}
              friends={[]}
              friendsCount={0}
              onToggleFavorite={() => {}}
              onOpenFriends={() => {}}
              onPressMovie={goToMovie}
              readOnly
              showFriends={false}
            />
          </View>

          {hasStats && stats ? (
            <View style={styles.section}>
              <ProfileWrappedPanel username={profile.username ?? ''} stats={stats} />
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
  pill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
