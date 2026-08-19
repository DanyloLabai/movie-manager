import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MovieResult } from '@movie-manager/shared';
import { getTop100 } from '../../api/movies.api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import MoviePosterCard from '../../components/MoviePosterCard';
import { colors, spacing } from '../../theme';
import type { MainStackParamList } from '../../navigation/MainStack';

type Props = NativeStackScreenProps<MainStackParamList, 'Top100'>;

export default function Top100Screen({ route, navigation }: Props) {
  const [type, setType] = useState(route.params.type);
  const [items, setItems] = useState<MovieResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getTop100(type)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load Top 100.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {(['movie', 'tv'] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.filterPill, type === t && styles.filterPillActive]}
            onPress={() => setType(t)}
          >
            <Text style={[styles.filterText, type === t && styles.filterTextActive]}>
              {t === 'movie' ? 'Movies' : 'TV Shows'}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          key="top100-grid"
          numColumns={3}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.column}
          renderItem={({ item, index }) => (
            <MoviePosterCard
              posterUrl={item.posterUrl}
              title={item.title}
              subtitle={`#${index + 1} · ★ ${item.rating.toFixed(1)}`}
              onPress={() =>
                navigation.navigate('MovieDetail', {
                  movieId: item.id,
                  title: item.title,
                  mediaType: item.mediaType,
                })
              }
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  filterTextActive: {
    color: colors.textOnAccent,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  grid: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  column: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
});
