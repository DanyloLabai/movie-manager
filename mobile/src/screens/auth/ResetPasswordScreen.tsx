import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fontWeight } from '@movie-manager/shared';
import { resetPassword } from '../../api/auth.api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { useAuthBackdrop } from '../../hooks/useAuthBackdrop';
import { colors, spacing, radius, fontFamily } from '../../theme';
import type { AuthStackParamList } from '../../navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

// The reset link in the email opens a web page (movie-frontend's
// /reset-password?token=…) since the app has no deep-link scheme registered
// yet — this screen instead lets the user paste that token in by hand, so
// the mobile app can complete the same reset-password endpoint.
export default function ResetPasswordScreen({ navigation }: Props) {
  const backdropUri = useAuthBackdrop();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSuccessMessage(null);
    if (!token || !newPassword) {
      setError('Fill in all fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await resetPassword({ token, newPassword });
      setSuccessMessage(result.message || 'Password reset — log in with your new password.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not reset password. The link may have expired.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      {backdropUri ? (
        <Image
          source={{ uri: backdropUri }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          blurRadius={14}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFillObject, styles.scrim]} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.iconBadge}>
              <Ionicons name="key-outline" size={26} color={colors.accent} />
            </View>
            <Text style={styles.title}>NEW PASSWORD</Text>
            <Text style={styles.subtitle}>PASTE THE CODE FROM YOUR EMAIL</Text>

            {successMessage ? (
              <>
                <Text style={styles.success}>{successMessage}</Text>
                <Pressable style={styles.button} onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.buttonText}>GO TO LOG IN</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.label}>RESET CODE</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Paste the code from your email"
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="none"
                  value={token}
                  onChangeText={setToken}
                />

                <Text style={styles.label}>NEW PASSWORD</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor={colors.textFaint}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />

                <Text style={styles.label}>CONFIRM NEW PASSWORD</Text>
                <TextInput
                  style={styles.input}
                  placeholderTextColor={colors.textFaint}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable
                  style={[styles.button, isSubmitting && styles.buttonDisabled]}
                  onPress={() => void handleSubmit()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={colors.textOnAccent} />
                  ) : (
                    <Text style={styles.buttonText}>RESET PASSWORD</Text>
                  )}
                </Pressable>
              </>
            )}

            <View style={styles.divider} />

            <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
              <Text style={styles.backLink}>← Back to log in</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrim: { backgroundColor: colors.overlayScrim },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  iconBadge: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    fontFamily: fontFamily.brand,
    letterSpacing: 6,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: fontWeight.medium,
    letterSpacing: 3,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  label: {
    color: colors.accentBright,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.backgroundElevated,
    color: colors.textPrimary,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 6,
    marginBottom: spacing.md,
    fontSize: 15,
  },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing.md, textAlign: 'center' },
  success: {
    color: colors.accentBright,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 6,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: colors.textOnAccent,
    fontSize: 15,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.5,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  backLink: {
    color: colors.accentBright,
    fontSize: 13,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
});
