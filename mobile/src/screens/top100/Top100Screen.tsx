import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MovieResult, ProfileData } from '@movie-manager/shared';
import { addToWatchlist, getProfile, getTop100, removeFromWatchlist, toggleFavorite } from '../../api/movies.api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { useToast } from '../../hooks/useToast';
import MoviePosterCard from '../../components/MoviePosterCard';
import Toast from '../../components/Toast';
import { colors, spacing } from '../../theme';
import type { MainStackParamList } from '../../navigation/MainStack';

type Props = NativeStackScreenProps<MainStackParamList, 'Top100'>;

// getProfileData() returns more than the shared ProfileData type declares —
// see the same cast in SearchScreen.tsx/AiChatScreen.tsx.
interface ProfileResponse {
  favorites?: { tmdbId: number }[];
  watchedIds?: number[];
  inPlansIds?: number[];
}

function AddFooter({
  added,
  onAdd,
  onRemove,
}: {
  added: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('social');
  if (added) {
    return (
      <Pressable style={styles.footerLink} onPress={onRemove}>
        <Text style={styles.footerLinkText}>✓ {t('top100.added').toUpperCase()}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable style={styles.footerLink} onPress={onAdd}>
      <Text style={styles.footerLinkText}>+ {t('top100.addLabel').toUpperCase()}</Text>
    </Pressable>
  );
}

export default function Top100Screen({ route, navigation }: Props) {
  const { t } = useTranslation('social');
  const [type, setType] = useState(route.params.type);
  const [items, setItems] = useState<MovieResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const { toastMessage, showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getTop100(type)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, t('top100.loadError')));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  useEffect(() => {
    getProfile()
      .then((profile) => {
        const p = profile as ProfileData & ProfileResponse;
        const favs = p.favorites?.map((fav) => fav.tmdbId) ?? [];
        const watched = p.watchedIds ?? [];
        const inPlans = p.inPlansIds ?? [];
        setFavoriteIds(new Set(favs));
        setAddedIds(new Set([...favs, ...watched, ...inPlans]));
      })
      .catch(() => {});
  }, []);

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
      showToast(t('top100.addedToWatchlist'));
    } catch (err) {
      const apiError = err as { response?: { status?: number } };
      if (apiError.response?.status !== 400) {
        setAddedIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        showToast(getErrorMessage(err, t('top100.addError')));
      }
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
      showToast(t('top100.removedFromWatchlist'));
    } catch (err) {
      setAddedIds((prev) => new Set(prev).add(item.id));
      showToast(getErrorMessage(err, t('top100.removeError')));
    }
  };

  const handleToggleFavorite = async (item: MovieResult) => {
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
          showToast(t('top100.favoriteError'));
        }
      } else {
        showToast(t('top100.favoriteError'));
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {(['movie', 'tv'] as const).map((mediaType) => (
          <Pressable
            key={mediaType}
            style={[styles.filterPill, type === mediaType && styles.filterPillActive]}
            onPress={() => setType(mediaType)}
          >
            <Text style={[styles.filterText, type === mediaType && styles.filterTextActive]}>
              {mediaType === 'movie' ? t('top100.movies') : t('top100.tvShows')}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          key="top100-grid"
          numColumns={2}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.column}
          renderItem={({ item, index }) => (
            <MoviePosterCard
              posterUrl={item.posterUrl}
              title={item.title}
              subtitle={`#${index + 1} · ★ ${item.rating.toFixed(1)}`}
              isFavorite={favoriteIds.has(item.id)}
              onToggleFavorite={() => void handleToggleFavorite(item)}
              onPress={() =>
                navigation.navigate('MovieDetail', {
                  movieId: item.id,
                  title: item.title,
                  mediaType: item.mediaType,
                })
              }
              footer={
                <AddFooter
                  added={addedIds.has(item.id)}
                  onAdd={() => void handleAdd(item)}
                  onRemove={() => void handleRemove(item)}
                />
              }
            />
          )}
        />
      )}

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
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  filterTextActive: {
    color: colors.textOnAccent,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  grid: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  column: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  footerLink: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(217,172,84,.16)',
    alignItems: 'center',
  },
  footerLinkText: {
    color: colors.accentBright,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
