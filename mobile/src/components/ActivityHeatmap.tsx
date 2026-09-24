import { useMemo, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { ActivityDay } from "../api/users.api";
import { colors, spacing } from "../theme";

const CELL = 10;
const GAP = 3;

// Same 0-4 bucketing as movie-frontend's utils/activity.ts getActivityLevel,
// mapped onto the LUMEN gold scale instead of Tailwind classes.
function levelColor(count: number): string {
  if (count <= 0) return colors.backgroundElevated;
  if (count === 1) return "#3a2f1a";
  if (count <= 3) return "#6b5426";
  if (count <= 6) return "#a5822f";
  return colors.accentBright;
}

interface HeatmapCell {
  date: string;
  count: number;
  inYear: boolean;
}

function buildWeeks(year: number, days: ActivityDay[]): HeatmapCell[][] {
  const countByDate = new Map(days.map((d) => [d.date, d.count]));
  const start = new Date(Date.UTC(year, 0, 1));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = new Date(Date.UTC(year, 11, 31));
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));

  const weeks: HeatmapCell[][] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const week: HeatmapCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = cursor.toISOString().slice(0, 10);
      week.push({
        date,
        count: countByDate.get(date) ?? 0,
        inYear: cursor.getUTCFullYear() === year,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function getMonthLabels(weeks: HeatmapCell[][], locale: string): string[] {
  let lastMonth = -1;
  return weeks.map((week) => {
    const firstInYear = week.find((d) => d.inYear);
    if (!firstInYear) return "";
    const month = new Date(`${firstInYear.date}T00:00:00Z`).getUTCMonth();
    if (month === lastMonth) return "";
    lastMonth = month;
    return new Date(Date.UTC(2000, month, 1)).toLocaleDateString(locale, {
      month: "short",
      timeZone: "UTC",
    });
  });
}

function getWeekdayLabels(locale: string): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    i % 2 === 1
      ? new Date(Date.UTC(1970, 0, 4 + i)).toLocaleDateString(locale, {
          weekday: "short",
          timeZone: "UTC",
        })
      : "",
  );
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

export default function ActivityHeatmap({
  days,
  year,
  isLoading,
  onPrevYear,
  onNextYear,
  canGoNext,
  onPressDay,
}: ActivityHeatmapProps) {
  const { t, i18n } = useTranslation("profile");
  const scrollRef = useRef<ScrollView>(null);
  const dayByDate = useMemo(
    () => new Map(days.map((d) => [d.date, d])),
    [days],
  );

  const weeks = useMemo(() => buildWeeks(year, days), [days, year]);
  const dateLocale = i18n.language === "uk" ? "uk-UA" : "en-US";
  const monthLabels = useMemo(
    () => getMonthLabels(weeks, dateLocale),
    [weeks, dateLocale],
  );
  const weekdayLabels = useMemo(
    () => getWeekdayLabels(dateLocale),
    [dateLocale],
  );

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          {t("heatmap.title").toUpperCase()} · {year}
        </Text>
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
        <Text style={styles.loading}>{t("common:loading")}</Text>
      ) : (
        <View style={styles.body}>
          <View style={styles.weekdayCol}>
            <View style={styles.monthRow} />
            {weekdayLabels.map((label, i) => (
              <Text key={i} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: false })
            }
          >
            <View style={styles.stack}>
              <View style={[styles.grid, styles.monthRow]}>
                {weeks.map((_, i) => (
                  <View key={i} style={styles.monthCell}>
                    {monthLabels[i] ? (
                      <Text style={styles.monthLabel} numberOfLines={1}>
                        {monthLabels[i]}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
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
                          {
                            backgroundColor: day.inYear
                              ? levelColor(day.count)
                              : "transparent",
                          },
                        ]}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.accentBright,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  yearNav: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  loading: {
    color: colors.textFaint,
    fontSize: 12,
  },
  body: {
    flexDirection: "row",
    gap: 6,
  },
  weekdayCol: {
    gap: GAP,
    paddingRight: 2,
  },
  stack: {
    gap: GAP,
  },
  weekdayLabel: {
    height: CELL,
    lineHeight: CELL,
    color: colors.textMuted,
    fontSize: 8,
  },
  monthRow: {
    height: 14,
    marginBottom: 2,
  },
  monthCell: {
    width: CELL,
    overflow: "visible",
  },
  monthLabel: {
    position: "absolute",
    left: 0,
    width: 40,
    color: colors.textMuted,
    fontSize: 9,
  },
  grid: {
    flexDirection: "row",
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
