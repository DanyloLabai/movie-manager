import { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MovieDetails, RecommendedMovie, WatchlistItem, WatchProvider } from '@movie-manager/shared';
import {
  addToWatchlist,
  getFriendsWatched,
  getMovieDetails,
  getMovieStatus,
  getSimilar,
  markAsWatched,
  rateMovie,
  removeFromWatchlist,
  toggleFavorite,
} from '../../api/movies.api';
import type { FriendWatched } from '@movie-manager/shared';
import { getErrorMessage } from '../../utils/getErrorMessage';
import StarRating from '../../components/StarRating';
import MoviePosterCard from '../../components/MoviePosterCard';
import { colors, spacing, radius, fontWeight } from '../../theme';
import type { MainStackParamList } from '../../navigation/MainStack';

// movie-frontend reads this from VITE_TMDB_IMAGE_BASE_URL — hardcoded here
// since it's TMDB's stable public CDN path, not something that varies per
// environment.
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/original';
const TMDB_PROVIDER_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

type Props = NativeStackScreenProps<MainStackParamList, 'MovieDetail'>;

// Ported from movie-frontend's MovieDetails.tsx WatchProvidersBlock —
// deep-links to each provider's own search page for the title instead of a
// generic JustWatch redirect.
function getProviderLink(providerName: string, title: string): string | null {
  const query = encodeURIComponent(title);
  const name = providerName.toLowerCase();
  if (name.includes('netflix')) return `https://www.netflix.com/search?q=${query}`;
  if (name.includes('amazon') || name.includes('prime')) {
    return `https://www.primevideo.com/search/ref=atv_sr_sug_1?phrase=${query}`;
  }
  if (name.includes('apple')) return `https://tv.apple.com/search?term=${query}`;
  if (name.includes('youtube')) return `https://www.youtube.com/results?search_query=${query}+movie`;
  if (name.includes('google play')) return `https://play.google.com/store/search?q=${query}&c=movies`;
  return null;
}

const isReleased = (dateStr?: string | null): boolean => {
  if (!dateStr) return true;
  return new Date(dateStr) <= new Date();
};

export default function MovieDetailScreen({ route, navigation }: Props) {
  const { movieId, mediaType = 'movie' } = route.params;
  const [details, setDetails] = useState<MovieDetails | null>(null);
  const [status, setStatus] = useState<WatchlistItem | null>(null);
  const [similar, setSimilar] = useState<RecommendedMovie[]>([]);
  const [friendsWatched, setFriendsWatched] = useState<FriendWatched[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);

  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [modalRating, setModalRating] = useState(0);

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
      getSimilar(movieId, mediaType).then(setSimilar).catch(() => {});
      getFriendsWatched(movieId, mediaType).then(setFriendsWatched).catch(() => {});
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load this title.'));
    } finally {
      setIsLoading(false);
    }
  }, [movieId, mediaType]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAddWatchlist = async () => {
    if (!details || status) return;
    setIsActionPending(true);
    try {
      const item = await addToWatchlist({
        tmdbId: movieId,
        title: details.title,
        posterUrl: details.posterPath ? `${TMDB_IMAGE_BASE}${details.posterPath}` : null,
        mediaType,
        releaseDate: details.releaseDate,
      });
      setStatus(item);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update your watchlist.'));
    } finally {
      setIsActionPending(false);
    }
  };

  const openWatchedModal = () => {
    setModalRating(status?.rating ?? 0);
    setIsRatingModalOpen(true);
  };

  const closeRatingModal = () => {
    setIsRatingModalOpen(false);
    setModalRating(0);
  };

  // Mirrors movie-frontend's MovieDetails.tsx handleModalConfirm: marking
  // watched works even without a prior watchlist entry — it adds one first
  // if needed, matching web's "new_watched" path.
  const handleConfirmWatched = async () => {
    if (!details) return;
    setIsActionPending(true);
    try {
      if (!status) {
        await addToWatchlist({
          tmdbId: movieId,
          title: details.title,
          posterUrl: details.posterPath ? `${TMDB_IMAGE_BASE}${details.posterPath}` : null,
          mediaType,
          releaseDate: details.releaseDate,
        });
      }
      const watched = await markAsWatched(movieId);
      if (modalRating > 0) await rateMovie(movieId, modalRating);
      setStatus({ ...watched, rating: modalRating > 0 ? modalRating : watched.rating });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not mark as watched.'));
    } finally {
      setIsActionPending(false);
      closeRatingModal();
    }
  };

  const handleToggleFavorite = async () => {
    if (!status) return;
    setIsActionPending(true);
    try {
      setStatus(await toggleFavorite(movieId));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update favorite.'));
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
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update rating.'));
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
      setError(getErrorMessage(err, 'Could not update your watchlist.'));
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
  const posterUrl = details.posterPath ? `${TMDB_IMAGE_BASE}${details.posterPath}` : null;
  const backdropUrl = details.backdropPath ? `${TMDB_BACKDROP_BASE}${details.backdropPath}` : null;
  const releaseYear = details.releaseDate ? details.releaseDate.slice(0, 4) : '—';
  const providers = details.watchProviders ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        {backdropUrl ? (
          <>
            <Image source={{ uri: backdropUrl }} style={styles.heroImage} blurRadius={2} />
            <LinearGradient
              colors={['rgba(15,13,10,.3)', colors.backgroundDeep]}
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
            <Text style={styles.mediaBadgeText}>{mediaType === 'tv' ? 'TV' : 'MOVIE'}</Text>
          </View>
          <Text style={styles.title}>{details.title}</Text>
          <Text style={styles.meta}>
            {releaseYear}
            {details.runtime ? ` · ${details.runtime} min` : ''}
            {released ? ` · ★ ${details.voteAverage.toFixed(1)}` : ''}
          </Text>
          {details.genres.length > 0 ? (
            <Text style={styles.genres}>
              {details.genres.map((g) => g.name.toUpperCase()).join(' · ')}
            </Text>
          ) : null}
        </View>
      </View>

      {details.productionCountries.length > 0 ? (
        <Text style={styles.countries}>
          <Text style={styles.countriesLabel}>Production Countries: </Text>
          {details.productionCountries.join(', ')}
        </Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        {!status ? (
          <Pressable
            style={[styles.secondaryButton, styles.actionFlex]}
            onPress={() => void handleAddWatchlist()}
            disabled={isActionPending}
          >
            <Text style={styles.secondaryButtonText}>+ ADD</Text>
          </Pressable>
        ) : null}
        {released ? (
          <Pressable
            style={[
              status?.isWatched ? styles.primaryButton : styles.secondaryButton,
              styles.actionFlex,
            ]}
            onPress={openWatchedModal}
            disabled={isActionPending}
          >
            <Text style={status?.isWatched ? styles.primaryButtonText : styles.secondaryButtonText}>
              ✓ {status?.isWatched ? 'WATCHED' : 'MARK WATCHED'}
            </Text>
          </Pressable>
        ) : null}
        {released ? (
          <Pressable
            style={[styles.heartButton, status?.isFavorite && styles.heartButtonActive]}
            onPress={() => void handleToggleFavorite()}
            disabled={!status || isActionPending}
          >
            <Ionicons
              name={status?.isFavorite ? 'heart' : 'heart-outline'}
              size={18}
              color={status?.isFavorite ? colors.danger : colors.textSubtle}
            />
          </Pressable>
        ) : (
          <View style={styles.heartButton}>
            <Ionicons name="time-outline" size={16} color={colors.accentBright} />
          </View>
        )}
        {details.trailerUrl ? (
          <Pressable style={styles.trailerButton} onPress={() => Linking.openURL(details.trailerUrl!)}>
            <Ionicons name="play" size={14} color={colors.textSubtle} />
            <Text style={styles.secondaryButtonText}>TRAILER</Text>
          </Pressable>
        ) : null}
      </View>

      {status?.isWatched ? (
        <View style={styles.ratingRow}>
          <Text style={styles.ratingLabel}>YOUR RATING</Text>
          <StarRating size="sm" value={status.rating ?? 0} onRate={(r) => void handleRate(r)} />
        </View>
      ) : null}

      {status ? (
        <Pressable style={styles.removeButton} onPress={() => void handleRemove()} disabled={isActionPending}>
          <Text style={styles.removeButtonText}>REMOVE FROM WATCHLIST</Text>
        </Pressable>
      ) : null}

      <Text style={styles.overview}>{details.overview}</Text>

      {details.cast.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>TOP CAST</Text>
          <FlatList
            data={details.cast}
            horizontal
            keyExtractor={(item) => String(item.id)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.castList}
            renderItem={({ item }) => (
              <Pressable
                style={styles.castItem}
                onPress={() => navigation.push('ActorDetail', { actorId: item.id, name: item.name })}
              >
                {item.profile_path ? (
                  <Image source={{ uri: `${TMDB_IMAGE_BASE}${item.profile_path}` }} style={styles.castPhoto} />
                ) : (
                  <View style={[styles.castPhoto, styles.castPhotoPlaceholder]} />
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

      {providers.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>WHERE TO WATCH</Text>
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
                      source={{ uri: `${TMDB_PROVIDER_LOGO_BASE}${p.logo_path}` }}
                      style={styles.providerLogoImage}
                    />
                  ) : (
                    <View style={[styles.providerLogoImage, styles.providerLogoPlaceholder]} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {friendsWatched.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>FRIENDS WATCHED THIS</Text>
          <View style={styles.friendsWatchedRow}>
            {friendsWatched.map((friend) => (
              <View key={friend.id} style={styles.friendChip}>
                {friend.avatarUrl ? (
                  <Image source={{ uri: friend.avatarUrl }} style={styles.friendChipAvatar} />
                ) : (
                  <View style={[styles.friendChipAvatar, styles.friendChipAvatarFallback]}>
                    <Text style={styles.friendChipAvatarInitial}>
                      {friend.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.friendChipName} numberOfLines={1}>
                  {friend.username}
                </Text>
                {friend.rating ? <Text style={styles.friendChipRating}>★ {friend.rating}</Text> : null}
              </View>
            ))}
          </View>
        </>
      ) : null}

      {similar.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>MORE LIKE THIS</Text>
          <FlatList
            data={similar}
            horizontal
            keyExtractor={(item) => String(item.id)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.castList}
            renderItem={({ item }) => (
              <MoviePosterCard
                width={100}
                posterUrl={item.posterUrl ?? null}
                title={item.title}
                subtitle={item.releaseYear}
                onPress={() =>
                  navigation.push('MovieDetail', {
                    movieId: item.id,
                    title: item.title,
                    mediaType: item.mediaType === 'tv' ? 'tv' : 'movie',
                  })
                }
              />
            )}
          />
        </>
      ) : null}

      <Modal visible={isRatingModalOpen} transparent animationType="fade" onRequestClose={closeRatingModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>How was it?</Text>
            <Text style={styles.modalSubtitle}>Rate "{details.title}"</Text>
            <View style={styles.modalStars}>
              <StarRating size="lg" value={modalRating} onRate={setModalRating} />
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={closeRatingModal} disabled={isActionPending}>
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirm}
                onPress={() => void handleConfirmWatched()}
                disabled={isActionPending}
              >
                <Text style={styles.modalConfirmText}>OK</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  content: { paddingBottom: spacing.xl },
  hero: { height: 160, backgroundColor: colors.surfaceMuted },
  heroImage: { width: '100%', height: '100%', position: 'absolute' },
  heroFallback: { backgroundColor: colors.surfaceMuted },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: -64,
  },
  posterWrap: { width: 110, flexShrink: 0 },
  poster: { width: 110, aspectRatio: 2 / 3, borderRadius: radius.sm },
  posterPlaceholder: { backgroundColor: colors.backgroundElevated },
  headerInfo: { flex: 1, minWidth: 0, justifyContent: 'flex-end', gap: 4, paddingBottom: 2 },
  mediaBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.45)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: 2,
  },
  mediaBadgeText: { color: colors.accentBright, fontSize: 9, fontWeight: fontWeight.semibold, letterSpacing: 1.5 },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: fontWeight.bold, lineHeight: 24 },
  meta: { color: colors.textMuted, fontSize: 11.5, fontWeight: fontWeight.semibold },
  genres: { color: colors.textFaint, fontSize: 9.5, letterSpacing: 1, marginTop: 2 },
  countries: { color: colors.textMuted, fontSize: 11, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  countriesLabel: { color: colors.accentBright },
  error: { color: colors.danger, fontSize: 13, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  actionFlex: { minWidth: 110, flexGrow: 1 },
  primaryButton: { backgroundColor: colors.accentBright, borderRadius: radius.full, paddingVertical: spacing.sm + 4, alignItems: 'center' },
  primaryButtonText: { color: colors.textOnAccent, fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1 },
  secondaryButton: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.18)',
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: colors.textSubtle, fontSize: 11, fontWeight: fontWeight.semibold, letterSpacing: 1 },
  trailerButton: {
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.18)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
  },
  heartButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartButtonActive: { borderColor: 'rgba(224,85,77,.6)', backgroundColor: 'rgba(224,85,77,.1)' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  ratingLabel: { color: colors.textMuted, fontSize: 9.5, fontWeight: fontWeight.medium, letterSpacing: 1.5 },
  removeButton: { marginHorizontal: spacing.lg, marginTop: spacing.md, alignItems: 'center' },
  removeButtonText: { color: colors.danger, fontSize: 10, fontWeight: fontWeight.semibold, letterSpacing: 1, opacity: 0.8 },
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
    textTransform: 'uppercase',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  castList: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  castItem: { width: 80 },
  castPhoto: { width: 80, height: 80, borderRadius: 40, marginBottom: spacing.xs },
  castPhotoPlaceholder: { backgroundColor: colors.backgroundElevated },
  castName: { color: colors.textPrimary, fontSize: 12, fontWeight: fontWeight.semibold },
  castCharacter: { color: colors.textMuted, fontSize: 11 },
  providersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  providerLogo: { width: 40, height: 40 },
  providerLogoImage: { width: 40, height: 40, borderRadius: radius.sm },
  providerLogoPlaceholder: { backgroundColor: colors.backgroundElevated },
  friendsWatchedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  friendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.2)',
    borderRadius: radius.full,
    paddingLeft: 4,
    paddingRight: spacing.sm + 2,
    paddingVertical: 4,
  },
  friendChipAvatar: { width: 26, height: 26, borderRadius: 13 },
  friendChipAvatarFallback: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  friendChipAvatarInitial: { color: colors.textOnAccent, fontSize: 10, fontWeight: fontWeight.bold },
  friendChipName: { color: colors.textPrimary, fontSize: 11.5, fontWeight: fontWeight.semibold, maxWidth: 90 },
  friendChipRating: { color: colors.accentBright, fontSize: 10.5, fontWeight: fontWeight.bold },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.8)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  modalTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: fontWeight.bold },
  modalSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: spacing.md },
  modalStars: { marginBottom: spacing.md },
  modalActions: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  modalCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  modalCancelText: { color: colors.textPrimary, fontSize: 12, fontWeight: fontWeight.bold, letterSpacing: 1 },
  modalConfirm: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  modalConfirmText: { color: colors.textOnAccent, fontSize: 12, fontWeight: fontWeight.bold, letterSpacing: 1 },
});
