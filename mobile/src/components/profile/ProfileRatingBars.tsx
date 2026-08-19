import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme';

interface RatingBucket {
  name: string;
  value: number;
}

interface ProfileRatingBarsProps {
  data: RatingBucket[];
  maxHeightPx: number;
}

// Ported 1:1 from movie-frontend's ProfileRatingBars.tsx flex-column logic.
export default function ProfileRatingBars({ data, maxHeightPx }: ProfileRatingBarsProps) {
  const maxValue = Math.max(1, ...data.map((d) => d.value));

  return (
    <View style={[styles.row, { height: maxHeightPx }]}>
      {data.map((bucket) => {
        const heightPx = bucket.value ? Math.max(2, (bucket.value / maxValue) * maxHeightPx) : 0;
        return (
          <View key={bucket.name} style={[styles.column, { height: maxHeightPx }]}>
            {bucket.value > 0 ? <Text style={styles.value}>{bucket.value}</Text> : null}
            <LinearGradient
              colors={['#d9ac54', '#a87c2e']}
              style={[styles.bar, { height: heightPx }]}
            />
            <Text style={styles.label}>{bucket.name}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  value: { color: colors.textMuted, fontSize: 9 },
  bar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 0 },
  label: { color: colors.textFaint, fontSize: 8 },
});
