import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type GestureResponderEvent,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { JOURNEY_VIEWBOX, LOTR_STOPS } from "../../data/journeyLotr";
import { getCurrentStopIndex } from "../../utils/journey";
import JourneyMap, { LOTR_MAP_ASPECT } from "./JourneyMap";
import { GOLD } from "./JourneyPin";

const MAP_W = 1400;
const MAP_H = Math.round((MAP_W * JOURNEY_VIEWBOX.h) / JOURNEY_VIEWBOX.w);
const ART_H = MAP_W / LOTR_MAP_ASPECT;
const BUTTON_ZOOM_STEP = 1.5;

interface JourneyMapModalProps {
  visible: boolean;
  totalCount: number;
  onClose: () => void;
  youLabel?: string;
}

interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

type Touches = GestureResponderEvent["nativeEvent"]["touches"];

function distance(touches: Touches): number {
  const [a, b] = touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

function midpoint(touches: Touches): { x: number; y: number } {
  const [a, b] = touches;
  return { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 };
}

export default function JourneyMapModal({
  visible,
  totalCount,
  onClose,
  youLabel,
}: JourneyMapModalProps) {
  const { t } = useTranslation("profile");
  const insets = useSafeAreaInsets();
  const [openStopId, setOpenStopId] = useState<string | null>(null);
  const [zoomedIn, setZoomedIn] = useState(false);
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(
    null,
  );

  const scaleV = useRef(new Animated.Value(1)).current;
  const txV = useRef(new Animated.Value(0)).current;
  const tyV = useRef(new Animated.Value(0)).current;
  const current = useRef<Transform>({ scale: 1, tx: 0, ty: 0 });
  const viewportRef = useRef<View>(null);
  const viewportOrigin = useRef({ x: 0, y: 0 });
  const fitScale = useRef(1);
  const gesture = useRef<{
    mode: "pan" | "pinch";
    start: Transform;
    startDist: number;
    startMid: { x: number; y: number };
    startTouch: { x: number; y: number };
  } | null>(null);
  const zoomedInRef = useRef(false);

  const apply = useCallback(
    (next: Transform) => {
      if (!viewport) return;
      const { min, max } = {
        min: Math.min(fitScale.current, 0.4),
        max: Math.max(1.6, fitScale.current * 6),
      };
      const scale = Math.min(Math.max(next.scale, min), max);
      const half = { x: (scale * MAP_W) / 2, y: (scale * MAP_H) / 2 };
      const cx = Math.min(
        Math.max(MAP_W / 2 + next.tx, viewport.w * 0.25 - half.x),
        viewport.w * 0.75 + half.x,
      );
      const cy = Math.min(
        Math.max(MAP_H / 2 + next.ty, viewport.h * 0.25 - half.y),
        viewport.h * 0.75 + half.y,
      );
      const clamped = { scale, tx: cx - MAP_W / 2, ty: cy - MAP_H / 2 };
      current.current = clamped;
      scaleV.setValue(clamped.scale);
      txV.setValue(clamped.tx);
      tyV.setValue(clamped.ty);
      const isZoomed = clamped.scale > fitScale.current * 1.35;
      if (isZoomed !== zoomedInRef.current) {
        zoomedInRef.current = isZoomed;
        setZoomedIn(isZoomed);
      }
    },
    [viewport, scaleV, txV, tyV],
  );

  const zoomAbout = useCallback(
    (from: Transform, scale: number, fx: number, fy: number): Transform => {
      const ratio = scale / from.scale;
      const ox = fx - MAP_W / 2;
      const oy = fy - MAP_H / 2;
      return {
        scale,
        tx: ox - ratio * (ox - from.tx),
        ty: oy - ratio * (oy - from.ty),
      };
    },
    [],
  );

  const reset = useCallback(() => {
    if (!viewport) return;
    const fit = Math.min(viewport.w / MAP_W, viewport.h / MAP_H) * 0.92;
    fitScale.current = Math.min(Math.max(fit, 0.15), 1);
    const scale = Math.max(fitScale.current, Math.min(viewport.h / ART_H, 1));
    const stop =
      LOTR_STOPS[Math.max(0, getCurrentStopIndex(totalCount, LOTR_STOPS))];
    const stopX = (stop.x / JOURNEY_VIEWBOX.w) * MAP_W;
    const halfW = (scale * MAP_W) / 2;
    const centreX = Math.min(
      Math.max(
        viewport.w / 2 - scale * (stopX - MAP_W / 2),
        viewport.w - halfW,
      ),
      halfW,
    );
    zoomedInRef.current = false;
    setZoomedIn(false);
    apply({
      scale,
      tx:
        scale * MAP_W > viewport.w
          ? centreX - MAP_W / 2
          : viewport.w / 2 - MAP_W / 2,
      ty: viewport.h / 2 - MAP_H / 2,
    });
  }, [viewport, apply, totalCount]);

  useEffect(() => {
    if (visible && viewport) reset();
    if (!visible) setOpenStopId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, viewport]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          gesture.current = null;
        },
        onPanResponderMove: (e) => {
          const touches = e.nativeEvent.touches;
          if (touches.length >= 2) {
            if (gesture.current?.mode !== "pinch") {
              gesture.current = {
                mode: "pinch",
                start: { ...current.current },
                startDist: distance(touches),
                startMid: midpoint(touches),
                startTouch: { x: 0, y: 0 },
              };
              return;
            }
            const g = gesture.current;
            const mid = midpoint(touches);
            const scale = g.start.scale * (distance(touches) / g.startDist);
            const fx = g.startMid.x - viewportOrigin.current.x;
            const fy = g.startMid.y - viewportOrigin.current.y;
            const zoomed = zoomAbout(g.start, scale, fx, fy);
            apply({
              scale: zoomed.scale,
              tx: zoomed.tx + (mid.x - g.startMid.x),
              ty: zoomed.ty + (mid.y - g.startMid.y),
            });
          } else if (touches.length === 1) {
            const touch = { x: touches[0].pageX, y: touches[0].pageY };
            if (gesture.current?.mode !== "pan") {
              gesture.current = {
                mode: "pan",
                start: { ...current.current },
                startDist: 0,
                startMid: { x: 0, y: 0 },
                startTouch: touch,
              };
              return;
            }
            const g = gesture.current;
            apply({
              scale: g.start.scale,
              tx: g.start.tx + (touch.x - g.startTouch.x),
              ty: g.start.ty + (touch.y - g.startTouch.y),
            });
          }
        },
        onPanResponderRelease: () => {
          gesture.current = null;
        },
        onPanResponderTerminate: () => {
          gesture.current = null;
        },
      }),
    [apply, zoomAbout],
  );

  const onViewportLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport({ w: width, h: height });
    viewportRef.current?.measureInWindow((x, y) => {
      viewportOrigin.current = { x, y };
    });
  };

  const zoomByButton = (factor: number) => {
    if (!viewport) return;
    apply(
      zoomAbout(
        current.current,
        current.current.scale * factor,
        viewport.w / 2,
        viewport.h / 2,
      ),
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView
        style={styles.root}
        edges={["top", "bottom", "left", "right"]}
      >
        <View
          ref={viewportRef}
          style={styles.viewport}
          onLayout={onViewportLayout}
          {...panResponder.panHandlers}
        >
          <Animated.View
            style={[
              styles.content,
              {
                transform: [
                  { translateX: txV },
                  { translateY: tyV },
                  { scale: scaleV },
                ],
              },
            ]}
          >
            <JourneyMap
              totalCount={totalCount}
              width={MAP_W}
              openStopId={openStopId}
              zoomedIn={zoomedIn}
              youLabel={youLabel}
              onStopClick={(id) =>
                setOpenStopId((prev) => (prev === id ? null : id))
              }
            />
          </Animated.View>
        </View>

        <Pressable
          style={[
            styles.roundButton,
            styles.closeButton,
            { top: insets.top + 12 },
          ]}
          onPress={onClose}
          hitSlop={8}
        >
          <Ionicons name="close" size={20} color="#8f8574" />
        </Pressable>

        <View style={[styles.controls, { bottom: insets.bottom + 24 }]}>
          <Pressable
            style={styles.roundButton}
            onPress={() => zoomByButton(BUTTON_ZOOM_STEP)}
          >
            <Text style={styles.controlGlyph}>+</Text>
          </Pressable>
          <Pressable
            style={styles.roundButton}
            onPress={() => zoomByButton(1 / BUTTON_ZOOM_STEP)}
          >
            <Text style={styles.controlGlyph}>−</Text>
          </Pressable>
          <Pressable style={styles.roundButton} onPress={reset}>
            <Text style={styles.resetText}>
              {t("journey.zoomReset").toUpperCase()}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f0d0a" },
  viewport: { flex: 1, overflow: "hidden" },
  content: {
    position: "absolute",
    left: 0,
    top: 0,
    width: MAP_W,
    height: MAP_H,
  },
  roundButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20,17,12,.85)",
    borderWidth: 1,
    borderColor: "rgba(217,172,84,.3)",
  },
  closeButton: { position: "absolute", right: 14 },
  controls: { position: "absolute", right: 14, gap: 6 },
  controlGlyph: {
    color: GOLD,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 22,
  },
  resetText: { color: GOLD, fontSize: 8.5, fontWeight: "700" },
});
