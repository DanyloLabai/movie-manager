import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { JOURNEY_VIEWBOX, LOTR_STOPS } from "../../data/journeyLotr";
import {
  buildRoutePath,
  getCurrentStopIndex,
  isStopRevealed,
} from "../../utils/journey";
import JourneyPin, { GOLD, PulseRing } from "./JourneyPin";
import lotrMapImage from "../../../assets/journey/lotr-map.jpg";

export { lotrMapImage };

export const LOTR_MAP_ASPECT = 2528 / 1694;

interface JourneyMapProps {
  totalCount: number;
  width: number;
  openStopId?: string | null;
  onStopClick?: (id: string) => void;
  zoomedIn?: boolean;
  youLabel?: string;
}

export default function JourneyMap({
  totalCount,
  width,
  openStopId = null,
  onStopClick,
  zoomedIn = true,
  youLabel,
}: JourneyMapProps) {
  const { t } = useTranslation("profile");
  const height = (width * JOURNEY_VIEWBOX.h) / JOURNEY_VIEWBOX.w;
  const sx = width / JOURNEY_VIEWBOX.w;
  const sy = height / JOURNEY_VIEWBOX.h;

  const currentIndex = getCurrentStopIndex(totalCount, LOTR_STOPS);
  const routeD = buildRoutePath(LOTR_STOPS, sx, sy);

  return (
    <View style={{ width, height }}>
      <Image
        source={lotrMapImage}
        style={[styles.image, { width, height }]}
        resizeMode="contain"
      />

      <Svg
        width={width}
        height={height}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Path
          d={routeD}
          fill="none"
          stroke={GOLD}
          strokeWidth={3}
          strokeDasharray="7 6"
          opacity={0.8}
        />
      </Svg>

      {LOTR_STOPS.map((stop, i) => {
        const isUnlocked = totalCount >= stop.threshold;
        const revealed = isStopRevealed(i, currentIndex);
        const isCurrent = i === currentIndex;
        const remaining = Math.max(0, stop.threshold - totalCount);
        const size = stop.isFinale ? 40 : 26;
        const iconSize = stop.isFinale ? 19 : 13;
        const iconName =
          !revealed || !isUnlocked
            ? "lock-closed-outline"
            : stop.isFinale
              ? "business-outline"
              : "star";
        const iconColor = isUnlocked ? "#14110c" : "rgba(242,234,217,.4)";
        const name = revealed
          ? t(`journey.stops.${stop.id}`)
          : t("journey.lockedName");
        const progressText = isUnlocked
          ? stop.threshold === 1
            ? t("journey.unlockedAtOne")
            : t("journey.unlockedAt", { count: stop.threshold })
          : `${remaining} ${remaining === 1 ? t("journey.oneMovieToGo") : t("journey.moviesToGo")}`;
        const isOpen = openStopId === stop.id;
        const left = stop.x * sx;
        const top = stop.y * sy;
        const BOX_W = 120;

        return (
          <View
            key={stop.id}
            style={[
              styles.stopBox,
              { left: left - BOX_W / 2, top: top - size / 2, width: BOX_W },
              { zIndex: isOpen ? 50 : isCurrent ? 6 : 3 },
            ]}
          >
            <Pressable
              onPress={() => onStopClick?.(stop.id)}
              accessibilityLabel={name}
              hitSlop={8}
            >
              <View style={{ width: size, height: size }}>
                {isCurrent ? (
                  <View style={styles.ringWrap} pointerEvents="none">
                    <PulseRing size={size} />
                  </View>
                ) : null}
                <JourneyPin size={size} unlocked={isUnlocked}>
                  <Ionicons name={iconName} size={iconSize} color={iconColor} />
                </JourneyPin>
              </View>
              {isCurrent ? (
                <View style={styles.youBadge}>
                  <Text style={styles.youBadgeText}>
                    {(youLabel ?? t("journey.youAreHere")).toUpperCase()}
                  </Text>
                </View>
              ) : null}
            </Pressable>

            {zoomedIn || isCurrent ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.stopName,
                  { color: isUnlocked ? "#f2ead9" : "#8f8574" },
                ]}
              >
                {name}
              </Text>
            ) : null}

            {isOpen ? (
              <View
                style={[
                  styles.tooltip,
                  stop.y < 200 ? styles.tooltipBelow : styles.tooltipAbove,
                ]}
                pointerEvents="none"
              >
                <Text style={styles.tooltipName}>{name}</Text>
                <Text style={styles.tooltipProgress}>{progressText}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { position: "absolute", left: 0, top: 0 },
  stopBox: { position: "absolute", alignItems: "center" },
  ringWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  youBadge: {
    position: "absolute",
    bottom: -8,
    alignSelf: "center",
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  youBadgeText: {
    color: "#14110c",
    fontSize: 7.5,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  stopName: {
    marginTop: 8,
    maxWidth: 110,
    fontSize: 10.5,
    textAlign: "center",
    backgroundColor: "rgba(15,13,10,.7)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: "hidden",
  },
  tooltip: {
    position: "absolute",
    minWidth: 120,
    maxWidth: 170,
    alignSelf: "center",
    backgroundColor: "#1c1712",
    borderWidth: 1,
    borderColor: "rgba(217,172,84,.35)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  tooltipAbove: { bottom: "100%", marginBottom: 10 },
  tooltipBelow: { top: "100%", marginTop: 10 },
  tooltipName: {
    color: "#f2ead9",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  tooltipProgress: {
    color: "#8f8574",
    fontSize: 11,
    marginTop: 2,
    textAlign: "center",
  },
});
