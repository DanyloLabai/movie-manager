import type { ReactNode } from 'react';
import { Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getUserRank } from '../../utils/achievements';
import { colors, spacing, radius, fontWeight } from '../../theme';

interface ProfileHeroProps {
  username: string;
  avatarUrl: string | null;
  watchedCount: number;
  memberSince?: string;
  friendsCount: number;
  onOpenFriends: () => void;
  /** Overrides the default Friends/Share pill row — used by the public
   * profile screen to show Friends/Add-Friend/Request-sent state instead. */
  rightSlot?: ReactNode;
}

// Ported from movie-frontend's ProfileHero.tsx (the non-compact/mobile
// variant — the profile tab never uses the compact layout). Web's CSS
// radial-gradients aren't available in RN's linear-only expo-linear-gradient,
// so the avatar badge/fallback backdrop use a diagonal approximation of the
// same gold-to-dark stops instead. Native blur (expo-blur) was left out to
// avoid a third new dependency — the avatar photo is shown dimmed under a
// dark gradient instead of blurred.
export default function ProfileHero({
  username,
  avatarUrl,
  watchedCount,
  memberSince,
  friendsCount,
  onOpenFriends,
  rightSlot,
}: ProfileHeroProps) {
  const { t } = useTranslation('profile');
  const rank = getUserRank(watchedCount);
  const memberSinceYear = memberSince ? new Date(memberSince).getFullYear() : null;

  const handleShare = () => {
    void Share.share({ message: username });
  };

  return (
    <View>
      <View style={styles.banner}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.bannerImage} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={['#3a2f1a', '#201c15', '#0f0d0a']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={['rgba(15,13,10,.28)', 'rgba(15,13,10,.68)', colors.backgroundDeep]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.bannerContent}>
          <View style={styles.avatarRing}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={['#e8c377', '#a87c2e']}
                start={{ x: 0.35, y: 0.3 }}
                end={{ x: 1, y: 1 }}
                style={[styles.avatar, styles.avatarFallback]}
              >
                <Text style={styles.avatarInitial}>{username.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
            )}
          </View>

          <View style={styles.identity}>
            <Text style={styles.username} numberOfLines={1}>
              {username}
            </Text>
            <Text style={styles.rank} numberOfLines={1}>
              {rank}
              {memberSinceYear ? ` · ${t('hero.sinceYear', { year: memberSinceYear }).toUpperCase()}` : ''}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actionsRow}>
        {rightSlot ?? (
          <>
            <Pressable style={[styles.pill, styles.friendsPill]} onPress={onOpenFriends}>
              <Ionicons name="people-outline" size={13} color={colors.accentBright} />
              <Text style={styles.friendsPillText}>{t('hero.friendsCount', { count: friendsCount }).toUpperCase()}</Text>
            </Pressable>
            <Pressable style={[styles.pill, styles.sharePill]} onPress={handleShare}>
              <Text style={styles.sharePillText}>{t('hero.share').toUpperCase()}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 200,
    overflow: 'hidden',
  },
  bannerImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.55,
  },
  bannerContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm + 2,
  },
  avatarRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.backgroundDeep,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.5)',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 33,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.textOnAccent,
    fontSize: 28,
    fontWeight: fontWeight.bold,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  username: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: fontWeight.bold,
  },
  rank: {
    color: colors.accentBright,
    fontSize: 10.5,
    fontWeight: fontWeight.semibold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm + 2,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
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
  sharePill: {
    borderColor: 'rgba(255,255,255,.18)',
  },
  sharePillText: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.5,
  },
});
