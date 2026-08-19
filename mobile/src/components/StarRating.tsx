import { StyleSheet, View, Pressable, Text, type GestureResponderEvent } from 'react-native';
import { colors } from '../theme';

const STAR_COUNT = 10;

interface StarRatingProps {
  value: number;
  onRate: (rating: number) => void;
  size?: 'sm' | 'lg';
  disabled?: boolean;
}

const FONT_SIZE = { sm: 15, lg: 24 } as const;

// RN has no hover state, so half-star precision comes from which half of the
// star glyph was tapped (locationX vs the glyph's own width), mirroring the
// pointer-position trick movie-frontend's StarRating.tsx uses with the mouse.
function resolveValueFromTap(e: GestureResponderEvent, star: number, starWidth: number): number {
  const isLeftHalf = e.nativeEvent.locationX < starWidth / 2;
  return isLeftHalf ? star - 0.5 : star;
}

export default function StarRating({ value, onRate, size = 'lg', disabled = false }: StarRatingProps) {
  const fontSize = FONT_SIZE[size];
  const starWidth = fontSize * 1.15;

  return (
    <View style={styles.row}>
      {Array.from({ length: STAR_COUNT }, (_, i) => i + 1).map((star) => {
        const fillRatio = Math.min(1, Math.max(0, value - (star - 1)));
        const fillPercent = fillRatio >= 1 ? 100 : fillRatio >= 0.5 ? 50 : 0;
        return (
          <Pressable
            key={star}
            disabled={disabled}
            onPress={(e) => onRate(resolveValueFromTap(e, star, starWidth))}
            style={[styles.starWrap, { width: starWidth }]}
            hitSlop={2}
          >
            <Text style={[styles.star, { fontSize }]}>★</Text>
            {fillPercent > 0 ? (
              <View style={[styles.fillClip, { width: fillPercent === 100 ? starWidth : starWidth / 2 }]}>
                <Text style={[styles.star, styles.starFilled, { fontSize }]}>★</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fillClip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  star: {
    color: colors.backgroundElevated,
    lineHeight: undefined,
  },
  starFilled: {
    color: colors.accentBright,
  },
});
