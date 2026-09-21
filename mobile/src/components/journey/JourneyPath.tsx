import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { LOTR_STOPS } from '../../data/journeyLotr';
import { getCurrentStopIndex } from '../../utils/journey';
import { colors, spacing, fontWeight } from '../../theme';
import JourneyMapGlimpse from './JourneyMapGlimpse';
import JourneyMapModal from './JourneyMapModal';

interface JourneyPathProps {
  totalCount: number;
  /** Set on a public profile so the section reads as that person's progress. */
  ownerName?: string;
}

// Ported from movie-frontend's JourneyPath.tsx: the "Your Journey" card —
// progress through Middle-earth (one stop per milestone of movies added), a
// zoomed glimpse of the map, and a full-screen map on tap.
export default function JourneyPath({ totalCount, ownerName }: JourneyPathProps) {
  const { t } = useTranslation('profile');
  const [isOpen, setIsOpen] = useState(false);

  const currentIndex = getCurrentStopIndex(totalCount, LOTR_STOPS);
  const revealed = Math.max(0, currentIndex + 1);
  const title = ownerName ? t('journey.someoneTitle', { name: ownerName }) : t('journey.sectionTitle');

  return (
    <LinearGradient colors={['#141210', '#100e0b']} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title.toUpperCase()}</Text>
        <Text style={styles.subtitle}>
          {t('journey.realmLotr')} · {revealed} / {LOTR_STOPS.length}
        </Text>
      </View>

      <Text style={styles.hint}>{t('journey.howItWorks')}</Text>

      <JourneyMapGlimpse totalCount={totalCount} onExpand={() => setIsOpen(true)} youLabel={ownerName} />

      <Text style={[styles.hint, styles.hintBottom]}>{t('journey.zoomHint')}</Text>

      <JourneyMapModal
        visible={isOpen}
        totalCount={totalCount}
        onClose={() => setIsOpen(false)}
        youLabel={ownerName}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.18)',
    padding: spacing.md + 4,
  },
  header: { marginBottom: spacing.sm + 2 },
  title: { color: colors.accentBright, fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 2.5 },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  hint: { color: '#6b6459', fontSize: 11, marginBottom: spacing.sm },
  hintBottom: { marginTop: spacing.sm, marginBottom: 0 },
});
