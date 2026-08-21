import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { getSwipeFeed, submitSwipeAction, type SwipeActionType, type SwipeCard } from '../../api/swipe.api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/Toast';
import StarRating from '../../components/StarRating';
import { colors, spacing, radius, fontWeight } from '../../theme';
import type { MainStackParamList } from '../../navigation/MainStack';

const SWIPE_THRESHOLD = 120;

export default function DiscoverScreen() {
  const { t } = useTranslation('discover');
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [cards, setCards] = useState<SwipeCard[]>([]);
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [remainingToday, setRemainingToday] = useState<number | null>(null);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const [ratingModalRating, setRatingModalRating] = useState(0);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const { toastMessage, showToast } = useToast();
  const position = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    getSwipeFeed()
      .then((feed) => {
        setCards(feed.movies);
        setRemainingToday(feed.remainingToday);
        setDailyLimit(feed.dailyLimit);
      })
      .catch((err) => showToast(getErrorMessage(err, t('discoverScreen.loadError'))))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = cards[index];

  const commitAction = async (action: SwipeActionType, rating?: number) => {
    if (!current) return;
    Animated.timing(position, {
      toValue: { x: action === 'skip' ? -500 : 500, y: 0 },
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      setIndex((i) => i + 1);
    });
    try {
      const result = await submitSwipeAction({
        tmdbId: current.id,
        title: current.title,
        posterUrl: current.posterUrl,
        releaseDate: current.releaseDate,
        action,
        rating,
      });
      setRemainingToday(result.remainingToday);
      setDailyLimit(result.dailyLimit);
    } catch (err) {
      showToast(getErrorMessage(err, t('discoverScreen.saveError')));
    }
  };

  const handleAction = async (action: SwipeActionType) => {
    if (action === 'watched') {
      setRatingModalRating(0);
      setIsRatingModalOpen(true);
      return;
    }
    void commitAction(action);
  };

  const confirmWatched = () => {
    setIsRatingModalOpen(false);
    void commitAction('watched', ratingModalRating || undefined);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8,
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) void handleAction('watchlist');
        else if (gesture.dx < -SWIPE_THRESHOLD) void handleAction('skip');
        else {
          Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        }
      },
    }),
  ).current;

  const rotate = position.x.interpolate({
    inputRange: [-250, 0, 250],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'left', 'right']}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  const completedToday = dailyLimit != null && remainingToday != null ? dailyLimit - remainingToday : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-down" size={22} color={colors.textMuted} />
        </Pressable>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>{t('discoverScreen.title').toUpperCase()}</Text>
          <Text style={styles.headerSubtitle}>{t('discoverScreen.subtitle')}</Text>
        </View>
        <Text style={styles.headerCount}>
          {completedToday != null && dailyLimit != null
            ? t('discoverScreen.todayCount', { completed: completedToday, limit: dailyLimit })
            : ''}
        </Text>
      </View>

      <View style={styles.deck}>
        {!current ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-done-circle-outline" size={40} color={colors.textFaint} />
            <Text style={styles.emptyText}>{t('discoverScreen.emptyState')}</Text>
          </View>
        ) : (
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.card,
              { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] },
            ]}
          >
            {current.posterUrl ? (
              <Animated.Image source={{ uri: current.posterUrl }} style={styles.poster} resizeMode="cover" />
            ) : (
              <View style={[styles.poster, styles.posterPlaceholder]} />
            )}

            <View style={styles.matchBadge}>
              <Text style={styles.matchBadgeText}>
                {current.matchType === 'personalized'
                  ? `✦ ${t('discoverScreen.matchBadge.forYou').toUpperCase()}`
                  : `⟡ ${t('discoverScreen.matchBadge.differentPick').toUpperCase()}`}
              </Text>
            </View>

            <View style={styles.cardOverlay}>
              <Text style={styles.cardTitle}>{current.title}</Text>
              <Text style={styles.cardMeta}>
                {current.releaseYear} · ★ {current.voteAverage.toFixed(1)}
                {current.runtime ? ` · ${current.runtime}m` : ''}
                {current.genres.length > 0 ? ` · ${current.genres.join(', ')}` : ''}
              </Text>
              <Text style={styles.cardHook} numberOfLines={3}>
                {current.hook}
              </Text>
              <Pressable
                onPress={() =>
                  navigation.navigate('MovieDetail', {
                    movieId: current.id,
                    title: current.title,
                    mediaType: current.mediaType,
                  })
                }
              >
                <Text style={styles.detailsLink}>{t('discoverScreen.details').toUpperCase()} →</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </View>

      {current ? (
        <View style={styles.actionsRow}>
          <View style={styles.actionGroup}>
            <Pressable style={[styles.actionButton, styles.skipButton]} onPress={() => void handleAction('skip')}>
              <Ionicons name="close" size={26} color={colors.textMuted} />
            </Pressable>
            <Text style={styles.actionLabel}>{t('discoverScreen.actions.skip')}</Text>
          </View>
          <View style={styles.actionGroup}>
            <Pressable
              style={[styles.actionButton, styles.watchedButton]}
              onPress={() => void handleAction('watched')}
            >
              <Ionicons name="checkmark" size={22} color={colors.textOnAccent} />
            </Pressable>
            <Text style={styles.actionLabel}>{t('discoverScreen.actions.watched')}</Text>
          </View>
          <View style={styles.actionGroup}>
            <Pressable
              style={[styles.actionButton, styles.watchlistButton]}
              onPress={() => void handleAction('watchlist')}
            >
              <Ionicons name="add" size={26} color={colors.textOnAccent} />
            </Pressable>
            <Text style={styles.actionLabel}>{t('discoverScreen.actions.watchlist')}</Text>
          </View>
        </View>
      ) : null}

      <Modal visible={isRatingModalOpen} transparent animationType="fade" onRequestClose={() => setIsRatingModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsRatingModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('discoverScreen.rateModal.title')}</Text>
            <Text style={styles.modalSubtitle}>{current?.title}</Text>
            <View style={styles.modalStars}>
              <StarRating size="lg" value={ratingModalRating} onRate={setRatingModalRating} />
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setIsRatingModalOpen(false)}>
                <Text style={styles.modalCancelText}>{t('common:cancel').toUpperCase()}</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={confirmWatched}>
                <Text style={styles.modalConfirmText}>{t('common:save').toUpperCase()}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Toast message={toastMessage} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitleGroup: { alignItems: 'center' },
  headerTitle: { color: colors.accentBright, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  headerSubtitle: { color: colors.textFaint, fontSize: 10, marginTop: 2 },
  headerCount: { color: colors.textFaint, fontSize: 11, minWidth: 70, textAlign: 'right' },
  deck: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 340,
    aspectRatio: 2 / 3,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  poster: { width: '100%', height: '100%' },
  posterPlaceholder: { backgroundColor: colors.backgroundDeep },
  matchBadge: {
    position: 'absolute',
    top: spacing.sm + 2,
    left: spacing.sm + 2,
    backgroundColor: colors.overlayScrim,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  matchBadgeText: {
    color: colors.accentBright,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
  cardOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    backgroundColor: colors.overlayScrim,
  },
  cardTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  cardMeta: { color: colors.accentBright, fontSize: 12, fontWeight: '600', marginTop: 2 },
  cardHook: { color: colors.textSecondary, fontSize: 12, marginTop: spacing.xs },
  detailsLink: {
    color: colors.accentBright,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    marginTop: spacing.sm,
  },
  emptyCard: { alignItems: 'center', gap: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 13 },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
  actionGroup: { alignItems: 'center', gap: spacing.xs },
  actionLabel: {
    color: colors.textMuted,
    fontSize: 10.5,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: { backgroundColor: colors.backgroundElevated, borderWidth: 1, borderColor: colors.border },
  watchedButton: { backgroundColor: colors.accentDeep, width: 48, height: 48, borderRadius: 24 },
  watchlistButton: { backgroundColor: colors.accent },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.8)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  modalTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: fontWeight.bold },
  modalSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: spacing.md },
  modalStars: { marginBottom: spacing.md },
  modalActions: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  modalCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  modalCancelText: { color: colors.textPrimary, fontSize: 12, fontWeight: fontWeight.bold, letterSpacing: 1 },
  modalConfirm: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  modalConfirmText: { color: colors.textOnAccent, fontSize: 12, fontWeight: fontWeight.bold, letterSpacing: 1 },
});
