import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { AiUsage, MovieResult, RecommendationReason } from '@movie-manager/shared';
import { aiSearch, getHistory, getUsage, postHistory } from '../../api/ai.api';
import { addToWatchlist, getProfile } from '../../api/movies.api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { useToast } from '../../hooks/useToast';
import ScreenHeader from '../../components/ScreenHeader';
import Toast from '../../components/Toast';
import { colors, spacing, radius, fontWeight } from '../../theme';
import type { AppTabsParamList } from '../../navigation/AppTabs';
import type { MainStackParamList } from '../../navigation/MainStack';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabsParamList, 'AiChat'>,
  NativeStackScreenProps<MainStackParamList>
>;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  movies?: MovieResult[];
  reasoning?: RecommendationReason[];
}

// getProfileData() returns more than the shared ProfileData type declares
// (movie-frontend's AiChat.tsx casts the same way, see its local
// ProfileResponse type) — watchedIds/inPlansIds aren't in the persisted
// wire contract elsewhere, just this endpoint's actual response.
interface ProfileResponse {
  watchedIds?: number[];
  inPlansIds?: number[];
}

const SUGGESTIONS = [
  'Suggest a mind-bending sci-fi movie',
  'What should I watch tonight?',
  'Movies similar to Inception',
  'What should I watch from my watchlist?',
];

function WhyThisHint({ reasoning }: { reasoning: RecommendationReason[] }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <View style={styles.whyThis}>
      <Pressable style={styles.whyThisToggle} onPress={() => setIsOpen((v) => !v)}>
        <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={11} color={colors.accentBright} />
        <Text style={styles.whyThisToggleText}>Why this</Text>
      </Pressable>
      {isOpen ? (
        <View style={styles.whyThisList}>
          {reasoning.map((r, i) => (
            <Text key={i} style={styles.whyThisItem}>
              {r.preferenceText} <Text style={styles.whyThisScore}>({Math.round(r.similarityScore * 100)}%)</Text>
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function AiChatScreen({ navigation }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const { toastMessage, showToast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        setMessages(await getHistory());
      } catch (err) {
        showToast(getErrorMessage(err, 'Could not load chat history.'));
      } finally {
        setIsLoadingHistory(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getProfile()
      .then((data) => {
        const profile = data as typeof data & ProfileResponse;
        const watchedIds = profile.watchedIds ?? [];
        const inPlansIds = profile.inPlansIds ?? [];
        setAddedIds(Array.from(new Set([...watchedIds, ...inPlansIds])));
      })
      .catch(() => {});
    getUsage().then(setUsage).catch(() => {});
  }, []);

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setDraft('');

    const userMessage: Message = { role: 'user', content: trimmed };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setIsSending(true);

    try {
      const response = await aiSearch({
        messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
      });
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.message ?? '',
        movies: response.movies,
        reasoning: response.reasoning,
      };
      const withReply = [...nextMessages, assistantMessage];
      setMessages(withReply);
      void postHistory(withReply.map((m) => ({ role: m.role, content: m.content, movies: m.movies }))).catch(
        () => {},
      );
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not get a response.'));
    } finally {
      setIsSending(false);
      getUsage().then(setUsage).catch(() => {});
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    void postHistory([]).catch(() => {});
    showToast('Chat history cleared.');
  };

  const handleAddFromChat = async (movie: MovieResult) => {
    try {
      await addToWatchlist({
        tmdbId: movie.id,
        title: movie.title,
        posterUrl: movie.posterUrl,
        mediaType: movie.mediaType,
        releaseDate: movie.releaseDate,
      });
      setAddedIds((prev) => [...prev, movie.id]);
      showToast('Added to watchlist.');
    } catch (err) {
      const apiError = err as { response?: { status?: number } };
      if (apiError.response?.status === 400) {
        setAddedIds((prev) => [...prev, movie.id]);
        showToast('Added to watchlist.');
      } else {
        showToast(getErrorMessage(err, 'Could not add to watchlist.'));
      }
    }
  };

  const formatTokenCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n));

  if (isLoadingHistory) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'left', 'right']}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScreenHeader
          title="LUMEN AI"
          rightSlot={
            usage ? (
              <Pressable style={styles.usageButton} onPress={() => setIsUsageOpen(true)}>
                <Ionicons name="stats-chart-outline" size={15} color={colors.textSubtle} />
              </Pressable>
            ) : null
          }
        />

        <FlatList
          data={messages}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyBadge}>
                <Ionicons name="bulb-outline" size={24} color={colors.accentBright} />
              </View>
              <Text style={styles.emptyTitle}>LUMEN AI</Text>
              <Text style={styles.empty}>Ask me for a movie recommendation.</Text>
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((chip) => (
                  <Pressable key={chip} style={styles.suggestionChip} onPress={() => void handleSend(chip)}>
                    <Text style={styles.suggestionChipText}>{chip}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) =>
            item.role === 'user' ? (
              <View style={[styles.bubble, styles.bubbleUser]}>
                <Text style={[styles.bubbleText, styles.bubbleTextUser]}>{item.content}</Text>
              </View>
            ) : (
              <View style={styles.assistantBlock}>
                {item.content ? <Text style={styles.assistantText}>{item.content}</Text> : null}

                {item.movies && item.movies.length > 0 ? (
                  <View style={styles.movieList}>
                    {item.movies.map((movie) => {
                      const added = addedIds.includes(movie.id);
                      return (
                        <View key={movie.id} style={styles.movieCard}>
                          <Pressable
                            onPress={() =>
                              navigation.navigate('MovieDetail', {
                                movieId: movie.id,
                                title: movie.title,
                                mediaType: movie.mediaType,
                              })
                            }
                          >
                            {movie.posterUrl ? (
                              <Image source={{ uri: movie.posterUrl }} style={styles.moviePoster} />
                            ) : (
                              <View style={[styles.moviePoster, styles.moviePosterPlaceholder]} />
                            )}
                          </Pressable>
                          <View style={styles.movieBody}>
                            <View style={styles.movieHeaderRow}>
                              <Text style={styles.movieTitle} numberOfLines={1}>
                                {movie.title}
                              </Text>
                              <Text style={styles.movieYear}>{movie.releaseYear}</Text>
                            </View>
                            {movie.rating ? (
                              <Text style={styles.movieRating}>★ {Number(movie.rating).toFixed(1)}</Text>
                            ) : null}
                            {movie.description ? (
                              <Text style={styles.movieDescription} numberOfLines={2}>
                                {movie.description}
                              </Text>
                            ) : null}
                            <View style={styles.movieActions}>
                              {added ? (
                                <View style={styles.addedPill}>
                                  <Text style={styles.addedPillText}>✓ ADDED</Text>
                                </View>
                              ) : (
                                <Pressable style={styles.addButton} onPress={() => void handleAddFromChat(movie)}>
                                  <Text style={styles.addButtonText}>+ ADD</Text>
                                </Pressable>
                              )}
                              <Pressable
                                style={styles.detailsButton}
                                onPress={() =>
                                  navigation.navigate('MovieDetail', {
                                    movieId: movie.id,
                                    title: movie.title,
                                    mediaType: movie.mediaType,
                                  })
                                }
                              >
                                <Text style={styles.detailsButtonText}>DETAILS</Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {item.reasoning && item.reasoning.length > 0 ? <WhyThisHint reasoning={item.reasoning} /> : null}
              </View>
            )
          }
        />

        <View style={styles.inputRow}>
          <Pressable style={styles.clearButton} onPress={handleClearChat} disabled={messages.length === 0}>
            <Ionicons
              name="trash-outline"
              size={16}
              color={messages.length === 0 ? colors.textFaint : colors.danger}
            />
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder="Ask about a movie…"
            placeholderTextColor={colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => void handleSend(draft)}
            editable={!isSending}
          />
          <Pressable style={styles.sendButton} onPress={() => void handleSend(draft)} disabled={isSending}>
            {isSending ? (
              <ActivityIndicator color={colors.textOnAccent} size="small" />
            ) : (
              <Ionicons name="arrow-up" size={18} color={colors.textOnAccent} />
            )}
          </Pressable>
        </View>
        <Text style={styles.disclaimer}>Lumen AI can make mistakes. Verify important info.</Text>
      </KeyboardAvoidingView>

      <Modal visible={isUsageOpen} transparent animationType="fade" onRequestClose={() => setIsUsageOpen(false)}>
        <Pressable style={styles.usageBackdrop} onPress={() => setIsUsageOpen(false)}>
          <Pressable style={styles.usageCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.usageCardTitle}>USAGE TODAY</Text>
            {usage ? (
              <View style={styles.usageRows}>
                <View style={styles.usageRow}>
                  <View style={styles.usageRowHeader}>
                    <Text style={styles.usageRowLabel}>REQUESTS</Text>
                    <Text style={styles.usageRowValue}>
                      {usage.requestCount}/{usage.requestLimit}
                    </Text>
                  </View>
                  <View style={styles.usageTrack}>
                    <View
                      style={[
                        styles.usageFill,
                        { width: `${Math.min(100, (usage.requestCount / usage.requestLimit) * 100)}%` },
                      ]}
                    />
                  </View>
                </View>
                <View style={styles.usageRow}>
                  <View style={styles.usageRowHeader}>
                    <Text style={styles.usageRowLabel}>TOKENS</Text>
                    <Text style={styles.usageRowValue}>
                      {formatTokenCount(usage.totalTokens)}/{formatTokenCount(usage.tokenLimit)}
                    </Text>
                  </View>
                  <View style={styles.usageTrack}>
                    <View
                      style={[
                        styles.usageFill,
                        { width: `${Math.min(100, (usage.totalTokens / usage.tokenLimit) * 100)}%` },
                      ]}
                    />
                  </View>
                </View>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Toast message={toastMessage} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: spacing.lg, gap: spacing.md, flexGrow: 1 },
  usageButton: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingBottom: spacing.xl },
  emptyBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: fontWeight.bold, letterSpacing: 3 },
  empty: { color: colors.textMuted, textAlign: 'center', fontSize: 13, maxWidth: 260 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2, justifyContent: 'center', marginTop: spacing.sm },
  suggestionChip: {
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.3)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  suggestionChipText: { color: colors.textSubtle, fontSize: 12 },
  bubble: { maxWidth: '85%', borderRadius: radius.md, padding: spacing.sm + 4 },
  bubbleUser: {
    backgroundColor: 'rgba(217,172,84,.13)',
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.25)',
    alignSelf: 'flex-end',
  },
  bubbleText: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: colors.textPrimary },
  assistantBlock: { gap: spacing.sm },
  assistantText: { color: colors.textSubtle, fontSize: 14, lineHeight: 20 },
  movieList: { gap: spacing.sm },
  movieCard: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.2)',
    borderRadius: radius.md,
    backgroundColor: 'rgba(217,172,84,.04)',
  },
  moviePoster: { width: 72, height: 108, borderRadius: radius.sm },
  moviePosterPlaceholder: { backgroundColor: colors.backgroundDeep },
  movieBody: { flex: 1, minWidth: 0, gap: 3 },
  movieHeaderRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  movieTitle: { flexShrink: 1, color: colors.textPrimary, fontSize: 14, fontWeight: fontWeight.bold },
  movieYear: { color: colors.textMuted, fontSize: 11 },
  movieRating: { color: colors.accentBright, fontSize: 11, fontWeight: fontWeight.semibold },
  movieDescription: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
  movieActions: { flexDirection: 'row', gap: spacing.xs + 2, marginTop: 2 },
  addButton: { backgroundColor: colors.accentBright, borderRadius: radius.full, paddingHorizontal: spacing.sm + 2, paddingVertical: 6 },
  addButtonText: { color: colors.textOnAccent, fontSize: 9.5, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
  addedPill: { borderWidth: 1, borderColor: 'rgba(217,172,84,.45)', borderRadius: radius.full, paddingHorizontal: spacing.sm + 2, paddingVertical: 6 },
  addedPillText: { color: colors.accentBright, fontSize: 9.5, fontWeight: fontWeight.bold },
  detailsButton: { borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.full, paddingHorizontal: spacing.sm + 2, paddingVertical: 6 },
  detailsButtonText: { color: colors.textSubtle, fontSize: 9.5, fontWeight: fontWeight.semibold },
  whyThis: { marginLeft: 2 },
  whyThisToggle: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  whyThisToggleText: { color: 'rgba(217,172,84,.75)', fontSize: 10, fontWeight: fontWeight.semibold, letterSpacing: 0.5 },
  whyThisList: { marginTop: 4, gap: 3, borderLeftWidth: 1, borderLeftColor: 'rgba(217,172,84,.2)', paddingLeft: spacing.sm },
  whyThisItem: { color: colors.textMuted, fontSize: 10.5 },
  whyThisScore: { color: 'rgba(217,172,84,.7)', fontWeight: fontWeight.semibold },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  clearButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,.03)',
    color: colors.textPrimary,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.accentBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimer: { color: colors.textFaint, fontSize: 9.5, textAlign: 'center', paddingVertical: spacing.sm },
  usageBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.8)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  usageCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  usageCardTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: fontWeight.bold,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  usageRows: { gap: spacing.md },
  usageRow: { gap: spacing.xs + 2 },
  usageRowHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  usageRowLabel: { color: colors.textMuted, fontSize: 9.5, letterSpacing: 1.5 },
  usageRowValue: { color: colors.textPrimary, fontSize: 11.5, fontWeight: fontWeight.semibold },
  usageTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.08)', overflow: 'hidden' },
  usageFill: { height: '100%', backgroundColor: colors.accentBright, borderRadius: 3 },
});
