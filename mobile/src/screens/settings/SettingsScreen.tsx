import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getProfile } from '../../api/movies.api';
import { deleteAccount, updateProfile } from '../../api/users.api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { isPushSupported, isPushSubscribed, enablePushNotifications, disablePushNotifications } from '../../utils/push';
import { useToast } from '../../hooks/useToast';
import ScreenHeader from '../../components/ScreenHeader';
import Toast from '../../components/Toast';
import { colors, spacing, radius, fontWeight } from '../../theme';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS } from '../../i18n';
import type { SupportedLanguage } from '../../i18n';
import type { AppTabsParamList } from '../../navigation/AppTabs';
import type { MainStackParamList } from '../../navigation/MainStack';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabsParamList, 'Settings'>,
  NativeStackScreenProps<MainStackParamList>
>;

export default function SettingsScreen({ navigation }: Props) {
  const { t } = useTranslation('settings');
  const { logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { toastMessage, showToast } = useToast();

  const [username, setUsername] = useState('');
  const [currentUsername, setCurrentUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  useEffect(() => {
    getProfile()
      .then((data) => {
        setUsername(data.username ?? '');
        setCurrentUsername(data.username ?? '');
        setAvatarUrl(data.avatarUrl ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isPushSupported()) return;
    setPushSupported(true);
    isPushSubscribed().then(setPushEnabled);
  }, []);

  const hasChanges = pickedImageUri !== null || username.trim() !== currentUsername;

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast(t('photoPermissionRequired'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedImageUri(result.assets[0].uri);
    }
  };

  const handleSaveProfile = async () => {
    setProfileError('');
    const trimmed = username.trim();
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setProfileError(t('usernameInvalid'));
      return;
    }
    if (!hasChanges) return;

    setIsSaving(true);
    const formData = new FormData();
    if (trimmed !== currentUsername) formData.append('username', trimmed);
    if (pickedImageUri) {
      const fileName = pickedImageUri.split('/').pop() ?? 'avatar.jpg';
      const extension = fileName.split('.').pop()?.toLowerCase();
      const mimeType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
      formData.append('avatar', { uri: pickedImageUri, name: fileName, type: mimeType } as unknown as Blob);
    }

    try {
      const response = await updateProfile(formData);
      setCurrentUsername(response.username ?? trimmed);
      setUsername(response.username ?? trimmed);
      if (response.avatarUrl) setAvatarUrl(response.avatarUrl);
      setPickedImageUri(null);
      showToast(t('profileUpdated'));
    } catch (err) {
      const apiError = err as { response?: { status?: number } };
      setProfileError(
        apiError.response?.status === 409
          ? t('usernameTaken')
          : getErrorMessage(err, t('profileUpdateError')),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePush = async () => {
    setPushBusy(true);
    try {
      if (pushEnabled) {
        await disablePushNotifications();
        setPushEnabled(false);
      } else {
        const success = await enablePushNotifications();
        setPushEnabled(success);
        if (!success) showToast(t('pushNotificationsNotEnabled'));
      }
    } catch (err) {
      showToast(getErrorMessage(err, t('pushNotificationsError')));
    } finally {
      setPushBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError('');
    try {
      await deleteAccount();
      await logout();
    } catch (err) {
      setDeleteError(getErrorMessage(err, t('deleteAccountError')));
      setIsDeleting(false);
    }
  };

  const handleSelectLanguage = async (next: SupportedLanguage) => {
    setIsLanguageModalOpen(false);
    if (next !== language) await setLanguage(next);
  };

  const previewUri = pickedImageUri ?? avatarUrl;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('title').toUpperCase()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>{t('editProfile').toUpperCase()}</Text>

        {profileError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{profileError}</Text>
          </View>
        ) : null}

        <View style={styles.avatarSection}>
          <Pressable onPress={() => void handlePickImage()}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={['#e8c377', '#a87c2e']}
                start={{ x: 0.35, y: 0.3 }}
                end={{ x: 1, y: 1 }}
                style={[styles.avatar, styles.avatarFallback]}
              >
                <Text style={styles.avatarInitial}>{(username || '?').charAt(0).toUpperCase()}</Text>
              </LinearGradient>
            )}
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera-outline" size={14} color={colors.accentBright} />
            </View>
          </Pressable>
          <Text style={styles.avatarHint}>{t('avatarHint').toUpperCase()}</Text>
        </View>

        <Text style={styles.inputLabel}>{t('usernameLabel').toUpperCase()}</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          maxLength={20}
        />

        <Pressable
          style={[styles.saveButton, (!hasChanges || isSaving) && styles.saveButtonDisabled]}
          onPress={() => void handleSaveProfile()}
          disabled={!hasChanges || isSaving}
        >
          <Text style={styles.saveButtonText}>{isSaving ? t('saving').toUpperCase() : t('saveChanges').toUpperCase()}</Text>
        </Pressable>

        <Text style={[styles.sectionTitle, styles.sectionSpacing]}>{t('preferences').toUpperCase()}</Text>
        <Pressable style={styles.row} onPress={() => setIsLanguageModalOpen(true)}>
          <Text style={styles.rowLabel}>{t('language')}</Text>
          <View style={styles.langBadge}>
            <Ionicons name="globe-outline" size={12} color={colors.accentBright} />
            <Text style={styles.langBadgeText}>{language.toUpperCase()}</Text>
          </View>
        </Pressable>

        {pushSupported ? (
          <View style={styles.row}>
            <View style={styles.rowTextGroup}>
              <Text style={styles.rowLabel}>{t('pushNotifications')}</Text>
              <Text style={styles.rowHint}>{t('pushNotificationsHint')}</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={() => void handleTogglePush()}
              disabled={pushBusy}
              trackColor={{ false: colors.backgroundElevated, true: colors.accentBright }}
              thumbColor={colors.textPrimary}
            />
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, styles.sectionSpacing]}>{t('account').toUpperCase()}</Text>
        <Pressable style={styles.row} onPress={() => navigation.navigate('ChangePassword')}>
          <Text style={styles.rowLabel}>{t('changePassword')}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
        </Pressable>
        <Pressable style={styles.row} onPress={() => void logout()}>
          <Text style={[styles.rowLabel, styles.rowLabelDanger]}>{t('logOut')}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.danger} />
        </Pressable>

        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>{t('dangerZone').toUpperCase()}</Text>
          <Text style={styles.dangerHint}>{t('dangerZoneHint')}</Text>
          <Pressable style={styles.deleteButton} onPress={() => setIsDeleteModalOpen(true)}>
            <Text style={styles.deleteButtonText}>{t('deleteAccount').toUpperCase()}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={isDeleteModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !isDeleting && setIsDeleteModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('deleteAccountConfirmTitle').toUpperCase()}</Text>
            <Text style={styles.modalText}>{t('deleteAccountConfirmText')}</Text>
            {deleteError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{deleteError}</Text>
              </View>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
              >
                <Text style={styles.modalCancelText}>{t('common:cancel').toUpperCase()}</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirm}
                onPress={() => void handleDeleteAccount()}
                disabled={isDeleting}
              >
                <Text style={styles.modalConfirmText}>
                  {isDeleting ? t('common:deleting').toUpperCase() : t('common:delete').toUpperCase()}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isLanguageModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLanguageModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsLanguageModalOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('chooseLanguage').toUpperCase()}</Text>
            {SUPPORTED_LANGUAGES.map((code) => (
              <Pressable
                key={code}
                style={styles.langOption}
                onPress={() => void handleSelectLanguage(code)}
              >
                <Text style={[styles.langOptionText, code === language && styles.langOptionTextActive]}>
                  {LANGUAGE_LABELS[code]}
                </Text>
                {code === language ? (
                  <Ionicons name="checkmark" size={18} color={colors.accentBright} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Toast message={toastMessage} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  sectionTitle: {
    color: colors.accentBright,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  sectionSpacing: { marginTop: spacing.xl },
  errorBox: {
    marginBottom: spacing.md,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(224,85,77,.35)',
    backgroundColor: 'rgba(224,85,77,.08)',
  },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: fontWeight.semibold, textAlign: 'center' },
  avatarSection: { alignItems: 'center', marginBottom: spacing.lg },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: 'rgba(217,172,84,.45)' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.textOnAccent, fontSize: 28, fontWeight: fontWeight.black },
  avatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.backgroundDeep,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: { color: colors.textMuted, fontSize: 9, fontWeight: fontWeight.semibold, letterSpacing: 1, marginTop: spacing.sm },
  inputLabel: { color: colors.accentBright, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1, marginBottom: spacing.xs },
  input: {
    color: colors.textPrimary,
    backgroundColor: 'rgba(255,255,255,.03)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  saveButton: {
    backgroundColor: colors.accentBright,
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { color: colors.textOnAccent, fontSize: 12, fontWeight: fontWeight.bold, letterSpacing: 1.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowTextGroup: { flex: 1, gap: 2, paddingRight: spacing.md },
  rowLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: fontWeight.semibold },
  rowLabelDanger: { color: colors.danger },
  rowHint: { color: colors.textMuted, fontSize: 10.5 },
  langBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  langBadgeText: { color: colors.accentBright, fontSize: 11, fontWeight: fontWeight.bold },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  langOptionText: { color: colors.textPrimary, fontSize: 14, fontWeight: fontWeight.semibold },
  langOptionTextActive: { color: colors.accentBright },
  dangerZone: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(224,85,77,.3)',
    backgroundColor: 'rgba(224,85,77,.05)',
  },
  dangerTitle: {
    color: colors.danger,
    fontSize: 10.5,
    fontWeight: fontWeight.semibold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  dangerHint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.md },
  deleteButton: {
    borderWidth: 1,
    borderColor: 'rgba(224,85,77,.4)',
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
  },
  deleteButtonText: { color: colors.danger, fontSize: 12, fontWeight: fontWeight.black, letterSpacing: 1.5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.8)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(224,85,77,.4)',
    padding: spacing.lg,
  },
  modalTitle: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: fontWeight.black,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalText: { color: colors.textSubtle, fontSize: 13, textAlign: 'center', marginBottom: spacing.md },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  modalCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  modalCancelText: { color: colors.textPrimary, fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1 },
  modalConfirm: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
  },
  modalConfirmText: { color: '#fff', fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1 },
});
