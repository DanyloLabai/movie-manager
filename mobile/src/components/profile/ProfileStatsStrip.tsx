import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { colors, spacing, fontWeight } from '../../theme';

export interface ProfileStatTile {
  value: string | number;
  label: string;
}

interface ProfileStatsStripProps {
  stats: ProfileStatTile[];
  watchedCount: number;
  completionRate: number;
  totalCount: number;
}

// Ported from movie-frontend's ProfileStatsStrip.tsx (mobile/`md:hidden`
// variant): a 3-up stat grid with dividers, then a completion-rate bar.
export default function ProfileStatsStrip({
  stats,
  watchedCount,
  completionRate,
  totalCount,
}: ProfileStatsStripProps) {
  const { t } = useTranslation('profile');
  const clampedRate = Math.max(0, Math.min(100, completionRate));

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {stats.map((s, i) => (
          <View
            key={s.label}
            style={[
              styles.statItem,
              i > 0 && i < stats.length - 1 && styles.statItemBordered,
            ]}
          >
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.completion}>
        <View style={styles.completionHeader}>
          <Text style={styles.completionLabel}>{t('stats.completion').toUpperCase()}</Text>
          <Text style={styles.completionValue}>
            {completionRate}% · {watchedCount}/{totalCount}
          </Text>
        </View>
        <View style={styles.completionTrack}>
          <LinearGradient
            colors={['#a87c2e', '#d9ac54']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.completionFill, { width: `${clampedRate}%` }]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statItemBordered: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.borderSubtle,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: fontWeight.bold,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: fontWeight.medium,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  completion: {
    marginTop: spacing.md,
    gap: spacing.xs + 2,
  },
  completionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  completionLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeight.medium,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  completionValue: {
    color: colors.accentBright,
    fontSize: 15,
    fontWeight: fontWeight.bold,
  },
  completionTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,.08)',
    overflow: 'hidden',
  },
  completionFill: {
    height: '100%',
    borderRadius: 2,
  },
});
