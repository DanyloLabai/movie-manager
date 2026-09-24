import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const GOLD = '#d9ac54';

// The soft ring around the user's current stop (web: animate-pulse-ring).
export function PulseRing({ size }: { size: number }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
        },
      ]}
    />
  );
}

interface JourneyPinProps {
  size: number;
  unlocked: boolean;
  children?: React.ReactNode;
}

// Round gold pin (unlocked) or dark pin (locked) — the gold pin approximates
// web's radial-gradient with a diagonal linear one.
export default function JourneyPin({ size, unlocked, children }: JourneyPinProps) {
  return (
    <View
      style={[
        styles.pin,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: unlocked ? GOLD : 'rgba(217,172,84,.3)',
        },
        unlocked ? styles.pinGlow : null,
      ]}
    >
      {unlocked ? (
        <LinearGradient
          colors={['#e8c377', '#a87c2e']}
          start={{ x: 0.35, y: 0.3 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.lockedFill, { borderRadius: size / 2 }]} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(217,172,84,.7)',
  },
  pin: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  pinGlow: {
    shadowColor: GOLD,
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  lockedFill: { backgroundColor: '#1c1a14' },
});
