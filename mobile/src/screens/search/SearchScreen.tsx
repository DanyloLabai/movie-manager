import { useEffect, useRef, useState, useEffectEvent } from "react";
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
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MovieResult } from "@movie-manager/shared";
import {
  addToWatchlist,
  markAsWatched,
  rateMovie,
  getBecauseYouWatched,
  getProfile,
  getRecommendations,
  getTrending,
  findSimilarMoviesSemantic,
  getUpcomingMovies,
  removeFromWatchlist,
  searchMovies,
  smartSearchMovies,
  toggleFavorite,
  type BecauseYouWatchedResponse,
  type SmartSearchFilters,
} from "../../api/movies.api";
import {
  getFriendsLastWatched,
  getSearchHistory,
  clearSearchHistory,
  type FriendLastWatched,
} from "../../api/users.api";
import { getSwipeStatus, type SwipeStatus } from "../../api/swipe.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { formatShortDate, formatTimeAgo } from "../../utils/time";
import { useToast } from "../../hooks/useToast";
import ScreenHeader from "../../components/ScreenHeader";
import SearchFilterBar from "../../components/SearchFilterBar";
import Toast from "../../components/Toast";
import AddMovieModal from "../../components/AddMovieModal";
import { colors, spacing, radius, fontWeight } from "../../theme";
import type { AppTabsParamList } from "../../navigation/AppTabs";
import type { MainStackParamList } from "../../navigation/MainStack";
import { logError, logFallback } from "../../utils/logError";

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabsParamList, "Search">,
  NativeStackScreenProps<MainStackParamList>
>;

interface ProfileResponse {
  favorites?: { tmdbId: number }[];
  watchedIds?: number[];
  inPlansIds?: number[];
}

const isReleased = (movie: MovieResult): boolean => {
  if (movie.releaseDate) return new Date(movie.releaseDate) <= new Date();
  if (movie.releaseYear && movie.releaseYear !== "N/A") {
    return parseInt(movie.releaseYear, 10) <= new Date().getFullYear();
  }
  return true;
};

type MediaScope = "all" | "movie" | "tv";

const H_PAD = spacing.md;
const POSTER_RATIO = 1.485;

function GlassLayer() {
  return (
    <>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.glassSheen} pointerEvents="none" />
    </>
  );
}

interface PosterTileProps {
  item: MovieResult;
  width: number;
  isFavorite: boolean;
  isAdded: boolean;
  onPress: () => void;
  onAdd: () => void;
  onRemove: () => void;
  onToggleFavorite: () => void;
}

function PosterTile({
  item,
  width,
  isFavorite,
  isAdded,
  onPress,
  onAdd,
  onRemove,
  onToggleFavorite,
}: PosterTileProps) {
  const released = isReleased(item);
  return (
    <View style={{ width, gap: spacing.sm }}>
      <Pressable
        onPress={onPress}
        style={[
          styles.poster,
          { width, height: Math.round(width * POSTER_RATIO) },
        ]}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        {item.posterUrl ? (
          <Image source={{ uri: item.posterUrl }} style={styles.posterImage} />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Text style={styles.posterPlaceholderText} numberOfLines={3}>
              {item.title}
            </Text>
          </View>
        )}
        {released ? (
          <Pressable
            style={[styles.glass, styles.posterHeart]}
            onPress={onToggleFavorite}
            hitSlop={6}
          >
            <GlassLayer />
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={15}
              color={isFavorite ? colors.danger : colors.textPrimary}
            />
          </Pressable>
        ) : (
          <View style={[styles.glass, styles.posterClock]}>
            <GlassLayer />
            <Ionicons
              name="time-outline"
              size={14}
              color={colors.accentBright}
            />
          </View>
        )}
        <Pressable
          style={[styles.glass, styles.posterAdd]}
          onPress={isAdded ? onRemove : onAdd}
          hitSlop={6}
          accessibilityRole="button"
        >
          <GlassLayer />
          <Ionicons
            name={isAdded ? "checkmark" : "add"}
            size={22}
            color={isAdded ? colors.accentBright : colors.textPrimary}
          />
        </Pressable>
      </Pressable>
      <Pressable onPress={onPress} style={styles.posterText}>
        <Text style={styles.posterTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.posterMeta} numberOfLines={1}>
          {item.releaseYear || "—"} · ★ {item.rating.toFixed(1)}
        </Text>
      </Pressable>
    </View>
  );
}

interface UpcomingCardProps {
  item: MovieResult;
  isAdded: boolean;
  onPress: () => void;
  onAdd: () => void;
  onRemove: () => void;
}

function UpcomingCard({
  item,
  isAdded,
  onPress,
  onAdd,
  onRemove,
}: UpcomingCardProps) {
  const { t, i18n } = useTranslation("discover");
  return (
    <Pressable style={styles.upcomingCard} onPress={onPress}>
      {item.posterUrl ? (
        <Image source={{ uri: item.posterUrl }} style={styles.upcomingPoster} />
      ) : (
        <View style={[styles.upcomingPoster, styles.posterPlaceholder]} />
      )}
      <View style={styles.upcomingBody}>
        {item.releaseDate ? (
          <View style={styles.dateChip}>
            <Text style={styles.dateChipText}>
              {formatShortDate(item.releaseDate, i18n.language).toUpperCase()}
            </Text>
          </View>
        ) : null}
        <Text style={styles.upcomingTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.posterMeta}>
          {item.mediaType === "tv"
            ? t("search.friends.tvShow")
            : t("search.friends.movie")}
        </Text>
        <Pressable
          style={[styles.upcomingButton, isAdded && styles.upcomingButtonAdded]}
          onPress={isAdded ? onRemove : onAdd}
          hitSlop={4}
        >
          <Ionicons
            name={isAdded ? "checkmark" : "add"}
            size={14}
            color={isAdded ? colors.textMuted : colors.accentBright}
          />
          <Text
            style={[
              styles.upcomingButtonText,
              isAdded && styles.upcomingButtonTextAdded,
            ]}
          >
            {isAdded ? t("search.upcomingAdded") : t("search.upcomingAdd")}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function SectionHeader({
  title,
  badge,
  badgeColor,
}: {
  title: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} numberOfLines={2}>
        {title}
      </Text>
      {badge ? (
        <View style={[styles.sectionBadge, { borderColor: badgeColor }]}>
          <Text style={[styles.sectionBadgeText, { color: badgeColor }]}>
            {badge}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

interface CarouselProps {
  title: string;
  badge?: string;
  badgeColor?: string;
  data: MovieResult[];
  variant?: "poster" | "upcoming";
  onPressItem: (item: MovieResult) => void;
  favoriteIds: Set<number>;
  addedIds: Set<number>;
  onAdd: (item: MovieResult) => void;
  onRemove: (item: MovieResult) => void;
  onToggleFavorite: (item: MovieResult) => void;
  emptyHint?: string;
}

function Carousel({
  title,
  badge,
  badgeColor = colors.danger,
  data,
  variant = "poster",
  onPressItem,
  favoriteIds,
  addedIds,
  onAdd,
  onRemove,
  onToggleFavorite,
  emptyHint,
}: CarouselProps) {
  if (data.length === 0 && !emptyHint) return null;
  return (
    <View style={styles.section}>
      <SectionHeader title={title} badge={badge} badgeColor={badgeColor} />
      {data.length === 0 ? (
        <Text style={styles.carouselEmptyHint}>{emptyHint}</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselRow}
        >
          {data.map((item, index) =>
            variant === "upcoming" ? (
              <UpcomingCard
                key={`${item.id}-${index}`}
                item={item}
                isAdded={addedIds.has(item.id)}
                onPress={() => onPressItem(item)}
                onAdd={() => onAdd(item)}
                onRemove={() => onRemove(item)}
              />
            ) : (
              <PosterTile
                key={`${item.id}-${index}`}
                item={item}
                width={132}
                isFavorite={favoriteIds.has(item.id)}
                isAdded={addedIds.has(item.id)}
                onPress={() => onPressItem(item)}
                onAdd={() => onAdd(item)}
                onRemove={() => onRemove(item)}
                onToggleFavorite={() => onToggleFavorite(item)}
              />
            ),
          )}
        </ScrollView>
      )}
    </View>
  );
}

export default function SearchScreen({ navigation, route }: Props) {
  const { t } = useTranslation("discover");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MovieResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trending, setTrending] = useState<MovieResult[]>([]);
  const [upcoming, setUpcoming] = useState<MovieResult[]>([]);
  const [recommendations, setRecommendations] = useState<MovieResult[]>([]);
  const [becauseYouWatched, setBecauseYouWatched] =
    useState<BecauseYouWatchedResponse | null>(null);
  const [friendsActivity, setFriendsActivity] = useState<FriendLastWatched[]>(
    [],
  );
  const [isLoadingHome, setIsLoadingHome] = useState(true);

  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [watchedIds, setWatchedIds] = useState<Set<number>>(new Set());
  const [addTarget, setAddTarget] = useState<MovieResult | null>(null);

  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [swipeStatus, setSwipeStatus] = useState<SwipeStatus | null>(null);
  const [filters, setFilters] = useState<SmartSearchFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [mediaScope, setMediaScope] = useState<MediaScope>("all");
  const { width: windowWidth } = useWindowDimensions();
  const [similarToTitle, setSimilarToTitle] = useState<string | null>(null);
  const similarActiveRef = useRef(false);
  const { toastMessage, showToast } = useToast();

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && v !== false,
  );

  useEffect(() => {
    Promise.all([
      getTrending().catch(logFallback("SearchScreen: getTrending", [])),
      getUpcomingMovies().catch(logFallback("SearchScreen: getUpcomingMovies", [])),
      getRecommendations().catch(logFallback("SearchScreen: getRecommendations", [])),
      getBecauseYouWatched().catch(logFallback("SearchScreen: getBecauseYouWatched", null)),
      getFriendsLastWatched().catch(logFallback("SearchScreen: getFriendsLastWatched", [])),
      getProfile().catch(logFallback("SearchScreen: getProfile", null)),
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

    getSwipeStatus()
      .then(setSwipeStatus)
      .catch(logError("SearchScreen: getSwipeStatus"));
    getSearchHistory()
      .then((items) => setSearchHistory(items.map((i) => i.queryText)))
      .catch(logError("SearchScreen: getSearchHistory"));
  }, []);

  const runSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setIsSearching(true);
    setError(null);
    const request = hasActiveFilters
      ? smartSearchMovies(trimmed, filters)
      : searchMovies(trimmed);
    request
      .then((res) => {
        setResults(res);
        getSearchHistory()
          .then((items) => setSearchHistory(items.map((i) => i.queryText)))
          .catch(logError("SearchScreen: getSearchHistory"));
      })
      .catch((err) => setError(getErrorMessage(err, t("search.searchFailed"))))
      .finally(() => setIsSearching(false));
  };

  const runSearchForQuery = useEffectEvent((q: string) => runSearch(q));

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      if (!similarActiveRef.current) {
        setResults([]);
        setError(null);
      }
      return;
    }
    similarActiveRef.current = false;
    setSimilarToTitle(null);
    const timeout = setTimeout(() => runSearchForQuery(trimmed), 350);
    return () => clearTimeout(timeout);
  }, [query]);

  const similarTo = route.params?.similarTo;
  useEffect(() => {
    if (!similarTo) return;
    similarActiveRef.current = true;
    setFilters({});
    setShowFilters(false);
    setQuery("");
    setSimilarToTitle(similarTo.title);
    setIsSearching(true);
    setError(null);
    findSimilarMoviesSemantic(similarTo.tmdbId)
      .then(setResults)
      .catch((err) => setError(getErrorMessage(err, t("search.searchFailed"))))
      .finally(() => setIsSearching(false));
    navigation.setParams({ similarTo: undefined });
  }, [similarTo, navigation, t]);

  const goToMovie = (item: MovieResult) => {
    navigation.navigate("MovieDetail", {
      movieId: item.id,
      title: item.title,
      mediaType: item.mediaType,
    });
  };

  const handleClearSearch = () => {
    similarActiveRef.current = false;
    setSimilarToTitle(null);
    setQuery("");
    setResults([]);
    setError(null);
  };

  const handleClearHistory = async () => {
    setSearchHistory([]);
    try {
      await clearSearchHistory();
    } catch {
      getSearchHistory()
        .then((items) => setSearchHistory(items.map((i) => i.queryText)))
        .catch(logError("SearchScreen: getSearchHistory"));
    }
  };

  const handleAdd = (item: MovieResult) => {
    if (isReleased(item)) setAddTarget(item);
    else void addToWatchlistOnly(item);
  };

  const addToWatchlistOnly = async (item: MovieResult) => {
    setAddedIds((prev) => new Set(prev).add(item.id));
    try {
      await addToWatchlist({
        tmdbId: item.id,
        title: item.title,
        posterUrl: item.posterUrl,
        mediaType: item.mediaType,
        releaseDate: item.releaseDate,
      });
      showToast(t("search.addedToWatchlist"));
    } catch (err) {
      const apiError = err as { response?: { status?: number } };
      if (apiError.response?.status !== 400) {
        setAddedIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        showToast(getErrorMessage(err, t("search.addToWatchlistError")));
      }
    }
  };

  const handleMarkWatched = async (
    item: MovieResult,
    rating: number | null,
  ) => {
    try {
      await addToWatchlist({
        tmdbId: item.id,
        title: item.title,
        posterUrl: item.posterUrl,
        mediaType: item.mediaType,
        releaseDate: item.releaseDate,
      });
    } catch (err) {
      const apiError = err as { response?: { status?: number } };
      if (apiError.response?.status !== 400) {
        showToast(getErrorMessage(err, t("search.addToWatchlistError")));
        return;
      }
    }
    try {
      await markAsWatched(item.id);
      if (rating) await rateMovie(item.id, rating);
      setAddedIds((prev) => new Set(prev).add(item.id));
      setWatchedIds((prev) => new Set(prev).add(item.id));
      showToast(t("search.addedToWatchlist"));
    } catch (err) {
      showToast(getErrorMessage(err, t("search.addToWatchlistError")));
    }
  };

  const handleRemove = async (item: MovieResult) => {
    setAddedIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
    try {
      await removeFromWatchlist(item.id);
      showToast(t("search.removedFromWatchlist"));
    } catch (err) {
      setAddedIds((prev) => new Set(prev).add(item.id));
      showToast(getErrorMessage(err, t("search.removeFromWatchlistError")));
    }
  };

  const handleToggleFavorite = async (item: MovieResult) => {
    if (!isReleased(item)) {
      showToast(t("search.notReleasedYet"));
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
          showToast(t("search.favoriteUpdateError"));
        }
      } else if (apiError.response?.status === 400) {
        showToast(t("search.favoriteLimit"));
      } else {
        showToast("Could not update favorite.");
      }
    }
  };

  const isSearchMode = query.trim().length >= 2 || similarToTitle !== null;
  const isIdle = !isSearchMode && !isSearching;
  const inScope = (m: MovieResult) =>
    mediaScope === "all" || m.mediaType === mediaScope;
  const visibleRecommendations = recommendations
    .filter((m) => !addedIds.has(m.id) && inScope(m))
    .slice(0, 20);
  const visibleBecauseYouWatched = becauseYouWatched
    ? becauseYouWatched.similarMovies.filter(
        (m) => !watchedIds.has(m.id) && inScope(m),
      )
    : [];
  const visibleResults = results.filter(inScope);
  const gridTileWidth = Math.floor(
    (windowWidth - H_PAD * 2 - GRID_GAP * 2) / 3,
  );
  const showMovies = mediaScope !== "tv";
  const showTv = mediaScope !== "movie";

  const carouselHandlers = {
    onPressItem: goToMovie,
    favoriteIds,
    addedIds,
    onAdd: (item: MovieResult) => void handleAdd(item),
    onRemove: (item: MovieResult) => void handleRemove(item),
    onToggleFavorite: (item: MovieResult) => void handleToggleFavorite(item),
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScreenHeader />

      <View style={styles.searchBlock}>
        <View style={styles.searchField}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("search.placeholder")}
            placeholderTextColor={colors.textFaint}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => runSearch(query)}
          />
          {query.length > 0 ? (
            <Pressable
              onPress={handleClearSearch}
              hitSlop={10}
              accessibilityLabel={t("search.clear")}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.textFaint}
              />
            </Pressable>
          ) : null}
          <Pressable
            style={[
              styles.filterButton,
              (showFilters || hasActiveFilters) && styles.filterButtonActive,
            ]}
            onPress={() => setShowFilters((v) => !v)}
            accessibilityLabel="Filters"
          >
            <Ionicons
              name="options-outline"
              size={19}
              color={
                showFilters || hasActiveFilters
                  ? colors.textOnAccent
                  : colors.accentBright
              }
            />
          </Pressable>
        </View>

        <View style={styles.scopeRow}>
          {(["all", "movie", "tv"] as const).map((scope) => (
            <Pressable
              key={scope}
              style={[
                styles.scopeChip,
                mediaScope === scope && styles.scopeChipActive,
              ]}
              onPress={() => setMediaScope(scope)}
            >
              <Text
                style={[
                  styles.scopeChipText,
                  mediaScope === scope && styles.scopeChipTextActive,
                ]}
              >
                {scope === "all"
                  ? t("search.scope.all")
                  : scope === "movie"
                    ? t("search.scope.movies")
                    : t("search.scope.tv")}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {showFilters ? (
        <SearchFilterBar
          filters={filters}
          onChange={setFilters}
          onApply={() => runSearch(query)}
        />
      ) : null}

      {isSearchMode ? (
        error ? (
          <Text style={styles.error}>{error}</Text>
        ) : isSearching ? (
          <ActivityIndicator color={colors.accent} style={styles.spinner} />
        ) : (
          <FlatList
            data={visibleResults}
            key="search-results"
            numColumns={3}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.gridColumn}
            ListHeaderComponent={
              visibleResults.length > 0 ? (
                <View style={styles.resultsHeader}>
                  <Text style={styles.resultsHeaderTitle} numberOfLines={2}>
                    {similarToTitle
                      ? `${t("search.similarTo")} "${similarToTitle}"`
                      : t("search.resultsTitle")}
                  </Text>
                  <Pressable
                    onPress={handleClearSearch}
                    hitSlop={8}
                    style={styles.resultsHeaderBack}
                  >
                    <Ionicons
                      name="arrow-back"
                      size={14}
                      color={colors.accentBright}
                    />
                    <Text style={styles.resultsHeaderBackText}>
                      {t("search.goBack")}
                    </Text>
                  </Pressable>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <Text style={styles.emptyText}>{t("search.noResults")}</Text>
            }
            renderItem={({ item }) => (
              <PosterTile
                item={item}
                width={gridTileWidth}
                isFavorite={favoriteIds.has(item.id)}
                isAdded={addedIds.has(item.id)}
                onPress={() => goToMovie(item)}
                onAdd={() => void handleAdd(item)}
                onRemove={() => void handleRemove(item)}
                onToggleFavorite={() => void handleToggleFavorite(item)}
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
              <Text style={styles.historyLabel}>
                {t("search.recent").toUpperCase()}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.historyChips}
              >
                {searchHistory.map((q) => (
                  <Pressable
                    key={q}
                    style={styles.historyChip}
                    onPress={() => setQuery(q)}
                  >
                    <Ionicons
                      name="time-outline"
                      size={13}
                      color={colors.textMuted}
                    />
                    <Text style={styles.historyChipText}>{q}</Text>
                  </Pressable>
                ))}
                <Pressable
                  style={styles.historyChip}
                  onPress={() => void handleClearHistory()}
                >
                  <Ionicons
                    name="close"
                    size={13}
                    color={colors.accentBright}
                  />
                  <Text style={styles.historyClearText}>
                    {t("search.clear")}
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          ) : null}

          {isIdle ? (
            <View style={styles.introBlock}>
              <Pressable
                style={styles.discoverCard}
                onPress={() => navigation.navigate("Discover")}
              >
                <View style={styles.discoverStack}>
                  <View
                    style={[styles.discoverStackCard, styles.discoverStackBack]}
                  />
                  <View
                    style={[
                      styles.discoverStackCard,
                      styles.discoverStackFront,
                    ]}
                  >
                    {trending[1]?.posterUrl ? (
                      <Image
                        source={{ uri: trending[1].posterUrl }}
                        style={styles.posterImage}
                      />
                    ) : null}
                  </View>
                </View>
                <View style={styles.discoverText}>
                  <Text style={styles.discoverTitle}>
                    {t("search.promo.title")}
                  </Text>
                  <Text style={styles.discoverSubtitle}>
                    {swipeStatus && swipeStatus.remainingToday > 0
                      ? t("search.promo.subtitle", {
                          remaining: swipeStatus.remainingToday,
                          dailyLimit: swipeStatus.dailyLimit,
                        })
                      : t("search.promoDone")}
                  </Text>
                </View>
                <View style={styles.discoverArrow}>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={colors.textOnAccent}
                  />
                </View>
              </Pressable>

              <View style={styles.top100Row}>
                {(
                  [
                    {
                      type: "movie",
                      tag: t("search.top100.collection"),
                      title: t("search.top100.moviesTitle"),
                      poster: trending[0]?.posterUrl,
                    },
                    {
                      type: "tv",
                      tag: t("search.top100.curated"),
                      title: t("search.top100.tvTitle"),
                      poster: upcoming[0]?.posterUrl,
                    },
                  ] as const
                ).map((card) => (
                  <Pressable
                    key={card.type}
                    style={styles.top100Card}
                    onPress={() =>
                      navigation.navigate("Top100", { type: card.type })
                    }
                  >
                    {card.poster ? (
                      <Image
                        source={{ uri: card.poster }}
                        style={styles.top100Image}
                      />
                    ) : null}
                    <LinearGradient
                      colors={["rgba(15,13,10,.2)", "rgba(15,13,10,.95)"]}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.top100Watermark}>100</Text>
                    <Text style={styles.top100Tag}>
                      {card.tag.toUpperCase()}
                    </Text>
                    <Text style={styles.top100Title} numberOfLines={2}>
                      {card.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {showMovies ? (
            <Carousel
              title={t("search.carousels.trendingMovies")}
              badge={t("search.carousels.hot").toUpperCase()}
              badgeColor={colors.danger}
              data={trending.filter((m) => m.mediaType === "movie")}
              {...carouselHandlers}
            />
          ) : null}

          {showTv ? (
            <Carousel
              title={t("search.carousels.trendingTv")}
              badge={t("search.carousels.hot").toUpperCase()}
              badgeColor={colors.danger}
              data={trending.filter((m) => m.mediaType === "tv")}
              {...carouselHandlers}
            />
          ) : null}

          {showMovies ? (
            <Carousel
              title={t("search.carousels.comingSoonMovies")}
              badge={t("search.carousels.new").toUpperCase()}
              badgeColor={colors.accentBright}
              variant="upcoming"
              data={upcoming
                .filter((m) => m.mediaType === "movie")
                .slice(0, 10)}
              {...carouselHandlers}
            />
          ) : null}

          {showTv ? (
            <Carousel
              title={t("search.carousels.comingSoonTv")}
              badge={t("search.carousels.new").toUpperCase()}
              badgeColor={colors.accentBright}
              variant="upcoming"
              data={upcoming.filter((m) => m.mediaType === "tv").slice(0, 10)}
              {...carouselHandlers}
            />
          ) : null}

          <Carousel
            title={t("search.carousels.recommendedForYou")}
            badge={t("search.carousels.ai").toUpperCase()}
            badgeColor={colors.accentBright}
            data={visibleRecommendations}
            emptyHint={t("search.carousels.recommendationsEmptyHint")}
            {...carouselHandlers}
          />

          {becauseYouWatched && visibleBecauseYouWatched.length > 0 ? (
            <Carousel
              title={t("search.carousels.becauseYouWatched", {
                title: becauseYouWatched.basedOnMovie.title,
              })}
              data={visibleBecauseYouWatched}
              {...carouselHandlers}
            />
          ) : null}

          {friendsActivity.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title={t("search.friends.sectionTitle")} />
              <View style={styles.friendList}>
                {friendsActivity.slice(0, 6).map((entry) => (
                  <Pressable
                    key={`${entry.user.id}-${entry.tmdbId}`}
                    style={styles.friendRow}
                    onPress={() =>
                      navigation.navigate("MovieDetail", {
                        movieId: entry.tmdbId,
                        title: entry.title,
                        mediaType: entry.mediaType === "tv" ? "tv" : "movie",
                      })
                    }
                  >
                    {entry.user.avatarUrl ? (
                      <Image
                        source={{ uri: entry.user.avatarUrl }}
                        style={styles.friendAvatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.friendAvatar,
                          styles.friendAvatarFallback,
                        ]}
                      >
                        <Text style={styles.friendAvatarInitial}>
                          {entry.user.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.friendTextGroup}>
                      <Text style={styles.friendLine} numberOfLines={2}>
                        <Text style={styles.friendUsername}>
                          {t("search.friends.userWatched", {
                            username: entry.user.username,
                          })}
                        </Text>{" "}
                        <Text style={styles.friendMovieTitle}>
                          {entry.title}
                        </Text>
                      </Text>
                      <Text style={styles.friendMeta}>
                        {entry.mediaType === "tv"
                          ? t("search.friends.tvShow")
                          : t("search.friends.movie")}
                        {entry.watchedAt
                          ? ` · ${formatTimeAgo(entry.watchedAt)}`
                          : ""}
                      </Text>
                    </View>
                    {entry.posterUrl ? (
                      <Image
                        source={{ uri: entry.posterUrl }}
                        style={styles.friendPoster}
                      />
                    ) : (
                      <View
                        style={[styles.friendPoster, styles.posterPlaceholder]}
                      />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      <AddMovieModal
        visible={addTarget !== null}
        title={addTarget?.title ?? ""}
        onClose={() => setAddTarget(null)}
        onAddToWatchlist={() => {
          const item = addTarget;
          setAddTarget(null);
          if (item) void addToWatchlistOnly(item);
        }}
        onMarkWatched={(rating) => {
          const item = addTarget;
          setAddTarget(null);
          if (item) void handleMarkWatched(item, rating);
        }}
      />

      <Toast message={toastMessage} />
    </SafeAreaView>
  );
}

const GRID_GAP = spacing.sm + 2;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  searchBlock: {
    paddingHorizontal: H_PAD,
    gap: spacing.sm + 4,
    marginBottom: spacing.md,
  },
  searchField: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    paddingLeft: spacing.md,
    paddingRight: 6,
    borderRadius: 16,
    backgroundColor: "#18150f",
    borderWidth: 1,
    borderColor: "rgba(217,172,84,.28)",
  },
  searchInput: {
    flex: 1,
    height: "100%",
    color: colors.textPrimary,
    fontSize: 15,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(217,172,84,.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonActive: { backgroundColor: colors.accent },
  scopeRow: { flexDirection: "row", gap: spacing.sm },
  scopeChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.14)",
    justifyContent: "center",
  },
  scopeChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  scopeChipText: {
    color: colors.textSubtle,
    fontSize: 12.5,
    fontWeight: fontWeight.semibold,
  },
  scopeChipTextActive: {
    color: colors.textOnAccent,
    fontWeight: fontWeight.bold,
  },
  spinner: { marginTop: spacing.xl },
  error: {
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  grid: { paddingHorizontal: H_PAD, paddingBottom: spacing.xl },
  gridColumn: { gap: GRID_GAP, marginBottom: spacing.md + 2 },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  resultsHeaderTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: fontWeight.bold,
  },
  resultsHeaderBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 32,
  },
  resultsHeaderBackText: {
    color: colors.accentBright,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  homeContent: { paddingBottom: spacing.xl, gap: 28 },
  historySection: { gap: spacing.sm },
  historyLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    letterSpacing: 2,
    paddingHorizontal: H_PAD,
  },
  historyChips: { gap: spacing.sm, paddingHorizontal: H_PAD },
  historyChip: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
  },
  historyChipText: { color: colors.textSubtle, fontSize: 12.5 },
  historyClearText: {
    color: colors.accentBright,
    fontSize: 12.5,
    fontWeight: fontWeight.semibold,
  },
  introBlock: { paddingHorizontal: H_PAD, gap: spacing.md },
  discoverCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: "#1a160f",
    borderWidth: 1,
    borderColor: "rgba(217,172,84,.3)",
  },
  discoverStack: { width: 52, height: 64 },
  discoverStackCard: {
    position: "absolute",
    width: 40,
    height: 58,
    borderRadius: 6,
    overflow: "hidden",
  },
  discoverStackBack: {
    left: 10,
    top: 0,
    backgroundColor: "#4a3a22",
    transform: [{ rotate: "8deg" }],
  },
  discoverStackFront: {
    left: 0,
    top: 4,
    backgroundColor: "#7a5c2c",
    borderWidth: 1,
    borderColor: "rgba(242,234,217,.2)",
  },
  discoverText: { flex: 1, minWidth: 0, gap: 4 },
  discoverTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: fontWeight.bold,
  },
  discoverSubtitle: { color: "#a89d88", fontSize: 12.5 },
  discoverArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  top100Row: { flexDirection: "row", gap: spacing.sm + 4 },
  top100Card: {
    flex: 1,
    height: 112,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#2a2116",
    borderWidth: 1,
    borderColor: "rgba(217,172,84,.16)",
    justifyContent: "flex-end",
    padding: 14,
  },
  top100Image: { ...StyleSheet.absoluteFill, opacity: 0.45 },
  top100Watermark: {
    position: "absolute",
    right: 10,
    top: 2,
    color: "rgba(217,172,84,.22)",
    fontSize: 40,
    fontWeight: fontWeight.black,
  },
  top100Tag: {
    color: colors.accentBright,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.6,
  },
  top100Title: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: fontWeight.bold,
    marginTop: 4,
  },
  section: { gap: 14 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: H_PAD,
  },
  sectionTitle: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: fontWeight.bold,
  },
  sectionBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  sectionBadgeText: {
    fontSize: 9.5,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.2,
  },
  carouselEmptyHint: {
    marginHorizontal: H_PAD,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(217,172,84,.2)",
    borderStyle: "dashed",
    borderRadius: radius.md,
    color: colors.textMuted,
    fontSize: 12.5,
    textAlign: "center",
  },
  carouselRow: { gap: spacing.sm + 4, paddingHorizontal: H_PAD },
  poster: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: "rgba(242,234,217,.08)",
  },
  posterImage: { width: "100%", height: "100%" },
  posterPlaceholder: {
    flex: 1,
    backgroundColor: colors.backgroundElevated,
    justifyContent: "flex-end",
    padding: 10,
  },
  posterPlaceholderText: {
    color: "rgba(242,234,217,.5)",
    fontSize: 13,
    fontWeight: fontWeight.bold,
  },
  glass: {
    position: "absolute",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,.35)",
    backgroundColor: "rgba(20,17,12,.25)",
  },
  glassSheen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255,255,255,.08)",
  },
  posterHeart: { top: 8, right: 8, width: 32, height: 32, borderRadius: 16 },
  posterClock: { top: 8, left: 8, width: 30, height: 30, borderRadius: 15 },
  posterAdd: { right: 8, bottom: 8, width: 38, height: 38, borderRadius: 19 },
  posterText: { gap: 2 },
  posterTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  posterMeta: { color: colors.textMuted, fontSize: 12 },
  upcomingCard: {
    width: 250,
    flexDirection: "row",
    gap: spacing.sm + 4,
    padding: 10,
    borderRadius: 16,
    backgroundColor: "#17140f",
    borderWidth: 1,
    borderColor: "rgba(217,172,84,.14)",
  },
  upcomingPoster: {
    width: 72,
    height: 106,
    borderRadius: 8,
    overflow: "hidden",
  },
  upcomingBody: { flex: 1, minWidth: 0, gap: 6 },
  dateChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentBright,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  dateChipText: {
    color: colors.textOnAccent,
    fontSize: 10.5,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
  upcomingTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  upcomingButton: {
    marginTop: "auto",
    alignSelf: "flex-start",
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(217,172,84,.45)",
  },
  upcomingButtonAdded: { borderColor: "rgba(255,255,255,.14)" },
  upcomingButtonText: {
    color: colors.accentBright,
    fontSize: 11.5,
    fontWeight: fontWeight.bold,
  },
  upcomingButtonTextAdded: { color: colors.textMuted },
  friendList: { paddingHorizontal: H_PAD },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(217,172,84,.1)",
  },
  friendAvatar: { width: 36, height: 36, borderRadius: 18 },
  friendAvatarFallback: {
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  friendAvatarInitial: {
    color: colors.textOnAccent,
    fontSize: 14,
    fontWeight: fontWeight.bold,
  },
  friendTextGroup: { flex: 1, minWidth: 0, gap: 2 },
  friendLine: { fontSize: 13.5 },
  friendUsername: { color: colors.textMuted },
  friendMovieTitle: {
    color: colors.accentBright,
    fontWeight: fontWeight.semibold,
  },
  friendMeta: { color: colors.textMuted, fontSize: 11.5 },
  friendPoster: { width: 34, height: 50, borderRadius: 5, overflow: "hidden" },
});
