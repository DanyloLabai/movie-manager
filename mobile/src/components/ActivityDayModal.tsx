import { FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { ActivityDay, ActivityDayAction, ActivityActionType } from '../api/users.api';
import { colors, spacing, radius, fontWeight } from '../theme';

const ACTION_ICONS: Record<ActivityActionType, keyof typeof Ionicons.glyphMap> = {
  watched: 'eye-outline',
  added_watchlist: 'add-circle-outline',
  rated: 'star',
  favorited: 'heart',
};

const ACTION_LABEL_KEYS: Record<ActivityActionType, string> = {
  watched: 'activityDayModal.actions.watched',
  added_watchlist: 'activityDayModal.actions.addedWatchlist',
  rated: 'activityDayModal.actions.rated',
  favorited: 'activityDayModal.actions.favorited',
};

interface ActivityDayModalProps {
  day: ActivityDay | null;
  onClose: () => void;
  onPressMovie: (action: ActivityDayAction) => void;
}

// Ported from movie-frontend's ActivityDayModal.tsx: date header + count,
// then a scrollable list of that day's actions (poster, title, icon+label,
// rating when actionType is 'rated').
export default function ActivityDayModal({ day, onClose, onPressMovie }: ActivityDayModalProps) {
  const { t } = useTranslation('profile');
  const formatted = day
    ? new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '';

  return (
    <Modal visible={!!day} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.date}>{formatted}</Text>
              <Text style={styles.count}>{t('activityDayModal.moviesCount', { count: day?.count ?? 0 }).toUpperCase()}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <FlatList
            data={day?.actions ?? []}
            keyExtractor={(a, i) => `${a.tmdbId}-${a.actionType}-${i}`}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => onPressMovie(item)}>
                {item.posterUrl ? (
                  <Image source={{ uri: item.posterUrl }} style={styles.poster} />
                ) : (
                  <View style={[styles.poster, styles.posterPlaceholder]} />
                )}
                <View style={styles.rowBody}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={styles.metaRow}>
                    <Ionicons name={ACTION_ICONS[item.actionType]} size={11} color={colors.textMuted} />
                    <Text style={styles.meta}>{t(ACTION_LABEL_KEYS[item.actionType])}</Text>
                    {item.actionType === 'rated' && item.rating != null ? (
                      <Text style={styles.rating}>({item.rating}/10)</Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            )}
          />
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
    backgroundColor: colors.backgroundDeep,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.3)',
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  date: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  count: {
    color: colors.accentBright,
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  list: { flexGrow: 0 },
  listContent: { gap: spacing.xs + 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,.03)',
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.1)',
  },
  poster: { width: 32, height: 44, borderRadius: radius.sm },
  posterPlaceholder: { backgroundColor: colors.backgroundElevated },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: colors.textPrimary, fontSize: 12.5, fontWeight: fontWeight.bold },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { color: colors.textMuted, fontSize: 9.5 },
  rating: { color: colors.accentBright, fontSize: 9.5, fontWeight: fontWeight.bold },
});
