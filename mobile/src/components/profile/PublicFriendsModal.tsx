import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getPublicFriends } from '../../api/users.api';
import type { Friend } from '../../api/users.api';
import { colors, spacing, radius, fontWeight } from '../../theme';

interface PublicFriendsModalProps {
  visible: boolean;
  userId: number;
  username: string;
  onClose: () => void;
  onPressFriend: (friend: Friend) => void;
}

// Ported from movie-frontend's PublicFriendsModal.tsx: read-only list of
// another user's friends; tapping one opens that person's profile.
export default function PublicFriendsModal({
  visible,
  userId,
  username,
  onClose,
  onPressFriend,
}: PublicFriendsModalProps) {
  const { t } = useTranslation('profile');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setIsLoading(true);
    setHasError(false);
    getPublicFriends(userId)
      .then((data) => {
        if (!cancelled) setFriends(data);
      })
      .catch(() => {
        if (!cancelled) {
          setFriends([]);
          setHasError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, userId]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {t('publicFriends.title', { name: username })}{' '}
              <Text style={styles.count}>· {friends.length}</Text>
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator color={colors.accent} style={styles.spinner} />
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(item) => String(item.id)}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {hasError ? t('publicFriends.loadError') : t('publicFriends.empty')}
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => onPressFriend(item)}>
                  {item.avatarUrl ? (
                    <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarInitial}>{item.username.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={styles.name} numberOfLines={1}>
                    {item.username}
                  </Text>
                </Pressable>
              )}
            />
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
    maxWidth: 420,
    maxHeight: '75%',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: { flexShrink: 1, color: colors.textPrimary, fontSize: 15, fontWeight: fontWeight.bold },
  count: { color: colors.accentBright },
  close: { color: colors.textMuted, fontSize: 16 },
  spinner: { marginVertical: spacing.lg },
  empty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, paddingVertical: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.textOnAccent, fontWeight: fontWeight.bold, fontSize: 14 },
  name: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: fontWeight.semibold },
});
