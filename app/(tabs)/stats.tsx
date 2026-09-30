import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BarChart } from '../../src/components/BarChart';
import { MonthHeatmap } from '../../src/components/MonthHeatmap';
import { Card, Empty, ErrorBox, Loading, Row, Screen, Segmented, Txt } from '../../src/components/ui';
import { usePair, useTableVersion } from '../../src/context/PairProvider';
import { fetchRange } from '../../src/lib/api';
import {
  addDays,
  formatDayLong,
  formatDuration,
  monthTitle,
  rangeDays,
  startOfWeek,
  toDayKey,
  todayKey,
  weekdayShort,
  weekTitle,
} from '../../src/lib/dates';
import { getEmotion, scoreColor } from '../../src/lib/emotions';
import { useLoader } from '../../src/lib/hooks';
import { buildWeekReport, dayMoodScore, type PersonStats, type RangeData } from '../../src/lib/report';
import { formatScore } from '../../src/lib/score';
import { C, R, S } from '../../src/theme';
import type { Profile } from '../../src/types';

type Mode = 'week' | 'month';
type Who = 'me' | 'partner' | 'both';

export default function StatsScreen() {
  const { me, partner } = usePair();
  const today = todayKey();
  const [mode, setMode] = useState<Mode>('week');
  const [weekStart, setWeekStart] = useState(startOfWeek(today));
  const [month, setMonth] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [who, setWho] = useState<Who>('both');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const version = useTableVersion('mood_entries', 'sleep_entries', 'water_logs', 'gratitudes', 'day_scores', 'question_answers', 'wishes');

  const from = mode === 'week' ? weekStart : toDayKey(new Date(month.y, month.m, 1));
  const to = mode === 'week' ? addDays(weekStart, 6) : toDayKey(new Date(month.y, month.m + 1, 0));
  const { data, loading, refreshing, error, refresh, reload } = useLoader(() => fetchRange(from, to), [from, to, version]);

  if (!me) return <Loading />;

  const shiftMonth = (delta: number) => {
    const d = new Date(month.y, month.m + delta, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
    setSelectedDay(null);
  };
  const isCurrentWeek = weekStart >= startOfWeek(today);
  const isCurrentMonth = month.y === new Date().getFullYear() && month.m === new Date().getMonth();

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Segmented
        options={[
          { value: 'week', label: 'Неделя' },
          { value: 'month', label: 'Месяц' },
        ]}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setSelectedDay(null);
        }}
      />

      {mode === 'week' ? (
        <Nav
          title={weekTitle(weekStart)}
          onPrev={() => setWeekStart(addDays(weekStart, -7))}
          onNext={() => setWeekStart(addDays(weekStart, 7))}
          nextDisabled={isCurrentWeek}
        />
      ) : (
        <Nav
          title={monthTitle(month.y, month.m)}
          onPrev={() => shiftMonth(-1)}
          onNext={() => shiftMonth(1)}
          nextDisabled={isCurrentMonth}
        />
      )}

      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {loading && !data ? <Loading /> : null}

      {data && mode === 'week' ? <WeekView data={data} days={rangeDays(from, to)} me={me} partner={partner} today={today} /> : null}

      {data && mode === 'month' ? (
        <>
          {partner ? (
            <Segmented
              options={[
                { value: 'me', label: 'Я' },
                { value: 'partner', label: partner.display_name },
                { value: 'both', label: 'Вместе' },
              ]}
              value={who}
              onChange={setWho}
            />
          ) : null}
          <Card title="Настроение по дням">
            <MonthHeatmap
              year={month.y}
              month={month.m}
              selected={selectedDay}
              onSelect={setSelectedDay}
              colorFor={(d) => scoreColor(moodFor(data, d, who, me, partner))}
            />
            <Row style={styles.legend}>
              <Txt muted size={12}>
                хуже
              </Txt>
              {[1, 3, 5, 7, 9].map((v) => (
                <View key={v} style={[styles.legendCell, { backgroundColor: scoreColor(v) ?? C.card2 }]} />
              ))}
              <Txt muted size={12}>
                лучше
              </Txt>
            </Row>
          </Card>
          {selectedDay ? <DayDetails data={data} day={selectedDay} me={me} partner={partner} /> : null}
        </>
      ) : null}
    </Screen>
  );
}

function moodFor(data: RangeData, day: string, who: Who, me: Profile, partner: Profile | null): number | null {
  const mine = dayMoodScore(data, me.id, day);
  const theirs = partner ? dayMoodScore(data, partner.id, day) : null;
  if (who === 'me') return mine;
  if (who === 'partner') return theirs;
  const values = [mine, theirs].filter((v): v is number => v != null);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function Nav({ title, onPrev, onNext, nextDisabled }: { title: string; onPrev: () => void; onNext: () => void; nextDisabled: boolean }) {
  return (
    <Row style={styles.nav}>
      <Pressable onPress={onPrev} hitSlop={12} style={styles.navBtn}>
        <Text style={styles.navArrow}>‹</Text>
      </Pressable>
      <Txt bold size={17}>
        {title}
      </Txt>
      <Pressable onPress={onNext} hitSlop={12} disabled={nextDisabled} style={[styles.navBtn, nextDisabled && { opacity: 0.25 }]}>
        <Text style={styles.navArrow}>›</Text>
      </Pressable>
    </Row>
  );
}

function WeekView({
  data,
  days,
  me,
  partner,
  today,
}: {
  data: RangeData;
  days: string[];
  me: Profile;
  partner: Profile | null;
  today: string;
}) {
  const report = buildWeekReport(
    data,
    days,
    { id: me.id, name: me.display_name, waterGoal: me.water_goal },
    partner ? { id: partner.id, name: partner.display_name, waterGoal: partner.water_goal } : null,
  );
  const hasAny = report.me.filledDays > 0 || (report.partner?.filledDays ?? 0) > 0;

  const rows: { label: string; value: (s: PersonStats) => string }[] = [
    { label: 'Средний сон', value: (s) => formatDuration(s.avgSleepMin) },
    { label: 'Настроение, 0–10', value: (s) => formatScore(s.avgMood) },
    {
      label: 'Главная эмоция',
      value: (s) => (s.topEmotion ? `${getEmotion(s.topEmotion).emoji} ${getEmotion(s.topEmotion).label}` : '—'),
    },
    { label: 'Оценка дня (ср.)', value: (s) => formatScore(s.avgRating) },
    { label: 'Автобалл (ср.)', value: (s) => formatScore(s.avgAuto) },
    { label: 'Вода, стаканов', value: (s) => String(s.waterTotal) },
    { label: 'Благодарностей', value: (s) => String(s.gratitudes) },
    { label: 'Исполнил(а) желаний', value: (s) => String(s.wishesForOther) },
    { label: 'Дней с записями', value: (s) => `${s.filledDays} из ${days.length}` },
  ];

  return (
    <>
      <Card title="Как прошла наша неделя">
        {hasAny ? (
          report.summary.map((line, i) => (
            <Txt key={i} size={15}>
              • {line}
            </Txt>
          ))
        ) : (
          <Empty text="За эту неделю записей нет" />
        )}
      </Card>

      <Card title="Оценки дня">
        <BarChart
          max={10}
          format={(v) => formatScore(v)}
          series={[
            { label: 'Ты', color: C.me },
            ...(partner ? [{ label: partner.display_name, color: C.partner }] : []),
          ]}
          groups={report.points.map((p) => ({
            label: weekdayShort(p.day),
            highlight: p.day === today,
            values: partner ? [p.myRating ?? p.myAuto, p.partnerRating ?? p.partnerAuto] : [p.myRating ?? p.myAuto],
          }))}
        />
        <Txt muted size={12}>
          Если оценки нет, показан автобалл (сон, настроение, выполненные пункты).
        </Txt>
      </Card>

      <Card title="Сравнение">
        <Row style={styles.tableHead}>
          <Text style={[styles.cellLabel, styles.headText]}> </Text>
          <Text style={[styles.cell, styles.headText, { color: C.me }]}>Ты</Text>
          {partner ? (
            <Text style={[styles.cell, styles.headText, { color: C.partner }]} numberOfLines={1}>
              {partner.display_name}
            </Text>
          ) : null}
        </Row>
        {rows.map((r) => (
          <Row key={r.label} style={styles.tableRow}>
            <Text style={styles.cellLabel}>{r.label}</Text>
            <Text style={styles.cell}>{r.value(report.me)}</Text>
            {report.partner ? <Text style={styles.cell}>{r.value(report.partner)}</Text> : null}
          </Row>
        ))}
        {partner ? (
          <Txt muted size={14}>
            Вопросов дня отвечено вместе: {report.together}
          </Txt>
        ) : null}
      </Card>
    </>
  );
}

function DayDetails({ data, day, me, partner }: { data: RangeData; day: string; me: Profile; partner: Profile | null }) {
  const people = [me, ...(partner ? [partner] : [])];
  return (
    <Card title={formatDayLong(day)}>
      {people.map((p) => {
        const moods = data.moods.filter((m) => m.user_id === p.id && m.day === day);
        const sleep = data.sleeps.find((s) => s.user_id === p.id && s.day === day);
        const score = data.scores.find((s) => s.user_id === p.id && s.day === day);
        const isMe = p.id === me.id;
        return (
          <View key={p.id} style={styles.dayPerson}>
            <Txt bold color={isMe ? C.me : C.partner}>
              {isMe ? 'Ты' : p.display_name}
            </Txt>
            <Txt size={22}>{moods.length ? moods.map((m) => getEmotion(m.emotion).emoji).join(' ') : '—'}</Txt>
            <Txt muted size={14}>
              Сон: {formatDuration(sleep?.duration_min)} · Оценка: {score ? `${score.rating}/10` : '—'}
            </Txt>
            {score?.note ? (
              <Txt muted size={14}>
                «{score.note}»
              </Txt>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  nav: { justifyContent: 'space-between' },
  navBtn: { width: 44, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card, borderRadius: R.sm },
  navArrow: { color: C.text, fontSize: 26, lineHeight: 28 },
  legend: { justifyContent: 'center', gap: 6, marginTop: S.sm },
  legendCell: { width: 18, height: 12, borderRadius: 3 },
  tableHead: { borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6 },
  tableRow: { paddingVertical: 5 },
  headText: { fontWeight: '700' },
  cellLabel: { flex: 1.4, color: C.muted, fontSize: 14 },
  cell: { flex: 1, color: C.text, fontSize: 14, textAlign: 'right' },
  dayPerson: { gap: 2, paddingVertical: 4 },
});
