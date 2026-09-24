import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme';

interface MoviePosterCardProps {
  posterUrl: string | null;
  title: string;
  subtitle?: string;
  /** Shares the top-left corner with the heart toggle below — pass at most
   * one of `topLeftBadge`/`onToggleFavorite` per card, matching
   * movie-frontend's MovieCard.tsx (heart when released, clock icon
   * otherwise, never both). */
  topLeftBadge?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onPress: () => void;
  footer?: ReactNode;
  width?: number;
}

// Reused across Watchlist/Watched/Search/Top 100/Discover — poster + title +
// an optional badge/heart/footer slot, matching the grid item movie-frontend
// renders in Watchlist.tsx (poster, title, meta row, action row).
export default function MoviePosterCard({
  posterUrl,
  title,
  subtitle,
  topLeftBadge,
  isFavorite,
  onToggleFavorite,
  onPress,
  footer,
  width,
}: MoviePosterCardProps) {
  return (
    <View style={width ? { width } : styles.flexItem}>
      <Pressable onPress={onPress} style={styles.posterWrap}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder]} />
        )}
        {topLeftBadge ? (
          <View style={styles.topLeftBadge}>
            <Text style={styles.topLeftBadgeText}>{topLeftBadge}</Text>
          </View>
        ) : null}
        {onToggleFavorite ? (
          <Pressable style={styles.heartButton} onPress={onToggleFavorite} hitSlop={6}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={14}
              color={isFavorite ? colors.danger : colors.textSubtle}
            />
          </Pressable>
        ) : null}
      </Pressable>

      <Pressable onPress={onPress}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </Pressable>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  flexItem: {
    flex: 1,
  },
  posterWrap: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.backgroundDeep,
    marginBottom: spacing.sm,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    backgroundColor: colors.backgroundElevated,
  },
  topLeftBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.overlayScrim,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  topLeftBadgeText: {
    color: colors.accentBright,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heartButton: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.overlayScrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 3,
  },
});
