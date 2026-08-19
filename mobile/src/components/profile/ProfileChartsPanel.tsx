import { StyleSheet, Text, View } from 'react-native';
import type { WatchlistItem } from '@movie-manager/shared';
import GenreDonut from './GenreDonut';
import ProfileRatingBars from './ProfileRatingBars';
import TopMasterpieces from './TopMasterpieces';
import { colors, spacing, fontWeight } from '../../theme';

interface ProfileChartsPanelProps {
  genreDistribution: { name: string; value: number }[];
  ratingDistribution: { name: string; value: number }[];
  averageRating: string | number;
  topRated: WatchlistItem[];
  onPressMovie: (item: WatchlistItem) => void;
}

// Ported from movie-frontend's ProfileChartsPanel.tsx (mobile stacked
// variant): genre donut, rating histogram, top-3 masterpieces.
export default function ProfileChartsPanel({
  genreDistribution,
  ratingDistribution,
  averageRating,
  topRated,
  onPressMovie,
}: ProfileChartsPanelProps) {
  return (
    <View style={styles.container}>
      <View style={styles.block}>
        <Text style={styles.sectionTitle}>GENRES</Text>
        <GenreDonut genreDistribution={genreDistribution} size={104} />
      </View>

      <View style={styles.block}>
        <View style={styles.ratingHeader}>
          <Text style={styles.sectionTitle}>RATING</Text>
          <Text style={styles.avgText}>AVG {averageRating}</Text>
        </View>
        <ProfileRatingBars data={ratingDistribution} maxHeightPx={80} />
      </View>

      <TopMasterpieces topRated={topRated} onPressMovie={onPressMovie} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  block: { gap: spacing.sm + 2 },
  sectionTitle: {
    color: colors.accentBright,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  ratingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  avgText: { color: colors.accentBright, fontSize: 11, fontWeight: fontWeight.semibold },
});
