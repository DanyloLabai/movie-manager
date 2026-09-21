import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import StarRating from './StarRating';
import { colors, spacing, radius, fontWeight } from '../theme';

interface AddMovieModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  onAddToWatchlist: () => void;
  onMarkWatched: (rating: number | null) => void;
  initialStep?: 'choose' | 'rating';
}

// Mirrors movie-frontend's AddMovieModal.tsx: step 1 asks "watchlist or
// already watched?", step 2 (only for "watched") collects an optional rating.
// Reused by Search, AI chat and Because You Watched.
export default function AddMovieModal({
  visible,
  title,
  onClose,
  onAddToWatchlist,
  onMarkWatched,
  initialStep = 'choose',
}: AddMovieModalProps) {
  const { t } = useTranslation('movie');
  const [step, setStep] = useState<'choose' | 'rating'>(initialStep);
  const [rating, setRating] = useState(0);

  useEffect(() => {
    if (visible) {
      setStep(initialStep);
      setRating(0);
    }
  }, [visible, initialStep]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          {step === 'choose' ? (
            <>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.subtitle}>{t('addModal.choiceDesc')}</Text>
              <Pressable style={styles.primary} onPress={onAddToWatchlist}>
                <Text style={styles.primaryText}>+ {t('addModal.toWatchlist').toUpperCase()}</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={() => setStep('rating')}>
                <Text style={styles.secondaryText}>✓ {t('addModal.watched').toUpperCase()}</Text>
              </Pressable>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={styles.cancel}>{t('common:cancel').toUpperCase()}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>{t('ratingModal.title')}</Text>
              <Text style={styles.subtitle}>{t('ratingModal.subtitle', { title })}</Text>
              <View style={styles.stars}>
                <StarRating size="lg" value={rating} onRate={setRating} />
              </View>
              <View style={styles.actions}>
                <Pressable style={[styles.secondary, styles.flex]} onPress={onClose}>
                  <Text style={styles.secondaryText}>{t('common:cancel').toUpperCase()}</Text>
                </Pressable>
                <Pressable
                  style={[styles.primary, styles.flex]}
                  onPress={() => onMarkWatched(rating > 0 ? rating : null)}
                >
                  <Text style={styles.primaryText}>{t('common:ok').toUpperCase()}</Text>
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: fontWeight.bold, maxWidth: '100%' },
  subtitle: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginBottom: spacing.sm },
  stars: { marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  flex: { flex: 1 },
  primary: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  primaryText: { color: colors.textOnAccent, fontSize: 12, fontWeight: fontWeight.bold, letterSpacing: 1 },
  secondary: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  secondaryText: { color: colors.textPrimary, fontSize: 12, fontWeight: fontWeight.bold, letterSpacing: 1 },
  cancel: {
    color: colors.textMuted,
    fontSize: 10.5,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.5,
    marginTop: spacing.xs,
  },
});
