import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import StarRating from "./StarRating";
import { colors, spacing, radius, fontWeight } from "../theme";

interface AddMovieModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  onAddToWatchlist: () => void;
  onMarkWatched: (rating: number | null) => void;
  initialStep?: "choose" | "rating";
}

export default function AddMovieModal({
  visible,
  title,
  onClose,
  onAddToWatchlist,
  onMarkWatched,
  initialStep = "choose",
}: AddMovieModalProps) {
  const { t } = useTranslation("movie");
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<"choose" | "rating">(initialStep);
  const [rating, setRating] = useState(0);

  useEffect(() => {
    if (visible) {
      setStep(initialStep);
      setRating(0);
    }
  }, [visible, initialStep]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel={t("common:cancel")}
      >
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}
          onPress={() => {}}
          accessibilityViewIsModal
        >
          <View style={styles.handle} />
          {step === "choose" ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title} numberOfLines={2}>
                  {t("addModal.title", { title })}
                </Text>
                <Text style={styles.subtitle}>{t("addModal.subtitle")}</Text>
              </View>
              <Pressable
                style={[styles.option, styles.optionPrimary]}
                onPress={onAddToWatchlist}
              >
                <View style={[styles.optionIcon, styles.optionIconFilled]}>
                  <Ionicons name="list" size={20} color={colors.textOnAccent} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>
                    {t("addModal.toWatchlist")}
                  </Text>
                  <Text style={styles.optionDesc}>
                    {t("addModal.watchlistDesc")}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                style={styles.option}
                onPress={() => setStep("rating")}
              >
                <View style={[styles.optionIcon, styles.optionIconOutline]}>
                  <Ionicons
                    name="eye-outline"
                    size={20}
                    color={colors.accentBright}
                  />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>
                    {t("addModal.watchedTitle")}
                  </Text>
                  <Text style={styles.optionDesc}>
                    {t("addModal.watchedDesc")}
                  </Text>
                </View>
              </Pressable>
              <Pressable style={styles.cancel} onPress={onClose}>
                <Text style={styles.cancelText}>{t("common:cancel")}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>{t("ratingModal.title")}</Text>
                <Text style={styles.subtitle} numberOfLines={2}>
                  {t("ratingModal.subtitle", { title })}
                </Text>
              </View>
              <View style={styles.stars}>
                <StarRating size="lg" value={rating} onRate={setRating} />
              </View>
              <View style={styles.actions}>
                <Pressable
                  style={[styles.secondary, styles.flex]}
                  onPress={onClose}
                >
                  <Text style={styles.secondaryText}>{t("common:cancel")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.primary, styles.flex]}
                  onPress={() => onMarkWatched(rating > 0 ? rating : null)}
                >
                  <Text style={styles.primaryText}>{t("common:ok")}</Text>
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const BUTTON_H = 50;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.62)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#17140f",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "rgba(217,172,84,.3)",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 4,
    gap: spacing.sm + 4,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(242,234,217,.2)",
  },
  header: { gap: 4, paddingTop: 4, paddingBottom: 6 },
  title: {
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: fontWeight.bold,
  },
  subtitle: { color: colors.textMuted, fontSize: 13 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.14)",
  },
  optionPrimary: {
    borderColor: "rgba(217,172,84,.5)",
    backgroundColor: "rgba(217,172,84,.1)",
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  optionIconFilled: { backgroundColor: colors.accent },
  optionIconOutline: { borderWidth: 1, borderColor: "rgba(217,172,84,.5)" },
  optionText: { flex: 1, gap: 2 },
  optionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: fontWeight.bold,
  },
  optionDesc: { color: "#a89d88", fontSize: 12.5 },
  cancel: { height: 48, alignItems: "center", justifyContent: "center" },
  cancelText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  stars: { alignItems: "center", paddingVertical: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
  primary: {
    height: BUTTON_H,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  primaryText: {
    color: colors.textOnAccent,
    fontSize: 14,
    fontWeight: fontWeight.bold,
  },
  secondary: {
    height: BUTTON_H,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  secondaryText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
});
