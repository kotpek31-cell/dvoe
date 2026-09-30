// «Итоги»: компактно — средний сон, настроение 0–10, главная эмоция, лучшие дни, желания
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { BarChart } from '../../src/components/BarChart';
import { Face } from '../../src/components/Face';
import { MonthHeatmap } from '../../src/components/MonthHeatmap';
import { Card, ErrorBox, Row, Screen, Segmented, Txt } from '../../src/components/ui';
import { usePair, useTableVersion } from '../../src/context/PairProvider';
import { fetchRange, fetchWishes } from '../../src/lib/api';
import {
  formatDayLong,
  formatDuration,
  monthTitle,
  parseDayKey,
  rangeDays,
  startOfWeek,
  toDayKey,
  todayKey,
  weekdayShort,
  weekTitle,
} from '../../src/lib/dates';
import { getEmotion, scoreColor } from '../../src/lib/emotions';
import { useLoader } from '../../src/lib/hooks';
import { avgMood, avgSleepMin, bestDays, dayMoodScore, dayPoints, periodEmotion, wishStats, type RangeData } from '../../src/lib/report';
import { formatScore } from '../../src/lib/score';
import { C, R, S } from '../../src/theme';
import type { Profile } from '../../src/types';

type Mode = 'week' | 'month';

export default function StatsScreen() {
  const { me, partner } = usePair();
  const today = todayKey();
  const [mode, setMode] = useState<Mode>('week');
  const weekStart = startOfWeek(today);
  const now = parseDayKey(today);
  const monthStart = toDayKey(new Date(now.getFullYear(), now.getMonth(), 1));
  const from = weekStart < monthStart ? weekStart : monthStart;
  const version = useTableVersion('mood_entries', 'sleep_entries', 'gratitudes', 'day_scores', 'question_answers', 'wishes');
  const { data, refreshing, error, refresh, reload } = useLoader(async () => {
    const [range, wishes] = await Promise.all([fetchRange(from, today), fetchWishes()]);
    return { range, wishes };
  }, [from, today, version]);

  if (!me) return null;

  const weekDays = rangeDays(weekStart, today);
  const monthDays = rangeDays(monthStart, today);
  const days = mode === 'week' ? weekDays : monthDays;
  const subtitle = mode === 'week' ? `неделя: ${weekTitle(weekStart)}` : monthTitle(now.getFullYear(), now.getMonth()).toLowerCase();
  const people = [me, ...(partner ? [partner] : [])];

  return (
    <Screen tabs title="Итоги" subtitle={subtitle} refreshing={refreshing} onRefresh={refresh}>
      <Segmented
        options={[
          { value: 'week', label: 'Неделя' },
          { value: 'month', label: 'Месяц' },
        ]}
        value={mode}
        onChange={setMode}
      />
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <View style={styles.bento}>
            <Tile title="Настроение" hint="среднее, 0–10">
              {people.map((p) => {
                const v = avgMood(data.range, p.id, days);
                return (
                  <Row key={p.id} style={styles.between}>
                    <Txt weight="bold" size={13} color={p.id === me.id ? C.me : C.partner} numberOfLines={1} style={styles.flex}>
                      {p.id === me.id ? 'Ты' : p.display_name}
                    </Txt>
                    <Txt weight="display" size={24} color={v != null ? scoreColor(v) ?? C.text : C.faint}>
                      {formatScore(v)}
                    </Txt>
                  </Row>
                );
              })}
            </Tile>
            <Tile title="Сон" hint="в среднем за ночь">
              {people.map((p) => (
                <Row key={p.id} style={styles.between}>
                  <Txt weight="bold" size={13} color={p.id === me.id ? C.me : C.partner} numberOfLines={1} style={styles.flex}>
                    {p.id === me.id ? 'Ты' : p.display_name}
                  </Txt>
                  <Txt weight="displaySemi" size={17} color={C.sleep}>
                    {formatDuration(avgSleepMin(data.range, p.id, days))}
                  </Txt>
                </Row>
              ))}
            </Tile>
          </View>

          <EmotionsTile data={data.range} people={people} me={me} today={today} weekDays={weekDays} monthDays={monthDays} />

          <BestDays data={data.range} days={days} me={me} partner={partner} mode={mode} today={today} />

          <WishesTile wishes={data.wishes} me={me} partner={partner} />

          {mode === 'month' ? (
            <Card title="Настроение по дням">
              <MonthHeatmap
                year={now.getFullYear()}
                month={now.getMonth()}
                colorFor={(d) => {
                  const values = people.map((p) => dayMoodScore(data.range, p.id, d)).filter((v): v is number => v != null);
                  return scoreColor(values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
                }}
              />
              <Row style={styles.legend}>
                <Txt faint size={12}>
                  хуже
                </Txt>
                {[1, 3, 5, 7, 9].map((v) => (
                  <View key={v} style={[styles.legendCell, { backgroundColor: scoreColor(v) ?? C.card2 }]} />
                ))}
                <Txt faint size={12}>
                  лучше
                </Txt>
              </Row>
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function Tile({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card style={styles.tile}>
      <View>
        <Txt weight="displaySemi" size={15}>
          {title}
        </Txt>
        {hint ? (
          <Txt faint size={12}>
            {hint}
          </Txt>
        ) : null}
      </View>
      {children}
    </Card>
  );
}

function EmotionsTile({
  data,
  people,
  me,
  today,
  weekDays,
  monthDays,
}: {
  data: RangeData;
  people: Profile[];
  me: Profile;
  today: string;
  weekDays: string[];
  monthDays: string[];
}) {
  const cols: { label: string; days: string[] }[] = [
    { label: 'Сегодня', days: [today] },
    { label: 'Неделя', days: weekDays },
    { label: 'Месяц', days: monthDays },
  ];
  return (
    <Card title="Главная эмоция">
      <Row style={styles.emoHead}>
        <View style={styles.emoName} />
        {cols.map((c) => (
          <Txt key={c.label} faint size={12} weight="bold" center style={styles.emoCol}>
            {c.label}
          </Txt>
        ))}
      </Row>
      {people.map((p) => (
        <Row key={p.id} style={styles.emoRow}>
          <Txt weight="heavy" size={13} color={p.id === me.id ? C.me : C.partner} numberOfLines={1} style={styles.emoName}>
            {p.id === me.id ? 'Ты' : p.display_name}
          </Txt>
          {cols.map((c) => {
            const top = periodEmotion(data, p.id, c.days);
            return (
              <View key={c.label} style={[styles.emoCol, styles.emoCell]}>
                <Face emotion={top?.key ?? 'calm'} value={top?.strength ?? 0} size={34} />
                <Txt size={11} weight="bold" muted={!top} faint={!top} center numberOfLines={1}>
                  {top ? getEmotion(top.key).label : '—'}
                </Txt>
              </View>
            );
          })}
        </Row>
      ))}
    </Card>
  );
}

function BestDays({
  data,
  days,
  me,
  partner,
  mode,
  today,
}: {
  data: RangeData;
  days: string[];
  me: Profile;
  partner: Profile | null;
  mode: Mode;
  today: string;
}) {
  const points = dayPoints(data, days, me.id, partner?.id ?? null);
  const best = bestDays(points, mode === 'week' ? 2 : 3);
  const top = best[0] ? points.find((p) => p.day === best[0]) : null;
  return (
    <Card title="Лучшие дни">
      {top ? (
        <Txt size={14} muted>
          Лучший — {formatDayLong(top.day)}: {formatScore(top.avg)}
        </Txt>
      ) : (
        <Txt size={14} faint>
          Появятся, когда будут оценки дня или отметки
        </Txt>
      )}
      <BarChart
        max={10}
        height={mode === 'week' ? 120 : 100}
        format={(v) => formatScore(v)}
        series={[{ label: 'Ты', color: C.me }, ...(partner ? [{ label: partner.display_name, color: C.partner }] : [])]}
        groups={points.map((p, i) => ({
          label: mode === 'week' ? weekdayShort(p.day) : i % 5 === 0 || p.day === today ? String(parseDayKey(p.day).getDate()) : '',
          highlight: p.day === today,
          star: best.includes(p.day),
          values: partner ? [p.me, p.partner] : [p.me],
        }))}
      />
      <Txt faint size={12}>
        Оценка дня, а если её нет — автобалл (сон, настроение, дела дня).
      </Txt>
    </Card>
  );
}

function WishesTile({ wishes, me, partner }: { wishes: Parameters<typeof wishStats>[0]; me: Profile; partner: Profile | null }) {
  const st = wishStats(wishes, me.id);
  const share = st.total ? st.done / st.total : 0;
  return (
    <Card title="Желания">
      <Row style={styles.between}>
        <Txt>
          <Txt weight="display" size={28} color={C.accent}>
            {st.done}
          </Txt>
          <Txt weight="bold" size={15} muted>
            {'  '}из {st.total} исполнено
          </Txt>
        </Txt>
      </Row>
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${Math.round(share * 100)}%` }]} />
      </View>
      {partner ? (
        <Txt muted size={13}>
          Ты исполнил(а) {st.byMe}, {partner.display_name} — {st.byPartner}
        </Txt>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  between: { justifyContent: 'space-between' },
  bento: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, gap: 10 },
  emoHead: { gap: 4 },
  emoRow: { gap: 4, paddingVertical: 4 },
  emoName: { width: 72 },
  emoCol: { flex: 1 },
  emoCell: { alignItems: 'center', gap: 2 },
  legend: { justifyContent: 'center', gap: 6, marginTop: S.sm },
  legendCell: { width: 18, height: 12, borderRadius: 3 },
  progress: { height: 10, borderRadius: R.pill, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill: { height: 10, borderRadius: R.pill, backgroundColor: C.accent },
});
