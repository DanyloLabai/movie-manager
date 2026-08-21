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
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fontWeight } from '@movie-manager/shared';
import { useAuth } from '../../context/AuthContext';
import { signIn } from '../../api/auth.api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { useAuthBackdrop } from '../../hooks/useAuthBackdrop';
import { colors, spacing, radius, fontFamily } from '../../theme';
import type { AuthStackParamList } from '../../navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation('auth');
  const { login } = useAuth();
  const backdropUri = useAuthBackdrop();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await signIn({ email, password });
      await login({
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        user: result.user,
      });
      // No manual navigation call needed — RootNavigator swaps to MainStack
      // as soon as isAuthenticated flips true.
    } catch (err) {
      setError(getErrorMessage(err, t('login.error')));
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
              <Ionicons name="bulb-outline" size={26} color={colors.accent} />
            </View>
            <Text style={styles.title}>{t('login.brandName')}</Text>
            <Text style={styles.subtitle}>{t('login.subtitle').toUpperCase()}</Text>

            <Text style={styles.label}>{t('shared.emailAddressLabel').toUpperCase()}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('shared.emailPlaceholder')}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>{t('shared.passwordLabel').toUpperCase()}</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••••"
                placeholderTextColor={colors.textFaint}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowPassword((prev) => !prev)}
                hitSlop={8}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.textOnAccent} />
              ) : (
                <Text style={styles.buttonText}>{t('login.signIn').toUpperCase()}</Text>
              )}
            </Pressable>

            <Pressable onPress={() => navigation.navigate('ForgotPassword')} hitSlop={8}>
              <Text style={styles.forgotLink}>{t('login.forgotPassword').toUpperCase()}</Text>
            </Pressable>

            <View style={styles.divider} />

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>{t('login.newHere')}</Text>
              <Pressable onPress={() => navigation.navigate('Register')} hitSlop={8}>
                <Text style={styles.footerLink}>{t('login.createAccount').toUpperCase()}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrim: {
    backgroundColor: colors.overlayScrim,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
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
    fontSize: 30,
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
  passwordRow: {
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: spacing.xl + spacing.sm,
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.lg,
    top: 0,
    bottom: spacing.md,
    justifyContent: 'center',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 6,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.textOnAccent,
    fontSize: 15,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.5,
  },
  forgotLink: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  footerLink: {
    color: colors.accentBright,
    fontSize: 13,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
});
