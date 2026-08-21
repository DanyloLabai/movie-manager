import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ProfileData } from '@movie-manager/shared';
import { colors, spacing, fontWeight } from '../../theme';

interface ProfileWrappedPanelProps {
  username: string;
  stats: NonNullable<ProfileData['stats']>;
}

// Ported from movie-frontend's ProfileWrappedPanel.tsx (mobile grid variant).
export default function ProfileWrappedPanel({ username, stats }: ProfileWrappedPanelProps) {
  const { t } = useTranslation('profile');
  const hours = Math.floor((stats.totalMinutes ?? 0) / 60);
  const minutes = (stats.totalMinutes ?? 0) % 60;
  const hasMarathon = (stats.longestMovie?.runtime ?? 0) > 0;

  return (
    <View>
      <Text style={styles.sectionTitle}>{t('wrapped.title', { username: username.toUpperCase() })}</Text>

      <View style={styles.grid}>
        <View style={styles.tile}>
          <Text style={styles.tileValue}>
            {hours}h {minutes}m
          </Text>
          <Text style={styles.tileLabel}>{t('wrapped.timeSpent').toUpperCase()}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileValue} numberOfLines={1}>
            {stats.topGenre || t('notAvailable')}
          </Text>
          <Text style={styles.tileLabel}>{t('wrapped.topGenre').toUpperCase()}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileValue}>{stats.favoriteDecade || t('notAvailable')}</Text>
          <Text style={styles.tileLabel}>{t('wrapped.favDecade').toUpperCase()}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileValue}>
            {stats.moviesCount ?? 0}{' '}
            <Text style={styles.tileValueSecondary}>/ {stats.tvCount ?? 0}</Text>
          </Text>
          <Text style={styles.tileLabel}>{t('wrapped.moviesTv').toUpperCase()}</Text>
        </View>
      </View>

      {hasMarathon || stats.topActor ? (
        <View style={styles.detailRows}>
          {hasMarathon ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('wrapped.longestMarathon').toUpperCase()}</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {stats.longestMovie?.title} ·{' '}
                <Text style={styles.detailAccent}>
                  {t('wrapped.runtimeMinutes', { count: stats.longestMovie?.runtime })}
                </Text>
              </Text>
            </View>
          ) : null}
          {stats.topActor ? (
            <View style={styles.detailRow}>
              <View style={styles.actorRow}>
                {stats.topActor.profileUrl ? (
                  <Image source={{ uri: stats.topActor.profileUrl }} style={styles.actorPhoto} />
                ) : (
                  <View style={[styles.actorPhoto, styles.actorPhotoPlaceholder]} />
                )}
                <View style={styles.detailTextGroup}>
                  <Text style={styles.detailLabel}>{t('wrapped.mostWatchedActor').toUpperCase()}</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>
                    {stats.topActor.name}{' '}
                    <Text style={styles.detailMuted}>
                      · {t('wrapped.inMoviesCount', { count: stats.topActor.count })}
                    </Text>
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
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
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: { width: '45%', gap: 4 },
  tileValue: { color: colors.textPrimary, fontSize: 22, fontWeight: fontWeight.bold },
  tileValueSecondary: { fontSize: 13, fontWeight: fontWeight.medium, color: colors.textMuted },
  tileLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: fontWeight.medium,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  detailRows: { marginTop: spacing.md, gap: spacing.sm + 2 },
  detailRow: { gap: 2 },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: fontWeight.medium,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  detailValue: { color: colors.textPrimary, fontSize: 13, fontWeight: fontWeight.semibold },
  detailAccent: { color: colors.accentBright },
  detailMuted: { color: colors.textMuted, fontWeight: fontWeight.medium },
  actorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actorPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.3)',
  },
  actorPhotoPlaceholder: { backgroundColor: colors.backgroundElevated },
  detailTextGroup: { gap: 2 },
});
