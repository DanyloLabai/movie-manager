import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MovieResult } from '@movie-manager/shared';
import { watchTogether } from '../../api/ai.api';
import { addToWatchlist } from '../../api/movies.api';
import type { TasteCompatibility } from '../../api/users.api';
import { colors, spacing, radius, fontWeight } from '../../theme';

interface TasteMatchModalProps {
  visible: boolean;
  friendId: number;
  compat: TasteCompatibility;
  onClose: () => void;
  onOpenMovie: (movie: MovieResult) => void;
}

// Ported from movie-frontend's PublicProfile.tsx compat modal: the taste-match
// percentage, movies you both watched, and AI "watch together" picks (3 tries
// per day — the backend answers 429 once they're used up).
export default function TasteMatchModal({
  visible,
  friendId,
  compat,
  onClose,
  onOpenMovie,
}: TasteMatchModalProps) {
  const { t } = useTranslation('profile');
  const [result, setResult] = useState<{ message?: string; movies?: MovieResult[] } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const scorePercent =
    compat.score !== null ? `${Math.round(Math.max(0, Math.min(1, compat.score)) * 100)}%` : '—';

  const handleGenerate = async () => {
    setIsGenerating(true);
    setNotice(null);
    try {
      setResult(await watchTogether(friendId));
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 429) setDailyLimitReached(true);
      else setNotice(t('compat.error'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAdd = async (movie: MovieResult) => {
    try {
      await addToWatchlist({
        tmdbId: movie.id,
        title: movie.title,
        posterUrl: movie.posterUrl,
        mediaType: movie.mediaType,
        releaseDate: movie.releaseDate,
      });
      setAddedIds((prev) => [...prev, movie.id]);
      setNotice(t('compat.added'));
    } catch (err) {
      // 400 = already on the list — treat as added.
      if ((err as { response?: { status?: number } }).response?.status === 400) {
        setAddedIds((prev) => [...prev, movie.id]);
      } else {
        setNotice(t('compat.addError'));
      }
    }
  };

  const generateLabel = isGenerating
    ? t('compat.generating')
    : result
      ? t('compat.regenerate')
      : t('compat.generate');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{t('compat.title').toUpperCase()}</Text>
            <Text style={styles.score}>{scorePercent}</Text>

            <View style={styles.commonBox}>
              <Text style={styles.commonLabel}>
                {t('compat.commonWatched', { count: compat.commonWatchedCount }).toUpperCase()}
              </Text>
              {compat.commonWatched.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterRow}>
                  {compat.commonWatched.map((m) => (
                    <View key={m.tmdbId} style={styles.commonPoster}>
                      {m.posterUrl ? (
                        <Image source={{ uri: m.posterUrl }} style={styles.commonPosterImage} />
                      ) : (
                        <View style={[styles.commonPosterImage, styles.posterPlaceholder]} />
                      )}
                    </View>
                  ))}
                </ScrollView>
              ) : null}
            </View>

            {result ? (
              <View style={styles.results}>
                {result.message ? <Text style={styles.message}>{result.message}</Text> : null}
                {(result.movies ?? []).map((movie) => (
                  <View key={movie.id} style={styles.movieRow}>
                    <Pressable style={styles.movieInfo} onPress={() => onOpenMovie(movie)}>
                      {movie.posterUrl ? (
                        <Image source={{ uri: movie.posterUrl }} style={styles.moviePoster} />
                      ) : (
                        <View style={[styles.moviePoster, styles.posterPlaceholder]} />
                      )}
                      <Text style={styles.movieTitle} numberOfLines={2}>
                        {movie.title}
                      </Text>
                    </Pressable>
                    {addedIds.includes(movie.id) ? (
                      <Text style={styles.addedMark}>✓</Text>
                    ) : (
                      <Pressable style={styles.addButton} onPress={() => void handleAdd(movie)}>
                        <Text style={styles.addButtonText}>+</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            ) : null}

            {dailyLimitReached ? (
              <Text style={styles.limit}>{t('compat.dailyLimit')}</Text>
            ) : (
              <>
                <Pressable
                  style={[styles.generate, result && styles.generateSecondary, isGenerating && styles.disabled]}
                  onPress={() => void handleGenerate()}
                  disabled={isGenerating}
                >
                  <Text style={[styles.generateText, result && styles.generateTextSecondary]}>
                    {generateLabel.toUpperCase()}
                  </Text>
                </Pressable>
                {!result ? <Text style={styles.hint}>{t('compat.triesHint').toUpperCase()}</Text> : null}
              </>
            )}

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          </ScrollView>
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
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: fontWeight.bold,
    letterSpacing: 2,
    textAlign: 'center',
  },
  score: {
    color: colors.accentBright,
    fontSize: 36,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  commonBox: {
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.2)',
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  commonLabel: { color: colors.textMuted, fontSize: 9, fontWeight: fontWeight.semibold, letterSpacing: 1.5 },
  posterRow: { gap: spacing.sm },
  commonPoster: { width: 48 },
  commonPosterImage: { width: 48, aspectRatio: 2 / 3, borderRadius: radius.sm },
  posterPlaceholder: { backgroundColor: colors.backgroundDeep },
  results: { gap: spacing.sm },
  message: { color: colors.textPrimary, fontSize: 13, lineHeight: 19, marginBottom: spacing.xs },
  movieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.2)',
    borderRadius: radius.md,
  },
  movieInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, minWidth: 0 },
  moviePoster: { width: 36, height: 48, borderRadius: radius.sm },
  movieTitle: { flex: 1, color: colors.textPrimary, fontSize: 12, fontWeight: fontWeight.semibold },
  addedMark: { color: colors.accentBright, fontSize: 12, fontWeight: fontWeight.bold, paddingHorizontal: spacing.sm },
  addButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: colors.accentBright, fontSize: 15, lineHeight: 17, fontWeight: fontWeight.bold },
  generate: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  generateSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(217,172,84,.4)' },
  disabled: { opacity: 0.5 },
  generateText: { color: colors.textOnAccent, fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1.5 },
  generateTextSecondary: { color: colors.accentBright },
  hint: { color: colors.textMuted, fontSize: 9, letterSpacing: 1.5, textAlign: 'center', marginTop: spacing.sm },
  limit: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 16,
  },
  notice: { color: colors.textSubtle, fontSize: 11, textAlign: 'center', marginTop: spacing.sm },
});
