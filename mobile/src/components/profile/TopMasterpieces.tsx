import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WatchlistItem } from '@movie-manager/shared';
import { colors, spacing, fontWeight } from '../../theme';

interface TopMasterpiecesProps {
  topRated: WatchlistItem[];
  onPressMovie: (item: WatchlistItem) => void;
}

// Ported from movie-frontend's ProfileChartsPanel.tsx TopMasterpieces.
export default function TopMasterpieces({ topRated, onPressMovie }: TopMasterpiecesProps) {
  const { t } = useTranslation('profile');
  if (topRated.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('masterpieces.title').toUpperCase()}</Text>
      {topRated.map((item, index) => (
        <Pressable key={item.id} style={styles.row} onPress={() => onPressMovie(item)}>
          <Text style={styles.rank}>#{index + 1}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.rating}>★ {item.rating}/10</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  sectionTitle: {
    color: colors.accentBright,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rank: { color: colors.accentBright, fontSize: 11, fontWeight: fontWeight.bold },
  title: { flex: 1, minWidth: 0, color: colors.textPrimary, fontSize: 13, fontWeight: fontWeight.semibold },
  rating: { color: colors.accentBright, fontSize: 11, fontWeight: fontWeight.semibold },
});
