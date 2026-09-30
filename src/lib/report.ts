import type { AnswerMark, DayScore, Gratitude, MoodEntry, SleepEntry, WaterLog, Wish } from '../types';
import { formatDayLong, formatDuration, plural } from './dates';
import { getEmotion } from './emotions';
import { computeAutoScore, formatScore, moodScore, round1 } from './score';

// Все записи пары за период (приходят одним запросом из api.fetchRange)
export type RangeData = {
  moods: MoodEntry[];
  sleeps: SleepEntry[];
  water: WaterLog[];
  gratitudes: Gratitude[];
  scores: DayScore[];
  answers: AnswerMark[];
  wishesDone: Wish[];
};

export type Person = { id: string; name: string; waterGoal: number };

export type PersonStats = {
  avgSleepMin: number | null;
  avgMood: number | null;
  topEmotion: string | null;
  moodCount: number;
  avgRating: number | null;
  avgAuto: number | null;
  waterTotal: number;
  gratitudes: number;
  wishesForOther: number;
  filledDays: number;
};

export type DayPoint = {
  day: string;
  myRating: number | null;
  partnerRating: number | null;
  myAuto: number | null;
  partnerAuto: number | null;
};

export type WeekReport = {
  days: string[];
  me: PersonStats;
  partner: PersonStats | null;
  together: number;
  bestDay: { day: string; avg: number } | null;
  points: DayPoint[];
  summary: string[];
};

const avg = (values: number[]): number | null =>
  values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null;

// Автобалл конкретного человека за конкретный день (null, если записей нет)
export function dayAutoScore(data: RangeData, person: Person, day: string): number | null {
  const moods = data.moods.filter((m) => m.user_id === person.id && m.day === day);
  const sleep = data.sleeps.find((s) => s.user_id === person.id && s.day === day);
  const water = data.water.find((w) => w.user_id === person.id && w.day === day)?.glasses ?? 0;
  const gratitudes = data.gratitudes.filter((g) => g.user_id === person.id && g.day === day).length;
  const answered = data.answers.some((a) => a.user_id === person.id && a.day === day);
  if (!moods.length && !sleep && !water && !gratitudes && !answered) return null;
  return computeAutoScore({
    sleepMin: sleep?.duration_min ?? null,
    moods,
    water,
    waterGoal: person.waterGoal,
    gratitudes,
    answered,
  }).total;
}

export function dayMoodScore(data: RangeData, userId: string, day: string): number | null {
  return moodScore(data.moods.filter((m) => m.user_id === userId && m.day === day));
}

function topEmotion(moods: MoodEntry[]): string | null {
  const weight = new Map<string, number>();
  for (const m of moods) weight.set(m.emotion, (weight.get(m.emotion) ?? 0) + m.intensity);
  let best: string | null = null;
  let bestWeight = -1;
  weight.forEach((w, key) => {
    if (w > bestWeight) {
      best = key;
      bestWeight = w;
    }
  });
  return best;
}

function personStats(data: RangeData, person: Person, days: string[]): PersonStats {
  const inRange = (day: string) => days.includes(day);
  const moods = data.moods.filter((m) => m.user_id === person.id && inRange(m.day));
  const sleeps = data.sleeps.filter((s) => s.user_id === person.id && inRange(s.day));
  const ratings = data.scores.filter((s) => s.user_id === person.id && inRange(s.day)).map((s) => s.rating);
  const autos = days.map((d) => dayAutoScore(data, person, d)).filter((v): v is number => v != null);
  const moodByDay = days.map((d) => dayMoodScore(data, person.id, d)).filter((v): v is number => v != null);
  const filled = days.filter(
    (d) =>
      dayAutoScore(data, person, d) != null || data.scores.some((s) => s.user_id === person.id && s.day === d),
  ).length;

  const sleepAvg = avg(sleeps.map((s) => s.duration_min));
  return {
    avgSleepMin: sleepAvg == null ? null : Math.round(sleepAvg),
    avgMood: avg(moodByDay),
    topEmotion: topEmotion(moods),
    moodCount: moods.length,
    avgRating: avg(ratings),
    avgAuto: avg(autos),
    waterTotal: data.water
      .filter((w) => w.user_id === person.id && inRange(w.day))
      .reduce((acc, w) => acc + w.glasses, 0),
    gratitudes: data.gratitudes.filter((g) => g.user_id === person.id && inRange(g.day)).length,
    wishesForOther: data.wishesDone.filter((w) => w.done_by === person.id && w.user_id !== person.id).length,
    filledDays: filled,
  };
}

export function buildWeekReport(data: RangeData, days: string[], me: Person, partner: Person | null): WeekReport {
  const meStats = personStats(data, me, days);
  const partnerStats = partner ? personStats(data, partner, days) : null;

  const points: DayPoint[] = days.map((day) => ({
    day,
    myRating: data.scores.find((s) => s.user_id === me.id && s.day === day)?.rating ?? null,
    partnerRating: partner ? data.scores.find((s) => s.user_id === partner.id && s.day === day)?.rating ?? null : null,
    myAuto: dayAutoScore(data, me, day),
    partnerAuto: partner ? dayAutoScore(data, partner, day) : null,
  }));

  let bestDay: WeekReport['bestDay'] = null;
  for (const p of points) {
    const values = [p.myRating, p.partnerRating].filter((v): v is number => v != null);
    if (!values.length) continue;
    const dayAvg = values.reduce((a, b) => a + b, 0) / values.length;
    if (!bestDay || dayAvg > bestDay.avg) bestDay = { day: p.day, avg: round1(dayAvg) };
  }

  const together = partner
    ? days.filter(
        (d) =>
          data.answers.some((a) => a.user_id === me.id && a.day === d) &&
          data.answers.some((a) => a.user_id === partner.id && a.day === d),
      ).length
    : 0;

  const summary: string[] = [];
  if (bestDay) {
    summary.push(`Лучший день недели — ${formatDayLong(bestDay.day)}: средняя оценка ${formatScore(bestDay.avg)}.`);
  }
  const myTop = meStats.topEmotion ? getEmotion(meStats.topEmotion) : null;
  const partnerTop = partnerStats?.topEmotion ? getEmotion(partnerStats.topEmotion) : null;
  if (myTop && partnerTop && myTop.key === partnerTop.key) {
    summary.push(`Чаще всего вы оба чувствовали: ${myTop.label.toLowerCase()} ${myTop.emoji}.`);
  } else {
    if (myTop) summary.push(`Твоя главная эмоция недели — ${myTop.label.toLowerCase()} ${myTop.emoji}.`);
    if (partnerTop && partner) summary.push(`У ${partner.name} — ${partnerTop.label.toLowerCase()} ${partnerTop.emoji}.`);
  }
  if (meStats.avgSleepMin != null || partnerStats?.avgSleepMin != null) {
    const parts = [`ты — ${formatDuration(meStats.avgSleepMin)}`];
    if (partner && partnerStats) parts.push(`${partner.name} — ${formatDuration(partnerStats.avgSleepMin)}`);
    summary.push(`Средний сон: ${parts.join(', ')}.`);
  }
  const wishes = meStats.wishesForOther + (partnerStats?.wishesForOther ?? 0);
  if (wishes > 0) {
    summary.push(`Вы исполнили ${wishes} ${plural(wishes, 'желание', 'желания', 'желаний')} друг друга 🎁`);
  }
  if (together > 0) {
    summary.push(`Вместе ответили на ${together} ${plural(together, 'вопрос', 'вопроса', 'вопросов')} дня.`);
  }
  const filledParts = [`ты — ${meStats.filledDays} из ${days.length}`];
  if (partner && partnerStats) filledParts.push(`${partner.name} — ${partnerStats.filledDays} из ${days.length}`);
  summary.push(`Дневник заполнен: ${filledParts.join(', ')}.`);

  return { days, me: meStats, partner: partnerStats, together, bestDay, points, summary };
}
