import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { JOURNEY_VIEWBOX, LOTR_STOPS } from '../../data/journeyLotr';
import { buildRoutePath, getCurrentStopIndex } from '../../utils/journey';
import JourneyPin, { GOLD, PulseRing } from './JourneyPin';
import { lotrMapImage } from './JourneyMap';

interface JourneyMapGlimpseProps {
  totalCount: number;
  onExpand: () => void;
  youLabel?: string;
}

const ZOOM = 1.9;
const GLIMPSE_HEIGHT = 190;

// Ported from movie-frontend's JourneyMapGlimpse.tsx: a small window onto the
// map, zoomed and centred on the user's current stop. Tapping it opens the
// full, pannable map.
export default function JourneyMapGlimpse({ totalCount, onExpand, youLabel }: JourneyMapGlimpseProps) {
  const { t } = useTranslation('profile');
  const [containerWidth, setContainerWidth] = useState(0);

  const currentIndex = Math.max(0, getCurrentStopIndex(totalCount, LOTR_STOPS));
  const current = LOTR_STOPS[currentIndex];

  // Content is the whole map scaled up by ZOOM; shift it so the current stop
  // sits at the window centre, clamped so we never pan past the artwork.
  const contentW = containerWidth * ZOOM;
  const contentH = (contentW * JOURNEY_VIEWBOX.h) / JOURNEY_VIEWBOX.w;
  const panMinPct = 50 / ZOOM;
  const clampPan = (pct: number) => Math.min(Math.max(pct, panMinPct), 100 - panMinPct);
  const fx = clampPan((current.x / JOURNEY_VIEWBOX.w) * 100);
  const fy = clampPan((current.y / JOURNEY_VIEWBOX.h) * 100);
  const offsetLeft = containerWidth / 2 - (fx / 100) * contentW;
  const offsetTop = GLIMPSE_HEIGHT / 2 - (fy / 100) * contentH;

  const routeD = useMemo(
    () => buildRoutePath(LOTR_STOPS, contentW / JOURNEY_VIEWBOX.w, contentH / JOURNEY_VIEWBOX.h),
    [contentW, contentH],
  );

  const onLayout = (e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width);

  return (
    <Pressable
      onPress={onExpand}
      onLayout={onLayout}
      style={styles.container}
      accessibilityLabel={t('journey.expandHint')}
    >
      {containerWidth > 0 ? (
        <View style={{ position: 'absolute', left: offsetLeft, top: offsetTop, width: contentW, height: contentH }}>
          <Image source={lotrMapImage} style={StyleSheet.absoluteFill} resizeMode="cover" />

          <Svg width={contentW} height={contentH} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Path d={routeD} fill="none" stroke={GOLD} strokeWidth={3} strokeDasharray="8 7" opacity={0.8} />
          </Svg>

          {LOTR_STOPS.map((stop, i) => {
            const isUnlocked = totalCount >= stop.threshold;
            const isCurrent = i === currentIndex;
            const showLabel = Math.abs(i - currentIndex) <= 1;
            const size = stop.isFinale ? 26 : isCurrent ? 22 : 16;
            const left = (stop.x / JOURNEY_VIEWBOX.w) * contentW;
            const top = (stop.y / JOURNEY_VIEWBOX.h) * contentH;
            const labelAbovePin = !isCurrent && stop.y > current.y;
            const BOX_W = 130;

            return (
              <View
                key={stop.id}
                pointerEvents="none"
                style={[
                  styles.stopBox,
                  { left: left - BOX_W / 2, top: top - size / 2, width: BOX_W, zIndex: isCurrent ? 6 : 3 },
                ]}
              >
                <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                  {isCurrent ? (
                    <View style={styles.glow}>
                      <PulseRing size={size + 12} />
                    </View>
                  ) : null}
                  <JourneyPin size={size} unlocked={isUnlocked} />
                </View>
                {isCurrent ? (
                  <View style={styles.youBadge}>
                    <Text style={styles.youBadgeText}>{(youLabel ?? t('journey.youAreHere')).toUpperCase()}</Text>
                  </View>
                ) : null}
                {!isCurrent && showLabel ? (
                  <Text
                    numberOfLines={1}
                    style={[styles.label, labelAbovePin ? styles.labelAbove : styles.labelBelow]}
                  >
                    {t(`journey.stops.${stop.id}`)}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(16,13,8,.85)']}
        start={{ x: 0.5, y: 0.35 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.expandChip} pointerEvents="none">
        <Text style={styles.expandChipText}>⤢ {t('journey.expandHint')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: GLIMPSE_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.18)',
    backgroundColor: '#100d08',
  },
  stopBox: { position: 'absolute', alignItems: 'center' },
  glow: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  youBadge: {
    marginTop: 4,
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  youBadgeText: { color: '#14110c', fontSize: 8, fontWeight: '700', letterSpacing: 0.4 },
  label: {
    position: 'absolute',
    maxWidth: 124,
    color: '#f2ead9',
    fontSize: 10,
    fontWeight: '500',
    backgroundColor: 'rgba(15,13,10,.75)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  labelAbove: { bottom: '100%', marginBottom: 4 },
  labelBelow: { top: '100%', marginTop: 4 },
  expandChip: {
    position: 'absolute',
    right: 12,
    bottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(217,172,84,.3)',
    backgroundColor: 'rgba(10,8,5,.6)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  expandChipText: { color: GOLD, fontSize: 10.5, letterSpacing: 0.4 },
});
