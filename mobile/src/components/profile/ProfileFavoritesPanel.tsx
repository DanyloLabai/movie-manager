import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { WatchlistItem } from "@movie-manager/shared";
import { colors, spacing, radius, fontWeight } from "../../theme";

interface ProfileFavoritesPanelProps {
  favorites: WatchlistItem[];
  onToggleFavorite: (tmdbId: number) => void;
  onPressMovie: (item: WatchlistItem) => void;
  onViewAllFavorites?: () => void;
  readOnly?: boolean;
}

const POSTER_WIDTH = 108;

export default function ProfileFavoritesPanel({
  favorites,
  onToggleFavorite,
  onPressMovie,
  onViewAllFavorites,
  readOnly = false,
}: ProfileFavoritesPanelProps) {
  const { t } = useTranslation("profile");

  return (
    <View>
      <View style={styles.titleRow}>
        <Text style={[styles.sectionTitle, styles.titleFlex]}>
          {t("favorites.topFavorites").toUpperCase()}
        </Text>
        {onViewAllFavorites && favorites.length > 0 ? (
          <Pressable onPress={onViewAllFavorites} hitSlop={8}>
            <Text style={styles.viewAllText}>{t("favorites.viewAll")}</Text>
          </Pressable>
        ) : null}
      </View>
      {favorites.length === 0 ? (
        <Text style={styles.emptyText}>{t("favorites.noFavorites")}</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.favoritesScroll}
        >
          <View style={styles.favoritesRow}>
            {favorites.map((fav) => {
              const year = fav.releaseDate ? fav.releaseDate.slice(0, 4) : null;
              return (
                <Pressable
                  key={fav.id}
                  style={styles.favoriteCard}
                  onPress={() => onPressMovie(fav)}
                >
                  <View style={styles.favoritePosterWrap}>
                    {fav.posterUrl ? (
                      <Image
                        source={{ uri: fav.posterUrl }}
                        style={styles.favoritePoster}
                      />
                    ) : (
                      <View
                        style={[
                          styles.favoritePoster,
                          styles.favoritePosterPlaceholder,
                        ]}
                      />
                    )}
                    {readOnly ? (
                      <View style={styles.heartBadge}>
                        <Ionicons
                          name={fav.isFavorite ? "heart" : "heart-outline"}
                          size={11}
                          color={
                            fav.isFavorite
                              ? colors.danger
                              : "rgba(242,234,217,.5)"
                          }
                        />
                      </View>
                    ) : (
                      <Pressable
                        style={styles.heartBadge}
                        onPress={() => onToggleFavorite(fav.tmdbId)}
                        hitSlop={6}
                      >
                        <Ionicons
                          name={fav.isFavorite ? "heart" : "heart-outline"}
                          size={11}
                          color={
                            fav.isFavorite
                              ? colors.danger
                              : "rgba(242,234,217,.5)"
                          }
                        />
                      </Pressable>
                    )}
                  </View>
                  <Text style={styles.favoriteTitle} numberOfLines={1}>
                    {fav.title}
                  </Text>
                  {year ? (
                    <Text style={styles.favoriteYear}>{year}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.accentBright,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: spacing.sm + 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  titleFlex: { flexShrink: 1 },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: "italic",
    paddingVertical: spacing.md,
  },
  favoritesScroll: { marginHorizontal: -spacing.lg },
  favoritesRow: {
    flexDirection: "row",
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  favoriteCard: { width: POSTER_WIDTH, gap: spacing.xs },
  favoritePosterWrap: {
    width: POSTER_WIDTH,
    height: POSTER_WIDTH * 1.48,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.backgroundElevated,
  },
  favoritePoster: { width: "100%", height: "100%" },
  favoritePosterPlaceholder: { backgroundColor: colors.backgroundElevated },
  heartBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.overlayScrim,
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
  },
  favoriteYear: { color: colors.textMuted, fontSize: 10.5 },
  viewAllText: {
    color: colors.accentBright,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    textDecorationLine: "underline",
  },
});
