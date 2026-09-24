import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TMDB_GENRES } from '../constants/genres';
import type { SmartSearchFilters } from '../api/movies.api';
import { colors, spacing, radius, fontWeight } from '../theme';

interface SearchFilterBarProps {
  filters: SmartSearchFilters;
  onChange: (filters: SmartSearchFilters) => void;
  onApply: () => void;
}

const RATING_TIERS = [6, 7, 8];

// Ported from movie-frontend's SearchFilterBar.tsx. Web uses a native
// <select> for genre; RN has no dropdown here without adding a native
// picker dependency, so genre is a horizontal chip row instead (same
// selection pattern as the Min Rating pills).
export default function SearchFilterBar({ filters, onChange, onApply }: SearchFilterBarProps) {
  const { t } = useTranslation('discover');
  const setFilter = <K extends keyof SmartSearchFilters>(key: K, value: SmartSearchFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('filterBar.genre').toUpperCase()}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        <View style={styles.chipRow}>
          <Pressable
            style={[styles.chip, filters.genreId === undefined && styles.chipActive]}
            onPress={() => setFilter('genreId', undefined)}
          >
            <Text style={[styles.chipText, filters.genreId === undefined && styles.chipTextActive]}>
              {t('filterBar.anyGenre')}
            </Text>
          </Pressable>
          {TMDB_GENRES.map((genre) => (
            <Pressable
              key={genre.id}
              style={[styles.chip, filters.genreId === genre.id && styles.chipActive]}
              onPress={() => setFilter('genreId', genre.id)}
            >
              <Text style={[styles.chipText, filters.genreId === genre.id && styles.chipTextActive]}>
                {genre.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>{t('filterBar.year').toUpperCase()}</Text>
          <View style={styles.rangeRow}>
            <TextInput
              style={styles.rangeInput}
              placeholder={t('filterBar.from')}
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              value={filters.yearFrom ? String(filters.yearFrom) : ''}
              onChangeText={(v) => setFilter('yearFrom', v ? Number(v) : undefined)}
            />
            <Text style={styles.rangeDash}>–</Text>
            <TextInput
              style={styles.rangeInput}
              placeholder={t('filterBar.to')}
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              value={filters.yearTo ? String(filters.yearTo) : ''}
              onChangeText={(v) => setFilter('yearTo', v ? Number(v) : undefined)}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('filterBar.runtimeMin').toUpperCase()}</Text>
          <View style={styles.rangeRow}>
            <TextInput
              style={styles.rangeInput}
              placeholder={t('filterBar.from')}
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              value={filters.runtimeFrom ? String(filters.runtimeFrom) : ''}
              onChangeText={(v) => setFilter('runtimeFrom', v ? Number(v) : undefined)}
            />
            <Text style={styles.rangeDash}>–</Text>
            <TextInput
              style={styles.rangeInput}
              placeholder={t('filterBar.to')}
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              value={filters.runtimeTo ? String(filters.runtimeTo) : ''}
              onChangeText={(v) => setFilter('runtimeTo', v ? Number(v) : undefined)}
            />
          </View>
        </View>
      </View>

      <Text style={styles.label}>{t('filterBar.minRating').toUpperCase()}</Text>
      <View style={styles.chipRow}>
        <Pressable
          style={[styles.pill, filters.minRating === undefined && styles.chipActive]}
          onPress={() => setFilter('minRating', undefined)}
        >
          <Text style={[styles.chipText, filters.minRating === undefined && styles.chipTextActive]}>{t('filterBar.any').toUpperCase()}</Text>
        </Pressable>
        {RATING_TIERS.map((tier) => (
          <Pressable
            key={tier}
            style={[styles.pill, filters.minRating === tier && styles.chipActive]}
            onPress={() => setFilter('minRating', tier)}
          >
            <Text style={[styles.chipText, filters.minRating === tier && styles.chipTextActive]}>{tier}+</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={styles.checkboxRow}
        onPress={() => setFilter('excludeWatched', !filters.excludeWatched)}
      >
        <View style={[styles.checkbox, filters.excludeWatched && styles.checkboxChecked]}>
          {filters.excludeWatched ? <Ionicons name="checkmark" size={12} color={colors.textOnAccent} /> : null}
        </View>
        <Text style={styles.checkboxLabel}>{t('filterBar.hideWatched').toUpperCase()}</Text>
      </Pressable>

      <Pressable style={styles.applyButton} onPress={onApply}>
        <Text style={styles.applyButtonText}>{t('filterBar.applyFilters').toUpperCase()}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.2)',
    backgroundColor: 'rgba(20,17,13,.6)',
    gap: spacing.sm + 2,
  },
  label: {
    color: 'rgba(242,234,217,.5)',
    fontSize: 9.5,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  chipScroll: { marginHorizontal: -spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2, paddingHorizontal: spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.3)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  chipActive: { backgroundColor: colors.accentBright, borderColor: colors.accentBright },
  chipText: { color: 'rgba(242,234,217,.6)', fontSize: 11, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
  chipTextActive: { color: colors.backgroundDeep },
  row: { flexDirection: 'row', gap: spacing.md },
  field: { flex: 1, gap: spacing.xs + 2 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  rangeInput: {
    flex: 1,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundDeep,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.3)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    fontSize: 13,
  },
  rangeDash: { color: 'rgba(242,234,217,.3)' },
  pill: {
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.3)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.3)',
    backgroundColor: colors.backgroundDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.accentBright, borderColor: colors.accentBright },
  checkboxLabel: { color: 'rgba(242,234,217,.7)', fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
  applyButton: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accentBright,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  applyButtonText: { color: colors.backgroundDeep, fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1 },
});
