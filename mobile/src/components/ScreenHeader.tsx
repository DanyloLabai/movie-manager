import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontFamily } from '../theme';
import NotificationBell from './NotificationBell';

interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  // Extra icon button(s) rendered between the title and the notification
  // bell — e.g. AiChatScreen's usage/clear-chat buttons.
  rightSlot?: ReactNode;
}

// The LUMEN wordmark + bulb badge + notification bell strip every main tab
// carries, matching the header in movie-frontend's Watchlist.tsx/AiChat.tsx.
export default function ScreenHeader({ title = 'LUMEN', subtitle, rightSlot }: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        <Ionicons name="bulb-outline" size={16} color={colors.accent} />
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.spacer} />
      {rightSlot}
      <NotificationBell />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    color: colors.accentBright,
    fontSize: 16,
    fontFamily: fontFamily.brand,
    letterSpacing: 4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginLeft: spacing.sm,
  },
  spacer: {
    flex: 1,
  },
});
