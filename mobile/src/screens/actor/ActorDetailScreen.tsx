import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getActor, type ActorDetails } from '../../api/movies.api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import MoviePosterCard from '../../components/MoviePosterCard';
import { colors, spacing } from '../../theme';
import type { MainStackParamList } from '../../navigation/MainStack';

type Props = NativeStackScreenProps<MainStackParamList, 'ActorDetail'>;

export default function ActorDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation('movie');
  const { actorId } = route.params;
  const [actor, setActor] = useState<ActorDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getActor(actorId)
      .then((data) => {
        if (!cancelled) {
          setActor(data);
          navigation.setOptions({ title: data.name });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, t('errors.loadActor')));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (error || !actor) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? t('errors.actorNotFound')}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={actor.knownFor}
      key="actor-known-for"
      numColumns={3}
      keyExtractor={(item, index) => `${item.id}-${index}`}
      style={styles.container}
      contentContainerStyle={styles.listContent}
      columnWrapperStyle={styles.column}
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            {actor.profileUrl ? (
              <Image source={{ uri: actor.profileUrl }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]} />
            )}
            <Text style={styles.name}>{actor.name}</Text>
            <Text style={styles.meta}>
              {[actor.birthday, actor.placeOfBirth].filter(Boolean).join(' · ') || '—'}
            </Text>
            {actor.biography ? (
              <Text style={styles.bio} numberOfLines={8}>
                {actor.biography}
              </Text>
            ) : null}
            {actor.knownFor.length > 0 ? (
              <Text style={styles.sectionTitle}>{t('knownFor')}</Text>
            ) : null}
          </View>
        </>
      }
      renderItem={({ item }) => (
        <MoviePosterCard
          posterUrl={item.posterUrl}
          title={item.title}
          subtitle={item.character || item.releaseYear}
          onPress={() =>
            navigation.push('MovieDetail', {
              movieId: item.id,
              title: item.title,
              mediaType: item.mediaType === 'tv' ? 'tv' : 'movie',
            })
          }
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  column: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: spacing.md,
  },
  photoPlaceholder: {
    backgroundColor: colors.backgroundElevated,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  bio: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.md,
  },
  sectionTitle: {
    alignSelf: 'flex-start',
    color: colors.accentBright,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
});
