import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getMonthlyStats, type QuizMonthlyStatsEntry } from '../../api/quiz.api';
import { colors, spacing, radius, fontWeight } from '../../theme';

interface ProfileQuizStatsPanelProps {
  username: string;
  /** Omit for the signed-in user's own history. */
  userId?: number;
  /** Lets the parent skip its section wrapper while there's no history. */
  onAvailabilityChange?: (hasData: boolean) => void;
}

function monthLabel(month: string, locale: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, monthNum - 1, 1)));
  } catch {
    return month;
  }
}

// Ported from movie-frontend's ProfileQuizStatsPanel.tsx: monthly quiz stats
// (the quiz resets every month) with ‹ › paging through past months. Renders
// nothing until the user has any quiz history.
export default function ProfileQuizStatsPanel({
  username,
  userId,
  onAvailabilityChange,
}: ProfileQuizStatsPanelProps) {
  const { t, i18n } = useTranslation('profile');
  const [entries, setEntries] = useState<QuizMonthlyStatsEntry[] | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getMonthlyStats(userId)
      .then((data) => {
        if (cancelled) return;
        setEntries(data);
        setIndex(0);
        onAvailabilityChange?.(data.length > 0);
      })
      .catch(() => {
        if (!cancelled) {
          setEntries([]);
          onAvailabilityChange?.(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const locale = i18n.language === 'uk' ? 'uk-UA' : 'en-US';
  const current = entries?.[index] ?? null;
  const label = useMemo(() => (current ? monthLabel(current.month, locale) : ''), [current, locale]);

  if (!entries || entries.length === 0 || !current) return null;

  const tiles = [
    { value: current.avgScore, label: t('quizStats.avgScore') },
    { value: current.solvedCount, label: t('quizStats.solved') },
    { value: current.perfectSolves, label: t('quizStats.perfect') },
    { value: current.totalScore, label: t('quizStats.monthTotal') },
  ];

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={[styles.title, styles.titleFlex]}>
          {t('quizStats.title', { username }).toUpperCase()}
        </Text>
        {entries.length > 1 ? (
          <View style={styles.pager}>
            <Pressable
              style={[styles.pagerButton, index >= entries.length - 1 && styles.pagerButtonDisabled]}
              onPress={() => setIndex((i) => Math.min(i + 1, entries.length - 1))}
              disabled={index >= entries.length - 1}
              hitSlop={6}
            >
              <Text style={styles.pagerGlyph}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{label.toUpperCase()}</Text>
            <Pressable
              style={[styles.pagerButton, index <= 0 && styles.pagerButtonDisabled]}
              onPress={() => setIndex((i) => Math.max(i - 1, 0))}
              disabled={index <= 0}
              hitSlop={6}
            >
              <Text style={styles.pagerGlyph}>›</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.grid}>
        {tiles.map((tile) => (
          <View key={tile.label} style={styles.tile}>
            <Text style={styles.tileValue}>{tile.value}</Text>
            <Text style={styles.tileLabel}>{tile.label.toUpperCase()}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.accentBright,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 2.5,
  },
  titleFlex: { flexShrink: 1 },
  pager: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pagerButton: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagerButtonDisabled: { opacity: 0.3 },
  pagerGlyph: { color: colors.textMuted, fontSize: 14, lineHeight: 16 },
  monthLabel: { color: colors.textSubtle, fontSize: 10, letterSpacing: 1.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { width: '45%', gap: 4 },
  tileValue: { color: colors.textPrimary, fontSize: 22, fontWeight: fontWeight.bold },
  tileLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: fontWeight.medium,
    letterSpacing: 1.5,
  },
});
