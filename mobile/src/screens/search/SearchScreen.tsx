import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MovieResult } from '@movie-manager/shared';
import {
  addToWatchlist,
  getBecauseYouWatched,
  getProfile,
  getRecommendations,
  getTrending,
  getUpcomingMovies,
  searchMovies,
  toggleFavorite,
  type BecauseYouWatchedResponse,
} from '../../api/movies.api';
import {
  getFriendsLastWatched,
  getSearchHistory,
  clearSearchHistory,
  type FriendLastWatched,
} from '../../api/users.api';
import { getSwipeStatus, type SwipeStatus } from '../../api/swipe.api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { formatTimeAgo } from '../../utils/time';
import { useToast } from '../../hooks/useToast';
import ScreenHeader from '../../components/ScreenHeader';
import MoviePosterCard from '../../components/MoviePosterCard';
import Toast from '../../components/Toast';
import { colors, spacing, radius, fontWeight } from '../../theme';
import type { AppTabsParamList } from '../../navigation/AppTabs';
import type { MainStackParamList } from '../../navigation/MainStack';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabsParamList, 'Search'>,
  NativeStackScreenProps<MainStackParamList>
>;

// getProfileData() returns more than the shared ProfileData type declares —
// see the same cast in AiChatScreen.tsx.
interface ProfileResponse {
  favorites?: { tmdbId: number }[];
  watchedIds?: number[];
  inPlansIds?: number[];
}

const isReleased = (movie: MovieResult): boolean => {
  if (movie.releaseDate) return new Date(movie.releaseDate) <= new Date();
  if (movie.releaseYear && movie.releaseYear !== 'N/A') {
    return parseInt(movie.releaseYear, 10) <= new Date().getFullYear();
  }
  return true;
};

function AddFooter({ added, onAdd }: { added: boolean; onAdd: () => void }) {
  if (added) {
    return (
      <View style={styles.addedPill}>
        <Text style={styles.addedPillText}>✓ ADDED</Text>
      </View>
    );
  }
  return (
    <Pressable style={styles.addButton} onPress={onAdd}>
      <Text style={styles.addButtonText}>+ ADD</Text>
    </Pressable>
  );
}

interface CarouselProps {
  title: string;
  badge?: string;
  badgeColor?: string;
  data: MovieResult[];
  onPressItem: (item: MovieResult) => void;
  favoriteIds: Set<number>;
  addedIds: Set<number>;
  onAdd: (item: MovieResult) => void;
  onToggleFavorite: (item: MovieResult) => void;
  emptyHint?: string;
}

function Carousel({
  title,
  badge,
  badgeColor = colors.danger,
  data,
  onPressItem,
  favoriteIds,
  addedIds,
  onAdd,
  onToggleFavorite,
  emptyHint,
}: CarouselProps) {
  if (data.length === 0 && !emptyHint) return null;
  return (
    <View style={styles.carouselSection}>
      <View style={styles.carouselHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {badge ? (
          <View style={[styles.sectionBadge, { borderColor: badgeColor }]}>
            <Text style={[styles.sectionBadgeText, { color: badgeColor }]}>{badge}</Text>
          </View>
        ) : null}
      </View>
      {data.length === 0 ? (
        <Text style={styles.carouselEmptyHint}>{emptyHint}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.carouselRow}>
            {data.map((item) => (
              <MoviePosterCard
                key={item.id}
                width={110}
                posterUrl={item.posterUrl}
                title={item.title}
                subtitle={`${item.releaseYear || '—'} · ★ ${item.rating.toFixed(1)}`}
                onPress={() => onPressItem(item)}
                isFavorite={favoriteIds.has(item.id)}
                onToggleFavorite={() => onToggleFavorite(item)}
                footer={<AddFooter added={addedIds.has(item.id)} onAdd={() => onAdd(item)} />}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

export default function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trending, setTrending] = useState<MovieResult[]>([]);
  const [upcoming, setUpcoming] = useState<MovieResult[]>([]);
  const [recommendations, setRecommendations] = useState<MovieResult[]>([]);
  const [becauseYouWatched, setBecauseYouWatched] = useState<BecauseYouWatchedResponse | null>(null);
  const [friendsActivity, setFriendsActivity] = useState<FriendLastWatched[]>([]);
  const [isLoadingHome, setIsLoadingHome] = useState(true);

  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [watchedIds, setWatchedIds] = useState<Set<number>>(new Set());

  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [swipeStatus, setSwipeStatus] = useState<SwipeStatus | null>(null);
  const { toastMessage, showToast } = useToast();

  useEffect(() => {
    Promise.all([
      getTrending().catch(() => []),
      getUpcomingMovies().catch(() => []),
      getRecommendations().catch(() => []),
      getBecauseYouWatched().catch(() => null),
      getFriendsLastWatched().catch(() => []),
      getProfile().catch(() => null),
    ])
      .then(([t, u, r, b, f, profile]) => {
        setTrending(t);
        setUpcoming(u);
        setRecommendations(r);
        setBecauseYouWatched(b);
        setFriendsActivity(f);
        if (profile) {
          const p = profile as typeof profile & ProfileResponse;
          const favs = p.favorites?.map((fav) => fav.tmdbId) ?? [];
          const watched = p.watchedIds ?? [];
          const inPlans = p.inPlansIds ?? [];
          setFavoriteIds(new Set(favs));
          setWatchedIds(new Set(watched));
          setAddedIds(new Set([...favs, ...watched, ...inPlans]));
        }
      })
      .finally(() => setIsLoadingHome(false));

    getSwipeStatus().then(setSwipeStatus).catch(() => {});
    getSearchHistory().then((items) => setSearchHistory(items.map((i) => i.queryText))).catch(() => {});
  }, []);

  const runSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setIsSearching(true);
    setError(null);
    searchMovies(trimmed)
      .then((res) => {
        setResults(res);
        getSearchHistory().then((items) => setSearchHistory(items.map((i) => i.queryText))).catch(() => {});
      })
      .catch((err) => setError(getErrorMessage(err, 'Search failed.')))
      .finally(() => setIsSearching(false));
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    const timeout = setTimeout(() => runSearch(trimmed), 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const goToMovie = (item: MovieResult) => {
    navigation.navigate('MovieDetail', {
      movieId: item.id,
      title: item.title,
      mediaType: item.mediaType,
    });
  };

  const handleClearSearch = () => {
    setQuery('');
    setResults([]);
    setError(null);
  };

  const handleClearHistory = async () => {
    setSearchHistory([]);
    try {
      await clearSearchHistory();
    } catch {
      getSearchHistory().then((items) => setSearchHistory(items.map((i) => i.queryText))).catch(() => {});
    }
  };

  const handleAdd = async (item: MovieResult) => {
    setAddedIds((prev) => new Set(prev).add(item.id));
    try {
      await addToWatchlist({
        tmdbId: item.id,
        title: item.title,
        posterUrl: item.posterUrl,
        mediaType: item.mediaType,
        releaseDate: item.releaseDate,
      });
      showToast('Added to watchlist.');
    } catch (err) {
      const apiError = err as { response?: { status?: number } };
      if (apiError.response?.status !== 400) {
        setAddedIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        showToast(getErrorMessage(err, 'Could not add to watchlist.'));
      }
    }
  };

  // Mirrors movie-frontend's Search.tsx handleToggleFavorite: favoriting an
  // item not yet in the watchlist 404s, so add it first and retry.
  const handleToggleFavorite = async (item: MovieResult) => {
    if (!isReleased(item)) {
      showToast('This title has not been released yet.');
      return;
    }
    const wasFavorite = favoriteIds.has(item.id);
    try {
      await toggleFavorite(item.id);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
      if (!wasFavorite) setAddedIds((prev) => new Set(prev).add(item.id));
    } catch (err) {
      const apiError = err as { response?: { status?: number } };
      if (apiError.response?.status === 404 && !wasFavorite) {
        try {
          await addToWatchlist({
            tmdbId: item.id,
            title: item.title,
            posterUrl: item.posterUrl,
            mediaType: item.mediaType,
            releaseDate: item.releaseDate,
          });
          await toggleFavorite(item.id);
          setFavoriteIds((prev) => new Set(prev).add(item.id));
          setAddedIds((prev) => new Set(prev).add(item.id));
        } catch {
          showToast('Could not update favorite.');
        }
      } else {
        showToast('Could not update favorite.');
      }
    }
  };

  const isSearchMode = query.trim().length >= 2;
  const isIdle = !isSearchMode && !isSearching;
  const visibleRecommendations = recommendations.filter((m) => !addedIds.has(m.id)).slice(0, 20);
  const visibleBecauseYouWatched = becauseYouWatched
    ? becauseYouWatched.similarMovies.filter((m) => !watchedIds.has(m.id))
    : [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScreenHeader />

      <View style={styles.searchRow}>
        <View style={styles.searchBarWrap}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Enter movie title…"
            placeholderTextColor={colors.textFaint}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            onSubmitEditing={() => runSearch(query)}
          />
          {query.length > 0 ? (
            <Pressable onPress={handleClearSearch} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textFaint} />
            </Pressable>
          ) : null}
          <Pressable
            style={styles.findButton}
            onPress={() => runSearch(query)}
            disabled={isSearching || !query.trim()}
          >
            <Text style={styles.findButtonText}>{isSearching ? '…' : 'FIND'}</Text>
          </Pressable>
        </View>
        <Pressable style={styles.discoverButton} onPress={() => navigation.navigate('Discover')}>
          <Ionicons name="albums-outline" size={18} color={colors.accentBright} />
          {swipeStatus?.remainingToday ? (
            <View style={styles.discoverBadge}>
              <Text style={styles.discoverBadgeText}>{swipeStatus.remainingToday}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {swipeStatus?.showPromo ? (
        <Pressable style={styles.promoBanner} onPress={() => navigation.navigate('Discover')}>
          <Ionicons name="albums-outline" size={20} color={colors.accentBright} />
          <View style={styles.promoTextGroup}>
            <Text style={styles.promoTitle}>Not sure what to watch?</Text>
            <Text style={styles.promoSubtitle}>
              Swipe today's picks — {swipeStatus.remainingToday} of {swipeStatus.dailyLimit} left
            </Text>
          </View>
          <Text style={styles.promoLink}>DISCOVER →</Text>
        </Pressable>
      ) : null}

      {isSearchMode ? (
        error ? (
          <Text style={styles.error}>{error}</Text>
        ) : isSearching ? (
          <ActivityIndicator color={colors.accent} style={styles.spinner} />
        ) : (
          <FlatList
            data={results}
            key="search-results"
            numColumns={3}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.gridColumn}
            ListHeaderComponent={
              results.length > 0 ? (
                <View style={styles.resultsHeader}>
                  <Text style={styles.resultsHeaderTitle}>SEARCH RESULTS</Text>
                  <Pressable onPress={handleClearSearch}>
                    <Text style={styles.resultsHeaderBack}>← GO BACK</Text>
                  </Pressable>
                </View>
              ) : null
            }
            ListEmptyComponent={<Text style={styles.emptyText}>No results.</Text>}
            renderItem={({ item }) => (
              <MoviePosterCard
                posterUrl={item.posterUrl}
                title={item.title}
                subtitle={item.releaseYear}
                isFavorite={favoriteIds.has(item.id)}
                onToggleFavorite={() => void handleToggleFavorite(item)}
                onPress={() => goToMovie(item)}
                footer={<AddFooter added={addedIds.has(item.id)} onAdd={() => void handleAdd(item)} />}
              />
            )}
          />
        )
      ) : isLoadingHome ? (
        <ActivityIndicator color={colors.accent} style={styles.spinner} />
      ) : (
        <ScrollView contentContainerStyle={styles.homeContent}>
          {searchHistory.length > 0 ? (
            <View style={styles.historySection}>
              <Text style={styles.historyLabel}>RECENT</Text>
              <View style={styles.historyChips}>
                {searchHistory.map((q) => (
                  <Pressable key={q} style={styles.historyChip} onPress={() => setQuery(q)}>
                    <Text style={styles.historyChipText}>{q}</Text>
                  </Pressable>
                ))}
                <Pressable style={styles.historyClear} onPress={() => void handleClearHistory()}>
                  <Text style={styles.historyClearText}>✕ CLEAR</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {isIdle ? (
            <View style={styles.top100Row}>
              <Pressable
                style={styles.top100Card}
                onPress={() => navigation.navigate('Top100', { type: 'movie' })}
              >
                {trending[0]?.posterUrl ? (
                  <Image source={{ uri: trending[0].posterUrl }} style={styles.top100Image} />
                ) : null}
                <LinearGradient colors={['transparent', colors.backgroundDeep]} style={styles.top100Overlay} />
                <View style={styles.top100Content}>
                  <View style={styles.top100Tag}>
                    <Text style={styles.top100TagText}>COLLECTION</Text>
                  </View>
                  <Text style={styles.top100Title}>Top 100 Movies</Text>
                  <Text style={styles.top100Subtitle}>All-Time Classics</Text>
                </View>
              </Pressable>
              <Pressable
                style={styles.top100Card}
                onPress={() => navigation.navigate('Top100', { type: 'tv' })}
              >
                {upcoming[0]?.posterUrl ? (
                  <Image source={{ uri: upcoming[0].posterUrl }} style={styles.top100Image} />
                ) : null}
                <LinearGradient colors={['transparent', colors.backgroundDeep]} style={styles.top100Overlay} />
                <View style={styles.top100Content}>
                  <View style={styles.top100Tag}>
                    <Text style={styles.top100TagText}>CURATED</Text>
                  </View>
                  <Text style={styles.top100Title}>Top 100 TV Shows</Text>
                  <Text style={styles.top100Subtitle}>Highest Rated</Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          <Carousel
            title="Trending This Week"
            badge="HOT"
            badgeColor={colors.danger}
            data={trending}
            onPressItem={goToMovie}
            favoriteIds={favoriteIds}
            addedIds={addedIds}
            onAdd={(item) => void handleAdd(item)}
            onToggleFavorite={(item) => void handleToggleFavorite(item)}
          />

          <Carousel
            title="Coming Soon"
            badge="NEW"
            badgeColor={colors.accentBright}
            data={upcoming.slice(0, 10)}
            onPressItem={goToMovie}
            favoriteIds={favoriteIds}
            addedIds={addedIds}
            onAdd={(item) => void handleAdd(item)}
            onToggleFavorite={(item) => void handleToggleFavorite(item)}
          />

          <Carousel
            title="Recommended For You"
            badge="AI"
            badgeColor={colors.accentBright}
            data={visibleRecommendations}
            onPressItem={goToMovie}
            favoriteIds={favoriteIds}
            addedIds={addedIds}
            onAdd={(item) => void handleAdd(item)}
            onToggleFavorite={(item) => void handleToggleFavorite(item)}
            emptyHint="Add movies to your Watchlist so AI can recommend similar titles!"
          />

          {becauseYouWatched && visibleBecauseYouWatched.length > 0 ? (
            <Carousel
              title={`Because You Watched "${becauseYouWatched.basedOnMovie.title}"`}
              data={visibleBecauseYouWatched}
              onPressItem={goToMovie}
              favoriteIds={favoriteIds}
              addedIds={addedIds}
              onAdd={(item) => void handleAdd(item)}
              onToggleFavorite={(item) => void handleToggleFavorite(item)}
            />
          ) : null}

          {friendsActivity.length > 0 ? (
            <View style={styles.carouselSection}>
              <Text style={styles.sectionTitle}>FRIENDS' LATEST WATCHES</Text>
              {friendsActivity.slice(0, 6).map((entry) => (
                <Pressable
                  key={`${entry.user.id}-${entry.tmdbId}`}
                  style={styles.friendRow}
                  onPress={() =>
                    navigation.navigate('MovieDetail', {
                      movieId: entry.tmdbId,
                      title: entry.title,
                      mediaType: entry.mediaType === 'tv' ? 'tv' : 'movie',
                    })
                  }
                >
                  {entry.posterUrl ? (
                    <Image source={{ uri: entry.posterUrl }} style={styles.friendPoster} />
                  ) : (
                    <View style={[styles.friendPoster, styles.friendPosterPlaceholder]} />
                  )}
                  <View style={styles.friendTextGroup}>
                    <View style={styles.friendUserRow}>
                      {entry.user.avatarUrl ? (
                        <Image source={{ uri: entry.user.avatarUrl }} style={styles.friendAvatar} />
                      ) : (
                        <View style={[styles.friendAvatar, styles.friendAvatarFallback]}>
                          <Text style={styles.friendAvatarInitial}>
                            {entry.user.username.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.friendUsername} numberOfLines={1}>
                        {entry.user.username} watched
                      </Text>
                    </View>
                    <Text style={styles.friendMovieTitle} numberOfLines={1}>
                      {entry.title}
                    </Text>
                    <Text style={styles.friendMeta}>
                      {entry.mediaType === 'tv' ? 'TV Show' : 'Movie'}
                      {entry.watchedAt ? ` · ${formatTimeAgo(entry.watchedAt)}` : ''}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}

      <Toast message={toastMessage} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  searchRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  searchBarWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,.03)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingLeft: spacing.md,
    paddingRight: 4,
    paddingVertical: 4,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  findButton: {
    backgroundColor: colors.accentBright,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  findButtonText: { color: colors.textOnAccent, fontSize: 10.5, fontWeight: fontWeight.bold, letterSpacing: 1 },
  discoverButton: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoverBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.accentBright,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoverBadgeText: { color: colors.textOnAccent, fontSize: 9, fontWeight: fontWeight.bold },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.2)',
  },
  promoTextGroup: { flex: 1, minWidth: 0, gap: 2 },
  promoTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: fontWeight.semibold },
  promoSubtitle: { color: colors.textMuted, fontSize: 11 },
  promoLink: { color: colors.accentBright, fontSize: 10.5, fontWeight: fontWeight.bold, letterSpacing: 1 },
  spinner: { marginTop: spacing.xl },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: spacing.lg },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: spacing.xl },
  grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  gridColumn: { gap: spacing.sm, marginBottom: spacing.md },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  resultsHeaderTitle: { color: colors.accentBright, fontSize: 11, fontWeight: fontWeight.black, letterSpacing: 1.5 },
  resultsHeaderBack: { color: colors.textSubtle, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 },
  homeContent: { paddingBottom: spacing.xl },
  historySection: { marginBottom: spacing.lg },
  historyLabel: { color: colors.textFaint, fontSize: 9.5, fontWeight: fontWeight.medium, letterSpacing: 2, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  historyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2, paddingHorizontal: spacing.lg },
  historyChip: { borderWidth: 1, borderColor: 'rgba(255,255,255,.12)', borderRadius: radius.full, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2 },
  historyChipText: { color: colors.textSubtle, fontSize: 11 },
  historyClear: { borderWidth: 1, borderColor: 'rgba(217,172,84,.5)', borderRadius: radius.full, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2 },
  historyClearText: { color: colors.accentBright, fontSize: 10, fontWeight: fontWeight.bold },
  top100Row: { gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  top100Card: { height: 110, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  top100Image: { ...StyleSheet.absoluteFillObject, opacity: 0.4 },
  top100Overlay: { ...StyleSheet.absoluteFillObject },
  top100Content: { flex: 1, justifyContent: 'flex-end', padding: spacing.md, gap: 3 },
  top100Tag: { alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(217,172,84,.45)', borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3, marginBottom: 2 },
  top100TagText: { color: colors.accentBright, fontSize: 8.5, fontWeight: fontWeight.semibold, letterSpacing: 1.5 },
  top100Title: { color: colors.textPrimary, fontSize: 18, fontWeight: fontWeight.bold },
  top100Subtitle: { color: colors.textMuted, fontSize: 11 },
  carouselSection: { marginBottom: spacing.lg },
  carouselHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: {
    color: colors.accentBright,
    fontSize: 11.5,
    fontWeight: fontWeight.semibold,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  sectionBadge: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.xs + 2, paddingVertical: 2 },
  sectionBadgeText: { fontSize: 8.5, fontWeight: fontWeight.bold, letterSpacing: 1 },
  carouselEmptyHint: {
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.2)',
    borderStyle: 'dashed',
    borderRadius: radius.md,
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  carouselRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  addButton: { backgroundColor: colors.accentBright, borderRadius: radius.full, paddingVertical: 5, alignItems: 'center' },
  addButtonText: { color: colors.textOnAccent, fontSize: 9.5, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
  addedPill: { borderWidth: 1, borderColor: 'rgba(217,172,84,.45)', borderRadius: radius.full, paddingVertical: 5, alignItems: 'center' },
  addedPillText: { color: colors.accentBright, fontSize: 9.5, fontWeight: fontWeight.bold },
  friendRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  friendPoster: { width: 48, height: 72, borderRadius: radius.sm },
  friendPosterPlaceholder: { backgroundColor: colors.backgroundElevated },
  friendTextGroup: { flex: 1, minWidth: 0, gap: 2, justifyContent: 'center' },
  friendUserRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  friendAvatar: { width: 18, height: 18, borderRadius: 9 },
  friendAvatarFallback: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  friendAvatarInitial: { color: colors.textOnAccent, fontSize: 9, fontWeight: fontWeight.bold },
  friendUsername: { color: colors.textMuted, fontSize: 11 },
  friendMovieTitle: { color: colors.textPrimary, fontSize: 13.5, fontWeight: fontWeight.semibold },
  friendMeta: { color: colors.textFaint, fontSize: 10.5 },
});
