import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getPublicProfile, addFriend, type PublicProfile } from '../../api/users.api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import MoviePosterCard from '../../components/MoviePosterCard';
import { colors, spacing, radius } from '../../theme';
import type { MainStackParamList } from '../../navigation/MainStack';

type Props = NativeStackScreenProps<MainStackParamList, 'PublicProfile'>;

export default function PublicProfileScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingFriend, setIsAddingFriend] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPublicProfile(userId)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        navigation.setOptions({ title: data.username ?? '' });
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load this profile.'));
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
      setError(getErrorMessage(err, 'Could not send friend request.'));
    } finally {
      setIsAddingFriend(false);
    }
  };

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
        <Text style={styles.error}>{error ?? 'Not found.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {profile.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {(profile.username ?? '?')[0]?.toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.username}>{profile.username}</Text>
        {profile.memberSince ? (
          <Text style={styles.meta}>Member since {profile.memberSince}</Text>
        ) : null}

        {profile.isFriend ? (
          <View style={styles.friendPill}>
            <Text style={styles.friendPillText}>✓ Friends</Text>
          </View>
        ) : profile.requestPending ? (
          <View style={styles.friendPillMuted}>
            <Text style={styles.friendPillMutedText}>Request sent</Text>
          </View>
        ) : (
          <Pressable
            style={styles.addButton}
            onPress={() => void handleAddFriend()}
            disabled={isAddingFriend}
          >
            <Text style={styles.addButtonText}>
              {isAddingFriend ? '…' : 'ADD FRIEND'}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.watchedCount ?? 0}</Text>
          <Text style={styles.statLabel}>Watched</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.stats?.averageRating ?? '0.0'}</Text>
          <Text style={styles.statLabel}>Avg rating</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.favorites.length}</Text>
          <Text style={styles.statLabel}>Favorites</Text>
        </View>
      </View>

      {profile.favorites.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Favorites</Text>
          <View style={styles.grid}>
            {profile.favorites.map((item) => (
              <MoviePosterCard
                key={item.id}
                width={96}
                posterUrl={item.posterUrl ?? null}
                title={item.title}
                onPress={() =>
                  navigation.push('MovieDetail', {
                    movieId: item.tmdbId,
                    title: item.title,
                    mediaType: item.mediaType === 'tv' ? 'tv' : 'movie',
                  })
                }
              />
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
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
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: spacing.md,
  },
  avatarPlaceholder: {
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.textOnAccent,
    fontSize: 32,
    fontWeight: '700',
  },
  username: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  friendPill: {
    marginTop: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  friendPillText: {
    color: colors.accentBright,
    fontSize: 12,
    fontWeight: '700',
  },
  friendPillMuted: {
    marginTop: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  friendPillMutedText: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '700',
  },
  addButton: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 4,
  },
  addButtonText: {
    color: colors.textOnAccent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  sectionTitle: {
    color: colors.accentBright,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
