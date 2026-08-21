import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { WatchlistItem } from '@movie-manager/shared';
import { getWatched } from '../../api/movies.api';
import { colors, spacing, radius, fontWeight } from '../../theme';

const PAGE_SIZE = 20;

interface RatingMoviesModalProps {
  rating: number | null;
  onClose: () => void;
  onPressMovie: (item: WatchlistItem) => void;
}

// Mirrors movie-frontend's RatingMoviesModal.tsx: tapping a rating bar in
// ProfileRatingBars opens this list of watched movies at that exact rating,
// paginated via a Load More footer button (same limit/offset pattern as
// ProfileScreen's own watchlist/watched grid).
export default function RatingMoviesModal({ rating, onClose, onPressMovie }: RatingMoviesModalProps) {
  const { t } = useTranslation('profile');
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (rating == null) return;
    let cancelled = false;
    setIsLoading(true);
    getWatched(PAGE_SIZE, 0, rating)
      .then((res) => {
        if (cancelled) return;
        setItems(res);
        setHasMore(res.length === PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [rating]);

  const loadMore = async () => {
    if (rating == null || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const res = await getWatched(PAGE_SIZE, items.length, rating);
      setItems((prev) => [...prev, ...res]);
      setHasMore(res.length === PAGE_SIZE);
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <Modal visible={rating != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>★ {rating}/10</Text>
              <Text style={styles.count}>{t('ratingModal.moviesCount', { count: items.length }).toUpperCase()}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator color={colors.accent} style={styles.spinner} />
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={<Text style={styles.emptyText}>{t('empty')}</Text>}
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => onPressMovie(item)}>
                  {item.posterUrl ? (
                    <Image source={{ uri: item.posterUrl }} style={styles.poster} />
                  ) : (
                    <View style={[styles.poster, styles.posterPlaceholder]} />
                  )}
                  <Text style={styles.movieTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </Pressable>
              )}
              ListFooterComponent={
                hasMore ? (
                  <Pressable style={styles.loadMoreButton} onPress={() => void loadMore()} disabled={isLoadingMore}>
                    <Text style={styles.loadMoreText}>{isLoadingMore ? '…' : t('ratingModal.loadMore').toUpperCase()}</Text>
                  </Pressable>
                ) : null
              }
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '75%',
    backgroundColor: colors.backgroundDeep,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.3)',
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  title: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.5,
  },
  count: {
    color: colors.accentBright,
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  spinner: { marginVertical: spacing.lg },
  list: { flexGrow: 0 },
  listContent: { gap: spacing.xs + 2 },
  emptyText: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,.03)',
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.1)',
  },
  poster: { width: 32, height: 44, borderRadius: radius.sm },
  posterPlaceholder: { backgroundColor: colors.backgroundElevated },
  movieTitle: { flex: 1, color: colors.textPrimary, fontSize: 12.5, fontWeight: fontWeight.bold },
  loadMoreButton: {
    marginTop: spacing.sm + 2,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.3)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  loadMoreText: { color: colors.accentBright, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 },
});
