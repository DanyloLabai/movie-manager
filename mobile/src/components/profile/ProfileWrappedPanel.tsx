import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ProfileData } from '@movie-manager/shared';
import { colors, spacing, fontWeight } from '../../theme';

interface ProfileWrappedPanelProps {
  username: string;
  stats: NonNullable<ProfileData['stats']>;
}

// Ported from movie-frontend's ProfileWrappedPanel.tsx (mobile grid variant).
// Longest-marathon and most-watched-actor rows were dropped on web, so they're
// gone here too.
export default function ProfileWrappedPanel({ username, stats }: ProfileWrappedPanelProps) {
  const { t } = useTranslation('profile');
  const hours = Math.floor((stats.totalMinutes ?? 0) / 60);
  const minutes = (stats.totalMinutes ?? 0) % 60;

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
});
