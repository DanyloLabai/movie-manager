import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  MovieDetails,
  RecommendedMovie,
  WatchlistItem,
  WatchProvider,
} from "@movie-manager/shared";
import {
  addToWatchlist,
  getFriendsWatched,
  getMovieDetails,
  getMovieStatus,
  getRatingHistory,
  getSimilar,
  markAsWatched,
  rateMovie,
  removeFromWatchlist,
  rewatchMovie,
  toggleFavorite,
  updateEpisodeProgress,
  type RatingHistoryEntry,
} from "../../api/movies.api";
import type { FriendWatched } from "@movie-manager/shared";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { formatShortDate } from "../../utils/time";
import StarRating from "../../components/StarRating";
import MoviePosterCard from "../../components/MoviePosterCard";
import Toast from "../../components/Toast";
import AddMovieModal from "../../components/AddMovieModal";
import { useToast } from "../../hooks/useToast";
import { colors, spacing, radius, fontWeight } from "../../theme";
import type { MainStackParamList } from "../../navigation/MainStack";
import { logError } from "../../utils/logError";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/original";
const TMDB_PROVIDER_LOGO_BASE = "https://image.tmdb.org/t/p/w92";

type Props = NativeStackScreenProps<MainStackParamList, "MovieDetail">;

function getProviderLink(providerName: string, title: string): string | null {
  const query = encodeURIComponent(title);
  const name = providerName.toLowerCase();
  if (name.includes("netflix"))
    return `https://www.netflix.com/search?q=${query}`;
  if (name.includes("amazon") || name.includes("prime")) {
    return `https://www.primevideo.com/search/ref=atv_sr_sug_1?phrase=${query}`;
  }
  if (name.includes("apple"))
    return `https://tv.apple.com/search?term=${query}`;
  if (name.includes("youtube"))
    return `https://www.youtube.com/results?search_query=${query}+movie`;
  if (name.includes("google play"))
    return `https://play.google.com/store/search?q=${query}&c=movies`;
  return null;
}

const BUTTON_H = 50;

const isReleased = (dateStr?: string | null): boolean => {
  if (!dateStr) return true;
  return new Date(dateStr) <= new Date();
};

const RATING_HISTORY_DISPLAY_LIMIT = 6;

interface ActionTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}

function ActionTile({
  icon,
  label,
  onPress,
  disabled = false,
  active = false,
}: ActionTileProps) {
  const iconColor = active
    ? colors.danger
    : disabled
      ? colors.textFaint
      : colors.accentBright;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.tile,
        active && styles.tileActive,
        pressed && !disabled && styles.tilePressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text
        style={[styles.tileLabel, disabled && styles.tileLabelDisabled]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function MovieDetailScreen({ route, navigation }: Props) {
  const { t, i18n } = useTranslation("movie");
  const { movieId, mediaType = "movie" } = route.params;
  const [details, setDetails] = useState<MovieDetails | null>(null);
  const [status, setStatus] = useState<WatchlistItem | null>(null);
  const [similar, setSimilar] = useState<RecommendedMovie[]>([]);
  const [friendsWatched, setFriendsWatched] = useState<FriendWatched[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [modalRating, setModalRating] = useState(0);
  const [modalAction, setModalAction] = useState<"watched" | "rewatch">(
    "watched",
  );
  const [ratingHistory, setRatingHistory] = useState<RatingHistoryEntry[]>([]);
  const [progressSeason, setProgressSeason] = useState(1);
  const [progressEpisode, setProgressEpisode] = useState(1);
  const { toastMessage, showToast } = useToast();

  const scrollViewRef = useRef<ScrollView>(null);
  const trailerY = useRef(0);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [detailsResult, statusResult] = await Promise.all([
        getMovieDetails(movieId, mediaType),
        getMovieStatus(movieId),
      ]);
      setDetails(detailsResult);
      setStatus(statusResult);
      getSimilar(movieId, mediaType)
        .then(setSimilar)
        .catch(logError("MovieDetailScreen: getSimilar"));
      getFriendsWatched(movieId, mediaType)
        .then(setFriendsWatched)
        .catch(logError("MovieDetailScreen: getFriendsWatched"));
      getRatingHistory(movieId)
        .then(setRatingHistory)
        .catch(logError("MovieDetailScreen: getRatingHistory"));
    } catch (err) {
      setError(getErrorMessage(err, t("errors.loadTitle")));
    } finally {
      setIsLoading(false);
    }
  }, [movieId, mediaType, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setProgressSeason(status?.currentSeason || 1);
    setProgressEpisode(status?.currentEpisode || 1);
  }, [status?.currentSeason, status?.currentEpisode]);

  const refreshHistory = () => {
    getRatingHistory(movieId)
      .then(setRatingHistory)
      .catch(logError("MovieDetailScreen: getRatingHistory"));
  };

  const handleAddWatchlist = async () => {
    if (!details || status) return;
    setIsActionPending(true);
    try {
      const item = await addToWatchlist({
        tmdbId: movieId,
        title: details.title,
        posterUrl: details.posterPath
          ? `${TMDB_IMAGE_BASE}${details.posterPath}`
          : null,
        mediaType,
        releaseDate: details.releaseDate,
      });
      setStatus(item);
    } catch (err) {
      setError(getErrorMessage(err, t("errors.updateWatchlist")));
    } finally {
      setIsActionPending(false);
    }
  };

  const openWatchedModal = () => {
    setModalAction("watched");
    setModalRating(status?.rating ?? 0);
    setIsRatingModalOpen(true);
  };

  const openRewatchModal = () => {
    setModalAction("rewatch");
    setModalRating(0);
    setIsRatingModalOpen(true);
  };

  const closeRatingModal = () => {
    setIsRatingModalOpen(false);
    setModalRating(0);
  };

  const handleConfirmRewatch = async () => {
    setIsActionPending(true);
    try {
      await rewatchMovie(movieId, modalRating > 0 ? modalRating : undefined);
      showToast(t("rewatch.logged"));
      setStatus(await getMovieStatus(movieId));
      refreshHistory();
    } catch (err) {
      setError(getErrorMessage(err, t("errors.rewatch")));
    } finally {
      setIsActionPending(false);
      closeRatingModal();
    }
  };

  const handleConfirmWatched = async () => {
    if (modalAction === "rewatch") {
      await handleConfirmRewatch();
      return;
    }
    await markWatchedWithRating(modalRating > 0 ? modalRating : null);
    closeRatingModal();
  };

  const markWatchedWithRating = async (rating: number | null) => {
    if (!details) return;
    setIsActionPending(true);
    try {
      if (!status) {
        await addToWatchlist({
          tmdbId: movieId,
          title: details.title,
          posterUrl: details.posterPath
            ? `${TMDB_IMAGE_BASE}${details.posterPath}`
            : null,
          mediaType,
          releaseDate: details.releaseDate,
        });
      }
      const watched = await markAsWatched(movieId);
      if (rating !== null) await rateMovie(movieId, rating);
      setStatus({ ...watched, rating: rating ?? watched.rating });
      refreshHistory();
    } catch (err) {
      setError(getErrorMessage(err, t("errors.markWatched")));
    } finally {
      setIsActionPending(false);
    }
  };

  const handleAddPress = () => {
    if (isReleased(details?.releaseDate)) setIsAddModalOpen(true);
    else void handleAddWatchlist();
  };

  const handleToggleFavorite = async () => {
    if (!status) return;
    setIsActionPending(true);
    try {
      setStatus(await toggleFavorite(movieId));
    } catch (err) {
      const httpStatus = (err as { response?: { status?: number } }).response
        ?.status;
      setError(
        httpStatus === 400
          ? t("errors.favoriteLimit")
          : getErrorMessage(err, t("errors.updateFavorite")),
      );
    } finally {
      setIsActionPending(false);
    }
  };

  const handleRate = async (rating: number) => {
    if (!status) return;
    setIsActionPending(true);
    try {
      await rateMovie(movieId, rating);
      setStatus({ ...status, rating });
      refreshHistory();
    } catch (err) {
      setError(getErrorMessage(err, t("errors.updateRating")));
    } finally {
      setIsActionPending(false);
    }
  };

  const handleRemove = async () => {
    setIsActionPending(true);
    try {
      await removeFromWatchlist(movieId);
      setStatus(null);
    } catch (err) {
      setError(getErrorMessage(err, t("errors.updateWatchlist")));
    } finally {
      setIsActionPending(false);
    }
  };

  const handleSaveProgress = async () => {
    if (!status) return;
    setIsActionPending(true);
    try {
      await updateEpisodeProgress(movieId, progressSeason, progressEpisode);
      setStatus({
        ...status,
        currentSeason: progressSeason,
        currentEpisode: progressEpisode,
      });
      showToast(t("progress.saved"));
    } catch (err) {
      setError(getErrorMessage(err, t("errors.progress")));
    } finally {
      setIsActionPending(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (error && !details) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!details) return null;

  const released = isReleased(details.releaseDate);
  const posterUrl = details.posterPath
    ? `${TMDB_IMAGE_BASE}${details.posterPath}`
    : null;
  const backdropUrl = details.backdropPath
    ? `${TMDB_BACKDROP_BASE}${details.backdropPath}`
    : null;
  const releaseYear = details.releaseDate
    ? details.releaseDate.slice(0, 4)
    : "—";
  const providers = details.watchProviders ?? [];

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.hero}>
        {backdropUrl ? (
          <>
            <Image
              source={{ uri: backdropUrl }}
              style={styles.heroImage}
              blurRadius={2}
            />
            <LinearGradient
              colors={["rgba(15,13,10,.3)", colors.backgroundDeep]}
              style={StyleSheet.absoluteFill}
            />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.heroFallback]} />
        )}
      </View>

      <View style={styles.headerRow}>
        <View style={styles.posterWrap}>
          {posterUrl ? (
            <Image source={{ uri: posterUrl }} style={styles.poster} />
          ) : (
            <View style={[styles.poster, styles.posterPlaceholder]} />
          )}
        </View>

        <View style={styles.headerInfo}>
          <View style={styles.mediaBadge}>
            <Text style={styles.mediaBadgeText}>
              {(mediaType === "tv"
                ? t("mediaType.tv")
                : t("mediaType.movie")
              ).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.title}>{details.title}</Text>
          <Text style={styles.meta}>
            {releaseYear}
            {details.runtime ? ` · ${details.runtime} min` : ""}
            {released ? ` · ★ ${details.voteAverage.toFixed(1)}` : ""}
          </Text>
          {details.genres.length > 0 ? (
            <Text style={styles.genres}>
              {details.genres.map((g) => g.name.toUpperCase()).join(" · ")}
            </Text>
          ) : null}
        </View>
      </View>

      {details.productionCountries.length > 0 ? (
        <Text style={styles.countries}>
          <Text style={styles.countriesLabel}>
            {t("productionCountriesLabel")}
          </Text>
          {details.productionCountries.join(", ")}
        </Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actionsBlock}>
        {!status ? (
          <Pressable
            style={styles.primaryButton}
            onPress={handleAddPress}
            disabled={isActionPending}
          >
            <Ionicons name="add" size={20} color={colors.textOnAccent} />
            <Text style={styles.primaryButtonText}>
              {t("actions.addToList")}
            </Text>
          </Pressable>
        ) : status.isWatched ? (
          <View style={styles.ratingCard}>
            <View style={styles.ratingCardHeader}>
              <View style={styles.watchedBadge}>
                <View style={styles.watchedBadgeDot}>
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={colors.textOnAccent}
                  />
                </View>
                <Text style={styles.watchedBadgeText}>
                  {t("actions.watchedBadge").toUpperCase()}
                </Text>
              </View>
              <Text style={styles.ratingValue}>
                {status.rating ? status.rating : "—"}
                <Text style={styles.ratingValueOutOf}>/10</Text>
              </Text>
            </View>
            <StarRating
              size="lg"
              value={status.rating ?? 0}
              onRate={(r) => void handleRate(r)}
            />
            {ratingHistory.length > 1 ? (
              <View style={styles.historyRow}>
                <Text style={styles.historyLabel}>
                  {t("rewatch.history").toUpperCase()}
                </Text>
                {ratingHistory
                  .slice(-RATING_HISTORY_DISPLAY_LIMIT)
                  .map((entry, i) => (
                    <View
                      key={`${entry.createdAt}-${i}`}
                      style={styles.historyBadge}
                    >
                      {entry.isRewatch ? (
                        <Ionicons
                          name="repeat"
                          size={12}
                          color={colors.accentBright}
                        />
                      ) : null}
                      <Text style={styles.historyBadgeText}>
                        {entry.rating}
                      </Text>
                    </View>
                  ))}
                {ratingHistory.some((e) => e.isRewatch) ? (
                  <Text style={styles.historyCount}>
                    {t("rewatch.count", {
                      count: ratingHistory.filter((e) => e.isRewatch).length,
                    })}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : released ? (
          <Pressable
            style={styles.primaryButton}
            onPress={openWatchedModal}
            disabled={isActionPending}
          >
            <Ionicons name="checkmark" size={20} color={colors.textOnAccent} />
            <Text style={styles.primaryButtonText}>
              {t("actions.markWatched")}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.statusPill}>
            <Ionicons
              name="time-outline"
              size={18}
              color={colors.accentBright}
            />
            <Text style={styles.statusPillText}>
              {t("actions.inWatchlist")}
            </Text>
            {details.releaseDate ? (
              <Text style={styles.statusPillMeta}>
                {formatShortDate(details.releaseDate, i18n.language)}
              </Text>
            ) : null}
          </View>
        )}

        <View style={styles.tileRow}>
          <ActionTile
            icon={status?.isFavorite ? "heart" : "heart-outline"}
            label={t("actions.favorite")}
            onPress={() => void handleToggleFavorite()}
            disabled={!status || !released || isActionPending}
            active={!!status?.isFavorite}
          />
          {details.trailerUrl ? (
            <ActionTile
              icon="play"
              label={t("actions.trailer")}
              onPress={() =>
                scrollViewRef.current?.scrollTo({
                  y: trailerY.current,
                  animated: true,
                })
              }
            />
          ) : null}
          {status?.isWatched ? (
            <ActionTile
              icon="repeat"
              label={t("actions.rewatch")}
              onPress={openRewatchModal}
              disabled={isActionPending}
            />
          ) : null}
          <ActionTile
            icon="sparkles-outline"
            label={t("actions.similar")}
            onPress={() =>
              navigation.navigate("Tabs", {
                screen: "Search",
                params: {
                  similarTo: { tmdbId: movieId, title: details.title },
                },
              })
            }
          />
        </View>
      </View>

      {mediaType === "tv" &&
      status &&
      details.seasons &&
      details.seasons.length > 0 ? (
        <View style={styles.progressBlock}>
          <Text style={styles.sectionTitleInline}>
            {t("progress.title").toUpperCase()}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {details.seasons.map((s) => (
              <Pressable
                key={s.seasonNumber}
                style={[
                  styles.chip,
                  progressSeason === s.seasonNumber && styles.chipActive,
                ]}
                onPress={() => {
                  setProgressSeason(s.seasonNumber);
                  setProgressEpisode(1);
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    progressSeason === s.seasonNumber && styles.chipTextActive,
                  ]}
                >
                  {s.name || `${t("progress.season")} ${s.seasonNumber}`}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {Array.from(
              {
                length:
                  details.seasons.find((s) => s.seasonNumber === progressSeason)
                    ?.episodeCount || 1,
              },
              (_, i) => i + 1,
            ).map((ep) => (
              <Pressable
                key={ep}
                style={[
                  styles.chip,
                  progressEpisode === ep && styles.chipActive,
                ]}
                onPress={() => setProgressEpisode(ep)}
              >
                <Text
                  style={[
                    styles.chipText,
                    progressEpisode === ep && styles.chipTextActive,
                  ]}
                >
                  {t("progress.episode")} {ep}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            style={[
              styles.primaryButton,
              progressSeason === status.currentSeason &&
                progressEpisode === status.currentEpisode &&
                styles.progressSaveDisabled,
            ]}
            onPress={() => void handleSaveProgress()}
            disabled={
              isActionPending ||
              (progressSeason === status.currentSeason &&
                progressEpisode === status.currentEpisode)
            }
          >
            <Text style={styles.primaryButtonText}>
              {t("progress.save").toUpperCase()}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.overview}>{details.overview}</Text>

      {status ? (
        <Pressable
          style={styles.removeButton}
          onPress={() => void handleRemove()}
          disabled={isActionPending}
        >
          <Text style={styles.removeButtonText}>
            {t("actions.removeFromLists")}
          </Text>
        </Pressable>
      ) : null}

      {details.cast.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>{t("topCast").toUpperCase()}</Text>
          <FlatList
            data={details.cast}
            horizontal
            keyExtractor={(item) => String(item.id)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.castList}
            renderItem={({ item }) => (
              <Pressable
                style={styles.castItem}
                onPress={() =>
                  navigation.push("ActorDetail", {
                    actorId: item.id,
                    name: item.name,
                  })
                }
              >
                {item.profile_path ? (
                  <Image
                    source={{ uri: `${TMDB_IMAGE_BASE}${item.profile_path}` }}
                    style={styles.castPhoto}
                  />
                ) : (
                  <View
                    style={[styles.castPhoto, styles.castPhotoPlaceholder]}
                  />
                )}
                <Text style={styles.castName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.castCharacter} numberOfLines={1}>
                  {item.character}
                </Text>
              </Pressable>
            )}
          />
        </>
      ) : null}

      {details.trailerUrl ? (
        <View
          onLayout={(e) => {
            trailerY.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.sectionTitle}>{t("trailer").toUpperCase()}</Text>
          <View style={styles.trailerWrap}>
            <WebView
              source={{
                html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;padding:0;background:#000;height:100%;}iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0;}</style></head><body><iframe src="${details.trailerUrl}?rel=0&modestbranding=1&playsinline=1" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe></body></html>`,
                baseUrl: "https://www.youtube.com",
              }}
              originWhitelist={["*"]}
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction={false}
              style={styles.trailerWebview}
            />
          </View>
        </View>
      ) : null}

      {providers.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>
            {t("whereToWatch").toUpperCase()}
          </Text>
          <View style={styles.providersRow}>
            {providers.map((p: WatchProvider) => {
              const link = getProviderLink(p.provider_name, details.title);
              return (
                <Pressable
                  key={p.provider_id}
                  style={styles.providerLogo}
                  disabled={!link}
                  onPress={() => link && Linking.openURL(link)}
                >
                  {p.logo_path ? (
                    <Image
                      source={{
                        uri: `${TMDB_PROVIDER_LOGO_BASE}${p.logo_path}`,
                      }}
                      style={styles.providerLogoImage}
                    />
                  ) : (
                    <View
                      style={[
                        styles.providerLogoImage,
                        styles.providerLogoPlaceholder,
                      ]}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {friendsWatched.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>
            {t("friendsWatchedThis").toUpperCase()}
          </Text>
          <View style={styles.friendsWatchedRow}>
            {friendsWatched.map((friend) => (
              <View key={friend.id} style={styles.friendChip}>
                {friend.avatarUrl ? (
                  <Image
                    source={{ uri: friend.avatarUrl }}
                    style={styles.friendChipAvatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.friendChipAvatar,
                      styles.friendChipAvatarFallback,
                    ]}
                  >
                    <Text style={styles.friendChipAvatarInitial}>
                      {friend.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.friendChipName} numberOfLines={1}>
                  {friend.username}
                </Text>
                {friend.rating ? (
                  <Text style={styles.friendChipRating}>★ {friend.rating}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </>
      ) : null}

      {similar.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>
            {t("moreLikeThis").toUpperCase()}
          </Text>
          <FlatList
            data={similar}
            horizontal
            keyExtractor={(item, index) => `${item.id}-${index}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.castList}
            renderItem={({ item }) => (
              <MoviePosterCard
                width={100}
                posterUrl={item.posterUrl ?? null}
                title={item.title}
                subtitle={item.releaseYear}
                onPress={() =>
                  navigation.push("MovieDetail", {
                    movieId: item.id,
                    title: item.title,
                    mediaType: item.mediaType === "tv" ? "tv" : "movie",
                  })
                }
              />
            )}
          />
        </>
      ) : null}

      <Modal
        visible={isRatingModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeRatingModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {modalAction === "rewatch"
                ? t("rewatch.title")
                : t("ratingModal.title")}
            </Text>
            <Text style={styles.modalSubtitle}>
              {modalAction === "rewatch"
                ? t("rewatch.subtitle", { title: details.title })
                : t("ratingModal.subtitle", { title: details.title })}
            </Text>
            <View style={styles.modalStars}>
              <StarRating
                size="lg"
                value={modalRating}
                onRate={setModalRating}
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={closeRatingModal}
                disabled={isActionPending}
              >
                <Text style={styles.modalCancelText}>
                  {t("common:cancel").toUpperCase()}
                </Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirm}
                onPress={() => void handleConfirmWatched()}
                disabled={isActionPending}
              >
                <Text style={styles.modalConfirmText}>
                  {t("common:ok").toUpperCase()}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <AddMovieModal
        visible={isAddModalOpen}
        title={details.title}
        onClose={() => setIsAddModalOpen(false)}
        onAddToWatchlist={() => {
          setIsAddModalOpen(false);
          void handleAddWatchlist();
        }}
        onMarkWatched={(rating) => {
          setIsAddModalOpen(false);
          void markWatchedWithRating(rating);
        }}
      />

      <Toast message={toastMessage} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  content: { paddingBottom: spacing.xl },
  hero: { height: 160, backgroundColor: colors.surfaceMuted },
  heroImage: { width: "100%", height: "100%", position: "absolute" },
  heroFallback: { backgroundColor: colors.surfaceMuted },
  headerRow: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: -64,
  },
  posterWrap: { width: 110, flexShrink: 0 },
  poster: { width: 110, aspectRatio: 2 / 3, borderRadius: radius.sm },
  posterPlaceholder: { backgroundColor: colors.backgroundElevated },
  headerInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: "flex-end",
    gap: 4,
    paddingBottom: 2,
  },
  mediaBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(217,172,84,.45)",
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: 2,
  },
  mediaBadgeText: {
    color: colors.accentBright,
    fontSize: 9,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.5,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: fontWeight.bold,
    lineHeight: 24,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: fontWeight.semibold,
  },
  genres: {
    color: colors.textFaint,
    fontSize: 9.5,
    letterSpacing: 1,
    marginTop: 2,
  },
  countries: {
    color: colors.textMuted,
    fontSize: 11,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  countriesLabel: { color: colors.accentBright },
  error: {
    color: colors.danger,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  actionsBlock: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.sm + 2,
  },
  primaryButton: {
    height: BUTTON_H,
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: colors.textOnAccent,
    fontSize: 14,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.4,
  },
  statusPill: {
    height: BUTTON_H,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(217,172,84,.4)",
    backgroundColor: "rgba(217,172,84,.08)",
  },
  statusPillText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  statusPillMeta: { color: colors.textMuted, fontSize: 12 },
  ratingCard: {
    gap: spacing.sm + 6,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: "rgba(217,172,84,.22)",
  },
  ratingCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  watchedBadge: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  watchedBadgeDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  watchedBadgeText: {
    color: colors.accentBright,
    fontSize: 13,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
  ratingValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: fontWeight.bold,
  },
  ratingValueOutOf: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  tileRow: { flexDirection: "row", gap: spacing.sm },
  tile: {
    flex: 1,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(217,172,84,.18)",
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  tileActive: {
    borderColor: "rgba(224,85,77,.45)",
    backgroundColor: "rgba(224,85,77,.1)",
  },
  tilePressed: { opacity: 0.7 },
  tileLabel: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
  },
  tileLabelDisabled: { color: colors.textFaint },
  historyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  historyLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: fontWeight.medium,
    letterSpacing: 1.5,
  },
  historyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(217,172,84,.1)",
    borderWidth: 1,
    borderColor: "rgba(217,172,84,.25)",
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  historyBadgeText: {
    color: colors.accentBright,
    fontSize: 10.5,
    fontWeight: fontWeight.bold,
  },
  historyCount: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: fontWeight.medium,
    textTransform: "uppercase",
  },
  progressBlock: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    gap: spacing.sm,
  },
  sectionTitleInline: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeight.medium,
    letterSpacing: 2,
  },
  chipRow: { gap: spacing.xs + 2 },
  chip: {
    borderWidth: 1,
    borderColor: "rgba(217,172,84,.3)",
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: {
    color: colors.textSubtle,
    fontSize: 11.5,
    fontWeight: fontWeight.semibold,
  },
  chipTextActive: { color: colors.textOnAccent },
  progressSaveDisabled: { opacity: 0.3 },
  removeButton: {
    alignSelf: "center",
    height: 44,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },
  removeButtonText: {
    color: "#d47a72",
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  overview: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.accentBright,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 2,
    textTransform: "uppercase",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  castList: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  castItem: { width: 80 },
  castPhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: spacing.xs,
  },
  castPhotoPlaceholder: { backgroundColor: colors.backgroundElevated },
  castName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
  },
  castCharacter: { color: colors.textMuted, fontSize: 11 },
  trailerWrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    aspectRatio: 16 / 9,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.backgroundDeep,
  },
  trailerWebview: { flex: 1, backgroundColor: "transparent" },
  providersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  providerLogo: { width: 40, height: 40 },
  providerLogoImage: { width: 40, height: 40, borderRadius: radius.sm },
  providerLogoPlaceholder: { backgroundColor: colors.backgroundElevated },
  friendsWatchedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  friendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    borderWidth: 1,
    borderColor: "rgba(217,172,84,.2)",
    borderRadius: radius.full,
    paddingLeft: 4,
    paddingRight: spacing.sm + 2,
    paddingVertical: 4,
  },
  friendChipAvatar: { width: 26, height: 26, borderRadius: 13 },
  friendChipAvatarFallback: {
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  friendChipAvatarInitial: {
    color: colors.textOnAccent,
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
  friendChipName: {
    color: colors.textPrimary,
    fontSize: 11.5,
    fontWeight: fontWeight.semibold,
    maxWidth: 90,
  },
  friendChipRating: {
    color: colors.accentBright,
    fontSize: 10.5,
    fontWeight: fontWeight.bold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "center",
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: fontWeight.bold,
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  modalStars: { marginBottom: spacing.md },
  modalActions: { flexDirection: "row", gap: spacing.sm, width: "100%" },
  modalCancel: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  modalCancelText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
  modalConfirm: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  modalConfirmText: {
    color: colors.textOnAccent,
    fontSize: 12,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
});
