// Столбчатый график на View (без сторонних библиотек). star — отметить лучший день.
import { StyleSheet, View } from 'react-native';
import { C } from '../theme';
import { Icon } from './Icon';
import { Txt } from './ui';

export type BarSeries = { label: string; color: string };
export type BarGroup = { label: string; values: (number | null)[]; highlight?: boolean; star?: boolean };

export function BarChart({
  groups,
  series,
  max,
  height = 130,
  format = (v: number) => String(v),
}: {
  groups: BarGroup[];
  series: BarSeries[];
  max: number;
  height?: number;
  format?: (v: number) => string;
}) {
  const top = Math.max(max, 1);
  const dense = groups.length > 10;
  return (
    <View>
      <View style={styles.legend}>
        {series.map((s) => (
          <View key={s.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Txt size={13} muted>
              {s.label}
            </Txt>
          </View>
        ))}
      </View>
      <View style={[styles.plot, { height: height + 34 }]}>
        {groups.map((g, gi) => (
          <View key={`${g.label}-${gi}`} style={styles.group}>
            <View style={styles.starSlot}>{g.star ? <Icon name="star" size={13} color={C.warn} fill={C.warn} strokeWidth={1.4} /> : null}</View>
            <View style={[styles.bars, { height }]}>
              {g.values.map((v, si) => {
                const h = v == null ? 0 : Math.max(3, (Math.min(v, top) / top) * height);
                return (
                  <View key={si} style={styles.barCol}>
                    {v != null && !dense ? (
                      <Txt size={9} faint style={styles.value}>
                        {format(v)}
                      </Txt>
                    ) : null}
                    <View
                      style={[
                        styles.bar,
                        dense ? styles.barThin : null,
                        { height: h, backgroundColor: v == null ? 'transparent' : series[si]?.color ?? C.accent },
                        g.star && v != null ? styles.barStar : null,
                      ]}
                    />
                  </View>
                );
              })}
            </View>
            <Txt size={dense ? 9 : 12} weight={g.highlight ? 'heavy' : 'regular'} color={g.highlight ? C.text : C.faint} style={styles.xLabel}>
              {g.label}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: 14, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  plot: { flexDirection: 'row', alignItems: 'flex-end' },
  group: { flex: 1, alignItems: 'center' },
  starSlot: { height: 14, justifyContent: 'center' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barCol: { alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 10, borderRadius: 5 },
  barThin: { width: 4, borderRadius: 2 },
  barStar: { boxShadow: '0px 0px 8px rgba(255,194,102,0.7)' },
  value: { marginBottom: 2 },
  xLabel: { marginTop: 5 },
});
