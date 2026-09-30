// Календарь-тепловая карта: цвет клетки = настроение дня
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { monthGrid, parseDayKey, todayKey, WEEK_HEADER } from '../lib/dates';
import { C, F } from '../theme';

export function MonthHeatmap({
  year,
  month,
  colorFor,
  markFor,
  selected,
  onSelect,
}: {
  year: number;
  month: number;
  colorFor: (day: string) => string | null;
  markFor?: (day: string) => string | null;
  selected?: string | null;
  onSelect?: (day: string) => void;
}) {
  const weeks = monthGrid(year, month);
  const today = todayKey();
  return (
    <View style={styles.wrap}>
      <View style={styles.week}>
        {WEEK_HEADER.map((d) => (
          <Text key={d} style={styles.header}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={styles.cellEmpty} />;
            const color = colorFor(day);
            const mark = markFor?.(day);
            const future = day > today;
            return (
              <Pressable
                key={day}
                disabled={future}
                onPress={() => onSelect?.(day)}
                style={[
                  styles.cell,
                  { backgroundColor: color ?? 'rgba(255,255,255,0.06)', opacity: future ? 0.35 : 1 },
                  day === today && styles.today,
                  day === selected && styles.selected,
                ]}
              >
                <Text style={[styles.num, color ? styles.numOnColor : null]}>{parseDayKey(day).getDate()}</Text>
                {mark ? <Text style={styles.mark}>{mark}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 5 },
  week: { flexDirection: 'row', gap: 5 },
  header: { flex: 1, textAlign: 'center', color: C.faint, fontSize: 12, marginBottom: 2, fontFamily: F.bold },
  cellEmpty: { flex: 1, aspectRatio: 1 },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 2, borderColor: C.text },
  selected: { borderWidth: 2, borderColor: C.accent },
  num: { color: C.muted, fontSize: 12, fontFamily: F.bold },
  numOnColor: { color: '#FFFFFF' },
  mark: { fontSize: 10, marginTop: 1 },
});
