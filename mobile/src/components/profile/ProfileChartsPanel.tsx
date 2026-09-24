import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WatchlistItem } from '@movie-manager/shared';
import GenreDonut from './GenreDonut';
import ProfileRatingBars from './ProfileRatingBars';
import TopMasterpieces from './TopMasterpieces';
import RatingMoviesModal from './RatingMoviesModal';
import { colors, spacing, fontWeight } from '../../theme';

interface ProfileChartsPanelProps {
  genreDistribution: { name: string; value: number }[];
  ratingDistribution: { name: string; value: number }[];
  averageRating: string | number;
  topRated: WatchlistItem[];
  onPressMovie: (item: WatchlistItem) => void;
  /** Gates the rating-bars → "movies at this rating" modal. Off by default
   * so viewing a friend's public profile can't be used to page through
   * *your own* watched list (GET /movies/watched is always scoped to the
   * signed-in user). Only the owner's own profile passes true. */
  interactiveRating?: boolean;
}

// Ported from movie-frontend's ProfileChartsPanel.tsx (mobile stacked
// variant): genre donut, rating histogram, top-3 masterpieces.
export default function ProfileChartsPanel({
  genreDistribution,
  ratingDistribution,
  averageRating,
  topRated,
  onPressMovie,
  interactiveRating = false,
}: ProfileChartsPanelProps) {
  const { t } = useTranslation('profile');
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  return (
    <View style={styles.container}>
      <View style={styles.block}>
        <Text style={styles.sectionTitle}>{t('charts.genres').toUpperCase()}</Text>
        <GenreDonut genreDistribution={genreDistribution} size={104} />
      </View>

      <View style={styles.block}>
        <View style={styles.ratingHeader}>
          <Text style={styles.sectionTitle}>{t('charts.rating').toUpperCase()}</Text>
          <Text style={styles.avgText}>{t('charts.avg').toUpperCase()} {averageRating}</Text>
        </View>
        <ProfileRatingBars
          data={ratingDistribution}
          maxHeightPx={80}
          onPressBar={interactiveRating ? setSelectedRating : undefined}
        />
      </View>

      <TopMasterpieces topRated={topRated} onPressMovie={onPressMovie} />

      {interactiveRating ? (
        <RatingMoviesModal
          rating={selectedRating}
          onClose={() => setSelectedRating(null)}
          onPressMovie={(item) => {
            setSelectedRating(null);
            onPressMovie(item);
          }}
        />
      ) : null}
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
