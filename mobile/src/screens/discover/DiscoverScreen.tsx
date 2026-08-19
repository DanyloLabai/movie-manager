import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { getSwipeFeed, submitSwipeAction, type SwipeActionType, type SwipeCard } from '../../api/swipe.api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/Toast';
import { colors, spacing, radius } from '../../theme';
import type { MainStackParamList } from '../../navigation/MainStack';

const SWIPE_THRESHOLD = 120;

export default function DiscoverScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [cards, setCards] = useState<SwipeCard[]>([]);
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [remainingToday, setRemainingToday] = useState<number | null>(null);
  const { toastMessage, showToast } = useToast();
  const position = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    getSwipeFeed()
      .then((feed) => {
        setCards(feed.movies);
        setRemainingToday(feed.remainingToday);
      })
      .catch((err) => showToast(getErrorMessage(err, 'Could not load Discover.')))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = cards[index];

  const handleAction = async (action: SwipeActionType) => {
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
      });
      setRemainingToday(result.remainingToday);
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not save that.'));
    }
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-down" size={22} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.headerTitle}>DISCOVER</Text>
        <Text style={styles.headerCount}>
          {remainingToday != null ? `${remainingToday} left` : ''}
        </Text>
      </View>

      <View style={styles.deck}>
        {!current ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-done-circle-outline" size={40} color={colors.textFaint} />
            <Text style={styles.emptyText}>That's everything for today.</Text>
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
            <View style={styles.cardOverlay}>
              <Text style={styles.cardTitle}>{current.title}</Text>
              <Text style={styles.cardMeta}>
                {current.releaseYear} · ★ {current.voteAverage.toFixed(1)}
                {current.runtime ? ` · ${current.runtime}m` : ''}
              </Text>
              <Text style={styles.cardHook} numberOfLines={3}>
                {current.hook}
              </Text>
            </View>
          </Animated.View>
        )}
      </View>

      {current ? (
        <View style={styles.actionsRow}>
          <Pressable style={[styles.actionButton, styles.skipButton]} onPress={() => void handleAction('skip')}>
            <Ionicons name="close" size={26} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.watchedButton]}
            onPress={() => void handleAction('watched')}
          >
            <Ionicons name="eye" size={22} color={colors.textOnAccent} />
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.watchlistButton]}
            onPress={() => void handleAction('watchlist')}
          >
            <Ionicons name="bookmark" size={22} color={colors.textOnAccent} />
          </Pressable>
        </View>
      ) : null}

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
  headerTitle: { color: colors.accentBright, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  headerCount: { color: colors.textFaint, fontSize: 11, minWidth: 50, textAlign: 'right' },
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
  emptyCard: { alignItems: 'center', gap: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 13 },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
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
});
