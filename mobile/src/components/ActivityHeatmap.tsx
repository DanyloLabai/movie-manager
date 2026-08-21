import { useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { ActivityDay } from '../api/users.api';
import { colors, spacing } from '../theme';

const CELL = 10;
const GAP = 3;

// Same 0-4 bucketing as movie-frontend's utils/activity.ts getActivityLevel,
// mapped onto the LUMEN gold scale instead of Tailwind classes.
function levelColor(count: number): string {
  if (count <= 0) return colors.backgroundElevated;
  if (count === 1) return '#3a2f1a';
  if (count <= 3) return '#6b5426';
  if (count <= 6) return '#a5822f';
  return colors.accentBright;
}

interface ActivityHeatmapProps {
  days: ActivityDay[];
  year: number;
  isLoading: boolean;
  onPrevYear: () => void;
  onNextYear: () => void;
  canGoNext: boolean;
  onPressDay?: (day: ActivityDay) => void;
}

// Ported from movie-frontend's ActivityHeatmap.tsx: a scrollable week-grid
// with the same 5-level gold intensity scale. Tapping a day with activity
// calls onPressDay with that day's full record (including its actions list)
// so the caller can show a detail modal, matching web's ActivityDayModal.
export default function ActivityHeatmap({
  days,
  year,
  isLoading,
  onPrevYear,
  onNextYear,
  canGoNext,
  onPressDay,
}: ActivityHeatmapProps) {
  const { t } = useTranslation('profile');
  const scrollRef = useRef<ScrollView>(null);
  const dayByDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  const weeks = useMemo(() => {
    const countByDate = new Map(days.map((d) => [d.date, d.count]));
    const jan1 = new Date(year, 0, 1);
    const dec31 = new Date(year, 11, 31);
    // Pad to the previous Sunday so week columns line up.
    const start = new Date(jan1);
    start.setDate(start.getDate() - start.getDay());

    const cols: { date: string; count: number; inYear: boolean }[][] = [];
    let cursor = new Date(start);
    let col: { date: string; count: number; inYear: boolean }[] = [];
    while (cursor <= dec31) {
      const iso = cursor.toISOString().slice(0, 10);
      col.push({
        date: iso,
        count: countByDate.get(iso) ?? 0,
        inYear: cursor.getFullYear() === year,
      });
      if (col.length === 7) {
        cols.push(col);
        col = [];
      }
      cursor = new Date(cursor.getTime() + 86400000);
    }
    if (col.length > 0) cols.push(col);
    return cols;
  }, [days, year]);

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('heatmap.title').toUpperCase()} · {year}</Text>
        <View style={styles.yearNav}>
          <Pressable onPress={onPrevYear} hitSlop={8}>
            <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={onNextYear} disabled={!canGoNext} hitSlop={8}>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={canGoNext ? colors.textMuted : colors.textFaint}
            />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <Text style={styles.loading}>{t('common:loading')}</Text>
      ) : (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          <View style={styles.grid}>
            {weeks.map((week, i) => (
              <View key={i} style={styles.col}>
                {week.map((day) => (
                  <Pressable
                    key={day.date}
                    disabled={!day.inYear || day.count === 0}
                    onPress={() => {
                      const full = dayByDate.get(day.date);
                      if (full) onPressDay?.(full);
                    }}
                    style={[
                      styles.cell,
                      { backgroundColor: day.inYear ? levelColor(day.count) : 'transparent' },
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.accentBright,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  yearNav: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  loading: {
    color: colors.textFaint,
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    gap: GAP,
  },
  col: {
    gap: GAP,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 2,
  },
});
