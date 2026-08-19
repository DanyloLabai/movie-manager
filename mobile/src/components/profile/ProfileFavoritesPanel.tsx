import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { WatchlistItem } from '@movie-manager/shared';
import type { Achievement } from '../../utils/achievements';
import type { Friend } from '../../api/users.api';
import { colors, spacing, radius, fontWeight } from '../../theme';

interface ProfileFavoritesPanelProps {
  favorites: WatchlistItem[];
  achievements: Achievement[];
  friends: Friend[];
  friendsCount: number;
  onToggleFavorite: (tmdbId: number) => void;
  onOpenFriends: () => void;
  onPressMovie: (item: WatchlistItem) => void;
}

const POSTER_WIDTH = 108;

// Ported from movie-frontend's ProfileFavoritesPanel.tsx (mobile variant):
// a horizontal top-3 favorites strip, a vertical achievements list with
// requirement text (movie-frontend shows this; the old mobile screen only
// showed a bare fraction), and an overlapping friends-avatar row.
export default function ProfileFavoritesPanel({
  favorites,
  achievements,
  friends,
  friendsCount,
  onToggleFavorite,
  onOpenFriends,
  onPressMovie,
}: ProfileFavoritesPanelProps) {
  const topFavorites = favorites.slice(0, 3);
  const visibleFriends = friends.slice(0, 5);
  const remainingFriends = Math.max(0, friendsCount - visibleFriends.length);

  return (
    <View>
      <Text style={styles.sectionTitle}>TOP FAVORITES</Text>
      {topFavorites.length === 0 ? (
        <Text style={styles.emptyText}>No favorites yet.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.favoritesScroll}>
          <View style={styles.favoritesRow}>
            {topFavorites.map((fav) => {
              const year = fav.releaseDate ? fav.releaseDate.slice(0, 4) : null;
              return (
                <Pressable
                  key={fav.id}
                  style={styles.favoriteCard}
                  onPress={() => onPressMovie(fav)}
                >
                  <View style={styles.favoritePosterWrap}>
                    {fav.posterUrl ? (
                      <Image source={{ uri: fav.posterUrl }} style={styles.favoritePoster} />
                    ) : (
                      <View style={[styles.favoritePoster, styles.favoritePosterPlaceholder]} />
                    )}
                    <Pressable
                      style={styles.heartBadge}
                      onPress={() => onToggleFavorite(fav.tmdbId)}
                      hitSlop={6}
                    >
                      <Ionicons
                        name={fav.isFavorite ? 'heart' : 'heart-outline'}
                        size={11}
                        color={fav.isFavorite ? colors.danger : 'rgba(242,234,217,.5)'}
                      />
                    </Pressable>
                  </View>
                  <Text style={styles.favoriteTitle} numberOfLines={1}>
                    {fav.title}
                  </Text>
                  {year ? <Text style={styles.favoriteYear}>{year}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      <Text style={[styles.sectionTitle, styles.achievementsTitle]}>ACHIEVEMENTS</Text>
      <View style={styles.achievementsList}>
        {achievements.map((a) => (
          <View key={a.id} style={[styles.achievementRow, !a.isUnlocked && styles.achievementRowLocked]}>
            <View style={styles.achievementIcon}>
              <Ionicons
                name={a.isUnlocked ? 'trophy-outline' : 'lock-closed-outline'}
                size={16}
                color={colors.accentBright}
              />
            </View>
            <View style={styles.achievementText}>
              <Text style={styles.achievementName} numberOfLines={1}>
                {a.text}
              </Text>
              <Text style={styles.achievementReq} numberOfLines={1}>
                {a.requirement}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.friendsRow}>
        <Text style={styles.friendsRowTitle}>
          FRIENDS · {friendsCount}
        </Text>
        <View style={styles.friendsStack}>
          {visibleFriends.map((fr) => (
            <View key={fr.id} style={styles.friendAvatarRing}>
              {fr.avatarUrl ? (
                <Image source={{ uri: fr.avatarUrl }} style={styles.friendAvatar} />
              ) : (
                <LinearGradient
                  colors={['#e8c377', '#a87c2e']}
                  start={{ x: 0.35, y: 0.3 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.friendAvatar, styles.friendAvatarFallback]}
                >
                  <Text style={styles.friendAvatarInitial}>
                    {fr.username.charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>
              )}
            </View>
          ))}
          {remainingFriends > 0 ? (
            <View style={[styles.friendAvatarRing, styles.friendsOverflow]}>
              <Text style={styles.friendsOverflowText}>+{remainingFriends}</Text>
            </View>
          ) : null}
          <Pressable onPress={onOpenFriends} style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View all</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.accentBright,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm + 2,
  },
  achievementsTitle: { marginTop: spacing.lg },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: spacing.md,
  },
  favoritesScroll: { marginHorizontal: -spacing.lg },
  favoritesRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  favoriteCard: { width: POSTER_WIDTH, gap: spacing.xs },
  favoritePosterWrap: {
    width: POSTER_WIDTH,
    height: POSTER_WIDTH * 1.48,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.backgroundElevated,
  },
  favoritePoster: { width: '100%', height: '100%' },
  favoritePosterPlaceholder: { backgroundColor: colors.backgroundElevated },
  heartBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.overlayScrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: fontWeight.semibold },
  favoriteYear: { color: colors.textMuted, fontSize: 10.5 },
  achievementsList: { gap: spacing.sm + 2 },
  achievementRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  achievementRowLocked: { opacity: 0.45 },
  achievementIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementText: { flex: 1, minWidth: 0, gap: 1 },
  achievementName: { color: colors.textPrimary, fontSize: 13, fontWeight: fontWeight.semibold },
  achievementReq: { color: colors.textMuted, fontSize: 11 },
  friendsRow: { marginTop: spacing.lg, gap: spacing.sm + 2 },
  friendsRowTitle: {
    color: colors.accentBright,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  friendsStack: { flexDirection: 'row', alignItems: 'center' },
  friendAvatarRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: -8,
    borderWidth: 2,
    borderColor: colors.backgroundDeep,
    overflow: 'hidden',
  },
  friendAvatar: { width: '100%', height: '100%' },
  friendAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  friendAvatarInitial: { color: colors.textOnAccent, fontSize: 12, fontWeight: fontWeight.bold },
  friendsOverflow: {
    backgroundColor: colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendsOverflowText: { color: colors.accentBright, fontSize: 10, fontWeight: fontWeight.semibold },
  viewAllButton: { marginLeft: spacing.md },
  viewAllText: {
    color: colors.accentBright,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    textDecorationLine: 'underline',
  },
});
