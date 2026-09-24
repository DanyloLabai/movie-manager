import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

export interface SegmentedTabOption {
  key: string;
  label: string;
  count?: number | null;
}

interface SegmentedTabsProps {
  options: SegmentedTabOption[];
  activeKey: string;
  onChange: (key: string) => void;
}

// Underlined tab strip reused for Profile's Profile/Watchlist/Watched tabs
// and the Friends sheet's list/requests/feed tabs (movie-frontend's
// Watchlist.tsx renders both with the same underline-on-active pattern).
export default function SegmentedTabs({ options, activeKey, onChange }: SegmentedTabsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      <View style={styles.row}>
        {options.map((opt) => {
          const isActive = opt.key === activeKey;
          return (
            <Pressable key={opt.key} onPress={() => onChange(opt.key)} style={styles.tab}>
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {opt.label}
                {opt.count != null ? <Text style={styles.count}> · {opt.count}</Text> : null}
              </Text>
              {isActive ? <View style={styles.underline} /> : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
  },
  tab: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  label: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  labelActive: {
    color: colors.accentBright,
  },
  count: {
    color: colors.textFaint,
  },
  underline: {
    marginTop: spacing.xs,
    height: 2,
    width: '100%',
    backgroundColor: colors.accentBright,
    borderRadius: 1,
  },
});
