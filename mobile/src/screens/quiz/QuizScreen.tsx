import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MovieResult } from '@movie-manager/shared';
import {
  buyHint,
  getFriendsLeaderboard,
  getPosterImageBase64,
  getTodayQuiz,
  submitGuess,
  type QuizLeaderboardEntry,
  type QuizState,
} from '../../api/quiz.api';
import { searchMovies, addToWatchlist } from '../../api/movies.api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { useToast } from '../../hooks/useToast';
import ScreenHeader from '../../components/ScreenHeader';
import Toast from '../../components/Toast';
import { colors, spacing, radius, fontWeight } from '../../theme';
import type { AppTabsParamList } from '../../navigation/AppTabs';
import type { MainStackParamList } from '../../navigation/MainStack';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabsParamList, 'Quiz'>,
  NativeStackScreenProps<MainStackParamList>
>;

const TOTAL_HINTS = 5;

function msUntilNextUtcMidnight(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return next - now.getTime();
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const RANK_COLORS = [colors.accentBright, '#e8c377', '#a87c2e'];

export default function QuizScreen({ navigation }: Props) {
  const { t } = useTranslation('quiz');
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [posterUri, setPosterUri] = useState<string | null>(null);
  const [guessQuery, setGuessQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MovieResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBuyingHint, setIsBuyingHint] = useState(false);
  const [leaderboard, setLeaderboard] = useState<QuizLeaderboardEntry[]>([]);
  const [watchlistAdded, setWatchlistAdded] = useState(false);
  const [countdownMs, setCountdownMs] = useState(() => msUntilNextUtcMidnight());
  const { toastMessage, showToast } = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDone = !!quiz && (quiz.isSolved || quiz.isFailed);

  const statusLabel = (entry: QuizLeaderboardEntry): string => {
    if (entry.todayStatus === 'solved') return t('quizScreen.statusSolved', { score: entry.todayScore });
    if (entry.todayStatus === 'failed') return t('quizScreen.statusFailed');
    if (entry.todayStatus === 'in_progress') return t('quizScreen.statusInProgress');
    return t('quizScreen.statusNotPlayed');
  };

  useEffect(() => {
    getTodayQuiz()
      .then(setQuiz)
      .catch((err) => showToast(getErrorMessage(err, t('quizScreen.loadError'))))
      .finally(() => setIsLoading(false));
    getFriendsLeaderboard().then(setLeaderboard).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isDone) return;
    const id = setInterval(() => setCountdownMs(msUntilNextUtcMidnight()), 1000);
    return () => clearInterval(id);
  }, [isDone]);

  useEffect(() => {
    if (!quiz || isDone) return;
    let cancelled = false;
    getPosterImageBase64()
      .then((uri) => {
        if (!cancelled) setPosterUri(uri);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz?.hintsRevealed, isDone]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = guessQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchMovies(trimmed, { skipHistory: true })
        .then((results) => setSuggestions(results.slice(0, 6)))
        .catch(() => {});
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [guessQuery]);

  const handleGuess = async (movie: MovieResult) => {
    if (!quiz || isSubmitting) return;
    setIsSubmitting(true);
    setGuessQuery('');
    setSuggestions([]);
    try {
      const result = await submitGuess({ title: movie.title, tmdbId: movie.id });
      setQuiz(result);
      showToast(result.correct ? t('quizScreen.correctToast') : t('quizScreen.incorrectToast'));
    } catch (err) {
      showToast(getErrorMessage(err, t('quizScreen.submitGuessError')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBuyHint = async () => {
    if (!quiz || isDone || isBuyingHint || quiz.nextHintCost === null) return;
    setIsBuyingHint(true);
    try {
      setQuiz(await buyHint());
    } catch (err) {
      showToast(getErrorMessage(err, t('quizScreen.buyHintError')));
    } finally {
      setIsBuyingHint(false);
    }
  };

  const handleAddWatchlist = async () => {
    if (!quiz?.answer || watchlistAdded) return;
    try {
      await addToWatchlist({
        tmdbId: quiz.answer.tmdbId,
        title: quiz.answer.title,
        posterUrl: quiz.answer.posterUrl,
        mediaType: 'movie',
      });
      setWatchlistAdded(true);
    } catch (err) {
      const apiError = err as { response?: { status?: number } };
      if (apiError.response?.status === 400) setWatchlistAdded(true);
      else showToast(getErrorMessage(err, t('quizScreen.addWatchlistError')));
    }
  };

  const handleShareResult = () => {
    if (!quiz) return;
    const title = quiz.answer?.title ?? '';
    const message = quiz.isSolved
      ? t('quizScreen.shareSolved', { title, used: quiz.guesses.length, total: quiz.maxGuesses, score: quiz.score })
      : title
        ? t('quizScreen.shareFailedWithTitle', { title })
        : t('quizScreen.shareFailedNoTitle');
    void Share.share({ message });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'left', 'right']}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (!quiz) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'left', 'right']}>
        <Text style={styles.emptyText}>{t('quizScreen.noQuizAvailable')}</Text>
      </SafeAreaView>
    );
  }

  const revealedHints = quiz.hints ?? [];
  const lockedHintCount = Math.max(TOTAL_HINTS - revealedHints.length, 0);
  const posterUrl = isDone ? quiz.posterUrl : posterUri;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('quizScreen.headerTitle').toUpperCase()} subtitle={t('quizScreen.headerSubtitle')} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{quiz.score}</Text>
            <Text style={styles.statLabel}>{t('quizScreen.points').toUpperCase()}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{quiz.streak.current}</Text>
            <Text style={styles.statLabel}>{t('quizScreen.dayStreak').toUpperCase()}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, styles.statValueAccent]}>{quiz.streak.best}</Text>
            <Text style={styles.statLabel}>{t('quizScreen.best').toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.posterWrap}>
          {posterUrl ? (
            <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
          ) : (
            <ActivityIndicator color={colors.accent} />
          )}

          {!isDone && quiz.nextHintCost !== null ? (
            <Pressable
              style={styles.hintOverlay}
              onPress={() => void handleBuyHint()}
              disabled={isBuyingHint}
            >
              <Text style={styles.hintOverlayText}>
                {isBuyingHint ? '…' : t('quizScreen.hintUnlockCost', { cost: quiz.nextHintCost })}
              </Text>
            </Pressable>
          ) : null}

          {isDone && quiz.answer ? (
            <LinearGradient
              colors={['transparent', 'rgba(15,13,10,.85)']}
              style={styles.posterCaption}
            >
              <Text style={styles.posterCaptionTitle} numberOfLines={1}>
                {quiz.answer.title}
              </Text>
              {quiz.answer.releaseYear ? (
                <Text style={styles.posterCaptionYear}>{quiz.answer.releaseYear}</Text>
              ) : null}
            </LinearGradient>
          ) : null}
        </View>

        <View style={styles.dotsRow}>
          {Array.from({ length: quiz.maxGuesses }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i < quiz.guesses.length && styles.dotFilled]}
            />
          ))}
          <Text style={styles.dotsLabel}>
            {isDone
              ? `${(quiz.isSolved ? t('quizScreen.correct') : t('quizScreen.failed')).toUpperCase()} · ${t('quizScreen.triesUsed', { used: quiz.guesses.length, total: quiz.maxGuesses }).toUpperCase()}`
              : t('quizScreen.guessesLeft', { count: quiz.guessesLeft }).toUpperCase()}
          </Text>
        </View>

        {!isDone ? (
          <View style={styles.guessSection}>
            <View style={styles.guessBarWrap}>
              <TextInput
                style={styles.guessInput}
                placeholder={t('quizScreen.guessInputPlaceholder')}
                placeholderTextColor={colors.textFaint}
                value={guessQuery}
                onChangeText={setGuessQuery}
                editable={!isSubmitting}
              />
              <Pressable
                style={styles.guessButton}
                disabled={isSubmitting || !suggestions[0]}
                onPress={() => suggestions[0] && void handleGuess(suggestions[0])}
              >
                <Text style={styles.guessButtonText}>{t('quizScreen.guessButton').toUpperCase()}</Text>
              </Pressable>
            </View>
            {suggestions.length > 0 ? (
              <View style={styles.suggestions}>
                {suggestions.map((s) => (
                  <Pressable key={s.id} style={styles.suggestionRow} onPress={() => void handleGuess(s)}>
                    <Text style={styles.suggestionText}>
                      {s.title} {s.releaseYear ? `(${s.releaseYear})` : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.doneCard}>
            <View style={styles.doneHeader}>
              <Ionicons
                name={quiz.isSolved ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={quiz.isSolved ? colors.accentBright : colors.danger}
              />
              <Text style={styles.doneHeaderText}>
                {(quiz.isSolved ? t('quizScreen.correct') : t('quizScreen.failed')).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.doneHeadline}>
              {quiz.isSolved ? (
                <>
                  {t('quizScreen.guessedHeadline')} <Text style={styles.doneHeadlineAccent}>+{quiz.score}</Text>
                </>
              ) : (
                t('quizScreen.notGuessedHeadline')
              )}
            </Text>
            {quiz.answer ? (
              <View style={styles.answerChip}>
                <Ionicons name="checkmark" size={13} color={colors.accentBright} />
                <Text style={styles.answerChipText}>{quiz.answer.title}</Text>
              </View>
            ) : null}

            <View style={styles.doneStatsRow}>
              <View style={styles.doneStatItem}>
                <Text style={styles.doneStatValue}>{quiz.score}</Text>
                <Text style={styles.doneStatLabel}>{t('quizScreen.finalScore').toUpperCase()}</Text>
              </View>
              <View style={styles.doneStatItem}>
                <Text style={styles.doneStatValue}>
                  {quiz.guesses.length}/{quiz.maxGuesses}
                </Text>
                <Text style={styles.doneStatLabel}>{t('quizScreen.attemptsUsed').toUpperCase()}</Text>
              </View>
              <View style={styles.doneStatItem}>
                <Text style={styles.doneStatValue}>
                  {quiz.hintsRevealed}/{TOTAL_HINTS}
                </Text>
                <Text style={styles.doneStatLabel}>{t('quizScreen.hintsUsed').toUpperCase()}</Text>
              </View>
            </View>

            {quiz.answer ? (
              <View style={styles.doneActionsRow}>
                <Pressable
                  style={styles.viewMovieButton}
                  onPress={() =>
                    navigation.navigate('MovieDetail', {
                      movieId: quiz.answer!.tmdbId,
                      title: quiz.answer!.title,
                      mediaType: 'movie',
                    })
                  }
                >
                  <Text style={styles.viewMovieButtonText}>{t('quizScreen.viewMovie').toUpperCase()}</Text>
                </Pressable>
                <Pressable
                  style={styles.watchlistButton}
                  onPress={() => void handleAddWatchlist()}
                  disabled={watchlistAdded}
                >
                  <Text style={styles.watchlistButtonText}>
                    {watchlistAdded ? `✓ ${t('quizScreen.added').toUpperCase()}` : `+ ${t('quizScreen.watchlist').toUpperCase()}`}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.countdownRow}>
              <Ionicons name="time-outline" size={13} color={colors.accentBright} />
              <Text style={styles.countdownLabel}>{t('quizScreen.newMovieIn')}</Text>
              <Text style={styles.countdownValue}>{formatCountdown(countdownMs)}</Text>
              <Pressable style={styles.shareButton} onPress={handleShareResult}>
                <Text style={styles.shareButtonText}>{t('quizScreen.shareResult').toUpperCase()}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.hintsSection}>
          <View style={styles.hintsHeader}>
            <Text style={styles.sectionTitle}>{t('quizScreen.hintsSectionTitle').toUpperCase()}</Text>
            <View style={styles.hintsHeaderLine} />
            <Text style={styles.hintsHeaderMeta}>
              {isDone
                ? t('quizScreen.hintsAllOpened')
                : t('quizScreen.hintsOpenedCount', { revealed: revealedHints.length, total: TOTAL_HINTS })}
            </Text>
          </View>
          {revealedHints.map((hint, i) => (
            <View key={i} style={styles.hintRow}>
              <Text style={styles.hintIndex}>#{i + 1}</Text>
              <Text style={styles.hintText}>{hint}</Text>
            </View>
          ))}
          {Array.from({ length: lockedHintCount }).map((_, i) => (
            <View key={`locked-${i}`} style={styles.hintRow}>
              <Text style={styles.hintIndexLocked}>#{revealedHints.length + i + 1}</Text>
              <Ionicons name="lock-closed-outline" size={12} color={colors.textMuted} />
              <Text style={styles.hintTextLocked}>{t('quizScreen.lockedHint')}</Text>
              {i === 0 && !isDone && quiz.nextHintCost !== null ? (
                <Pressable
                  style={styles.hintBuyButton}
                  onPress={() => void handleBuyHint()}
                  disabled={isBuyingHint}
                >
                  <Text style={styles.hintBuyButtonText}>
                    {t('quizScreen.hintBuyCost', { cost: quiz.nextHintCost }).toUpperCase()}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>

        {leaderboard.length > 0 ? (
          <View style={styles.leaderboard}>
            <Text style={styles.sectionTitle}>{t('quizScreen.friendsLeaderboard').toUpperCase()}</Text>
            <FlatList
              data={leaderboard}
              keyExtractor={(item) => String(item.id)}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.leaderboardRow}>
                  <Text
                    style={[
                      styles.leaderboardRank,
                      item.rank <= 3 && { color: RANK_COLORS[item.rank - 1] },
                    ]}
                  >
                    #{item.rank}
                  </Text>
                  <View style={styles.leaderboardAvatarRing}>
                    {item.avatarUrl ? (
                      <Image source={{ uri: item.avatarUrl }} style={styles.leaderboardAvatar} />
                    ) : (
                      <LinearGradient
                        colors={['#e8c377', '#a87c2e']}
                        start={{ x: 0.35, y: 0.3 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.leaderboardAvatar, styles.leaderboardAvatarFallback]}
                      >
                        <Text style={styles.leaderboardAvatarInitial}>
                          {item.username.charAt(0).toUpperCase()}
                        </Text>
                      </LinearGradient>
                    )}
                  </View>
                  <View style={styles.leaderboardText}>
                    <Text style={styles.leaderboardName} numberOfLines={1}>
                      {item.isMe ? t('quizScreen.you') : item.username}
                    </Text>
                    <Text style={styles.leaderboardStatus} numberOfLines={1}>
                      {statusLabel(item)}
                    </Text>
                  </View>
                  <Text
                    style={[styles.leaderboardScore, item.rank === 1 && styles.leaderboardScoreFirst]}
                  >
                    {item.totalScore}
                  </Text>
                </View>
              )}
            />
          </View>
        ) : null}
      </ScrollView>
      <Toast message={toastMessage} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, alignItems: 'center' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  statItem: { alignItems: 'center', paddingHorizontal: spacing.md },
  statValue: { color: colors.textPrimary, fontSize: 22, fontWeight: fontWeight.bold },
  statValueAccent: { color: colors.accentBright },
  statLabel: { color: colors.textMuted, fontSize: 8.5, letterSpacing: 1, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.borderSubtle },
  posterWrap: {
    width: 220,
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  poster: { width: '100%', height: '100%', position: 'absolute' },
  hintOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 14,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: 'rgba(15,13,10,.85)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  hintOverlayText: { color: colors.accentBright, fontSize: 10.5, fontWeight: fontWeight.semibold, textAlign: 'center' },
  posterCaption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm + 2,
  },
  posterCaptionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: fontWeight.bold },
  posterCaptionYear: { color: colors.textSubtle, fontSize: 10.5, marginTop: 2 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.lg, flexWrap: 'wrap', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(217,172,84,.5)' },
  dotFilled: { backgroundColor: colors.accentBright, borderColor: colors.accentBright },
  dotsLabel: { color: colors.textMuted, fontSize: 10, letterSpacing: 1, marginLeft: 6 },
  guessSection: { width: '100%' },
  guessBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.md,
    paddingRight: 4,
    paddingVertical: 4,
  },
  guessInput: { flex: 1, color: colors.textPrimary, fontSize: 14, paddingVertical: spacing.xs + 2 },
  guessButton: {
    backgroundColor: colors.accentBright,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  guessButtonText: { color: colors.textOnAccent, fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1 },
  suggestions: {
    width: '100%',
    marginTop: spacing.xs,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  suggestionText: { color: colors.textPrimary, fontSize: 13 },
  doneCard: { width: '100%', alignItems: 'flex-start', gap: spacing.sm },
  doneHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  doneHeaderText: { color: colors.accentBright, fontSize: 11, fontWeight: fontWeight.semibold, letterSpacing: 2 },
  doneHeadline: { color: colors.textPrimary, fontSize: 26, fontWeight: fontWeight.bold },
  doneHeadlineAccent: { color: colors.accentBright },
  answerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.45)',
  },
  answerChipText: { color: colors.textPrimary, fontSize: 13, fontWeight: fontWeight.semibold },
  doneStatsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    width: '100%',
  },
  doneStatItem: { gap: 2 },
  doneStatValue: { color: colors.accentBright, fontSize: 18, fontWeight: fontWeight.bold },
  doneStatLabel: { color: colors.textMuted, fontSize: 8.5, letterSpacing: 1 },
  doneActionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  viewMovieButton: {
    backgroundColor: colors.accentBright,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
  },
  viewMovieButtonText: { color: colors.textOnAccent, fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1 },
  watchlistButton: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
  },
  watchlistButtonText: { color: colors.textSubtle, fontSize: 11, fontWeight: fontWeight.semibold, letterSpacing: 1 },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    width: '100%',
  },
  countdownLabel: { color: colors.textMuted, fontSize: 11.5 },
  countdownValue: { color: colors.textPrimary, fontSize: 12.5, fontWeight: fontWeight.semibold },
  shareButton: { marginLeft: 'auto' },
  shareButtonText: { color: colors.textMuted, fontSize: 10, letterSpacing: 1 },
  hintsSection: { width: '100%', marginTop: spacing.xl },
  hintsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  hintsHeaderLine: { flex: 1, height: 1, backgroundColor: colors.borderSubtle },
  hintsHeaderMeta: { color: colors.textMuted, fontSize: 10.5 },
  sectionTitle: {
    color: colors.accentBright,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  hintIndex: { color: colors.accentBright, fontSize: 11, fontWeight: fontWeight.bold, width: 22 },
  hintIndexLocked: { color: colors.textMuted, fontSize: 11, fontWeight: fontWeight.bold, width: 22 },
  hintText: { flex: 1, color: colors.textPrimary, fontSize: 13.5, lineHeight: 19 },
  hintTextLocked: { flex: 1, color: colors.textMuted, fontSize: 13.5 },
  hintBuyButton: {
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.4)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  hintBuyButtonText: { color: colors.accentBright, fontSize: 9.5, fontWeight: fontWeight.semibold },
  leaderboard: { width: '100%', marginTop: spacing.xl },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  leaderboardRank: { color: colors.textMuted, fontSize: 11, fontWeight: fontWeight.bold, width: 22 },
  leaderboardAvatarRing: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden' },
  leaderboardAvatar: { width: '100%', height: '100%' },
  leaderboardAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  leaderboardAvatarInitial: { color: colors.textOnAccent, fontSize: 12, fontWeight: fontWeight.bold },
  leaderboardText: { flex: 1, minWidth: 0, gap: 1 },
  leaderboardName: { color: colors.textPrimary, fontSize: 13, fontWeight: fontWeight.semibold },
  leaderboardStatus: { color: colors.textMuted, fontSize: 10.5 },
  leaderboardScore: { color: colors.textMuted, fontSize: 14, fontWeight: fontWeight.bold },
  leaderboardScoreFirst: { color: colors.accentBright },
});
