import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getMyFeedbackStatus, submitFeedback } from '../api/feedback.api';
import { colors, spacing, radius, fontWeight } from '../theme';

// Same timings as movie-frontend's FeedbackPrompt.tsx.
const SHOW_AFTER_MS = 90_000;
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

interface FeedbackPromptState {
  submitted?: boolean;
  lastDismissedAt?: number;
}

// Keyed per user so a second account on the same device isn't silenced by the
// first one's snooze. SecureStore keys allow only [A-Za-z0-9._-].
const stateKey = (userId: number) => `feedbackPrompt.${userId}`;

async function readState(userId: number): Promise<FeedbackPromptState> {
  try {
    const raw = await SecureStore.getItemAsync(stateKey(userId));
    return raw ? (JSON.parse(raw) as FeedbackPromptState) : {};
  } catch {
    return {};
  }
}

async function writeState(userId: number, state: FeedbackPromptState) {
  try {
    await SecureStore.setItemAsync(stateKey(userId), JSON.stringify(state));
  } catch {
    // Storage unavailable — worst case the prompt shows again next session.
  }
}

// Ported from movie-frontend's FeedbackPrompt.tsx: after ~90s in the app, ask
// signed-in users who haven't sent feedback for a 1-5 rating plus an optional
// comment; "Not now" snoozes it for two weeks.
export default function FeedbackPrompt() {
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const userId = user?.id;
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    if (userId == null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const arm = () => {
      timer = setTimeout(() => {
        if (!cancelled) setVisible(true);
      }, SHOW_AFTER_MS);
    };

    (async () => {
      const state = await readState(userId);
      if (cancelled || state.submitted) return;
      if (state.lastDismissedAt && Date.now() - state.lastDismissedAt < SNOOZE_MS) return;

      // Local state alone isn't reliable across devices or reinstalls, so
      // confirm with the server before arming the timer.
      try {
        const { hasSubmitted } = await getMyFeedbackStatus();
        if (cancelled) return;
        if (hasSubmitted) {
          await writeState(userId, { ...state, submitted: true });
          return;
        }
      } catch {
        // Fall through and show anyway — the server rejects duplicates.
      }
      if (!cancelled) arm();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [userId]);

  if (userId == null) return null;

  const dismiss = async () => {
    setVisible(false);
    await writeState(userId, { ...(await readState(userId)), lastDismissedAt: Date.now() });
  };

  const submit = async () => {
    if (rating === 0 || status === 'sending') return;
    setStatus('sending');
    try {
      await submitFeedback({ rating, message: message.trim() || undefined });
      await writeState(userId, { submitted: true });
      setStatus('sent');
      setTimeout(() => setVisible(false), 2500);
    } catch {
      setStatus('error');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => void dismiss()}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={() => void dismiss()}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Pressable style={styles.close} onPress={() => void dismiss()} hitSlop={10}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>

            {status === 'sent' ? (
              <Text style={styles.thanks}>{t('feedback.thanks')}</Text>
            ) : (
              <>
                <Text style={styles.title}>{t('feedback.title')}</Text>
                <Text style={styles.subtitle}>{t('feedback.subtitle')}</Text>

                <View style={styles.stars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable key={star} onPress={() => setRating(star)} hitSlop={4}>
                      <Text style={[styles.star, star <= rating && styles.starActive]}>★</Text>
                    </Pressable>
                  ))}
                </View>

                <TextInput
                  style={styles.input}
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t('feedback.placeholder')}
                  placeholderTextColor={colors.textFaint}
                  multiline
                  maxLength={1000}
                />

                {status === 'error' ? <Text style={styles.error}>{t('feedback.error')}</Text> : null}

                <View style={styles.actions}>
                  <Pressable style={[styles.button, styles.skip]} onPress={() => void dismiss()}>
                    <Text style={styles.skipText}>{t('feedback.skip').toUpperCase()}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.button, styles.submit, (rating === 0 || status === 'sending') && styles.disabled]}
                    onPress={() => void submit()}
                    disabled={rating === 0 || status === 'sending'}
                  >
                    <Text style={styles.submitText}>
                      {(status === 'sending' ? t('feedback.sending') : t('feedback.submit')).toUpperCase()}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.backgroundDeep,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.3)',
    padding: spacing.lg,
  },
  close: { position: 'absolute', top: spacing.sm + 4, right: spacing.md, zIndex: 1 },
  closeText: { color: colors.textMuted, fontSize: 14 },
  title: { color: colors.textPrimary, fontSize: 17, fontWeight: fontWeight.bold, paddingRight: spacing.lg },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: spacing.md },
  stars: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginBottom: spacing.md },
  star: { color: '#3a352c', fontSize: 34 },
  starActive: { color: colors.accentBright },
  input: {
    minHeight: 80,
    maxHeight: 140,
    textAlignVertical: 'top',
    backgroundColor: 'rgba(0,0,0,.3)',
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.2)',
    borderRadius: radius.md,
    color: colors.textPrimary,
    fontSize: 13,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  error: { color: colors.danger, fontSize: 12, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  button: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm + 4, borderRadius: radius.full },
  skip: { borderWidth: 1, borderColor: colors.borderSubtle },
  skipText: { color: colors.textSubtle, fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1 },
  submit: { backgroundColor: colors.accent },
  submitText: { color: colors.textOnAccent, fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1 },
  disabled: { opacity: 0.4 },
  thanks: {
    color: colors.accentBright,
    fontSize: 15,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
