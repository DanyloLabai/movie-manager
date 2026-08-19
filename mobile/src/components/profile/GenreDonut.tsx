import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors, fontWeight } from '../../theme';

interface GenreSlice {
  name: string;
  value: number;
}

interface GenreDonutProps {
  genreDistribution: GenreSlice[];
  size: number;
}

const CHART_COLORS = ['#d9ac54', '#a5822f', '#8a6a3c', '#5f4b28', '#3a2f1a'];
const STROKE_WIDTH = 14;
const GAP_DEGREES = 4;

// Ported from movie-frontend's ProfileChartsPanel.tsx GenreDonut, which uses
// recharts (DOM-only, no RN equivalent). react-native-svg has no built-in
// pie primitive, so this draws the ring as stacked `Circle` strokes using
// the standard strokeDasharray/strokeDashoffset technique, rotated -90° so
// the first slice starts at 12 o'clock like recharts does.
export default function GenreDonut({ genreDistribution, size }: GenreDonutProps) {
  const total = genreDistribution.reduce((sum, g) => sum + g.value, 0);
  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const gapLength = (GAP_DEGREES / 360) * circumference;

  let cumulative = 0;

  return (
    <View style={styles.row}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
            {genreDistribution.map((g, index) => {
              const sliceLength = total > 0 ? (g.value / total) * circumference : 0;
              const dashLength = Math.max(0, sliceLength - gapLength);
              const offset = -cumulative;
              cumulative += sliceLength;
              return (
                <Circle
                  key={g.name}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={STROKE_WIDTH}
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={offset}
                  fill="none"
                />
              );
            })}
          </G>
        </Svg>
        <View style={styles.centerLabel} pointerEvents="none">
          <Text style={styles.centerLabelText}>{genreDistribution.length}</Text>
        </View>
      </View>

      <View style={styles.legend}>
        {genreDistribution.length === 0 ? (
          <Text style={styles.emptyText}>N/A</Text>
        ) : (
          genreDistribution.map((g, index) => (
            <View key={g.name} style={styles.legendRow}>
              <View style={[styles.swatch, { backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }]} />
              <Text style={styles.legendName} numberOfLines={1}>
                {g.name}
              </Text>
              <Text style={styles.legendPercent}>
                · {total > 0 ? Math.round((g.value / total) * 100) : 0}%
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  centerLabel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabelText: { color: colors.textPrimary, fontSize: 20, fontWeight: fontWeight.bold },
  legend: { flex: 1, minWidth: 0, gap: 6 },
  emptyText: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  legendName: { flexShrink: 1, color: colors.textSubtle, fontSize: 12 },
  legendPercent: { color: colors.textMuted, fontSize: 12 },
});
