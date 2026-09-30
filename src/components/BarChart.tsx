// Простой столбчатый график на View (без сторонних библиотек)
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';

export type BarSeries = { label: string; color: string };
export type BarGroup = { label: string; values: (number | null)[]; highlight?: boolean };

export function BarChart({
  groups,
  series,
  max,
  height = 140,
  format = (v: number) => String(v),
}: {
  groups: BarGroup[];
  series: BarSeries[];
  max: number;
  height?: number;
  format?: (v: number) => string;
}) {
  const top = Math.max(max, 1);
  return (
    <View>
      <View style={styles.legend}>
        {series.map((s) => (
          <View key={s.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>{s.label}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.plot, { height: height + 18 }]}>
        {groups.map((g, gi) => (
          <View key={`${g.label}-${gi}`} style={styles.group}>
            <View style={[styles.bars, { height: height + 18 }]}>
              {g.values.map((v, si) => {
                const h = v == null ? 0 : Math.max(3, (Math.min(v, top) / top) * height);
                return (
                  <View key={si} style={styles.barCol}>
                    {v != null ? <Text style={styles.value}>{format(v)}</Text> : null}
                    <View
                      style={[
                        styles.bar,
                        { height: h, backgroundColor: v == null ? 'transparent' : series[si]?.color ?? C.accent },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
            <Text style={[styles.xLabel, g.highlight && styles.xLabelActive]}>{g.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: 14, marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: C.muted, fontSize: 13 },
  plot: { flexDirection: 'row', alignItems: 'flex-end' },
  group: { flex: 1, alignItems: 'center' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  barCol: { alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 11, borderRadius: 4 },
  value: { color: C.muted, fontSize: 9, marginBottom: 2 },
  xLabel: { color: C.faint, fontSize: 12, marginTop: 6 },
  xLabelActive: { color: C.text, fontWeight: '700' },
});
