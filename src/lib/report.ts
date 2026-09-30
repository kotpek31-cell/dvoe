// Расчёты для вкладки «Итоги» и оценки дня. Чистые функции — легко тестировать.
import type { AnswerMark, DayScore, Gratitude, MoodEntry, SleepEntry, Wish } from '../types';
import { mainEmotion, type EmotionKey } from './emotions';
import { computeAutoScore, moodScore, round1 } from './score';

// Все записи пары за период (приходят одним запросом из api.fetchRange)
export type RangeData = {
  moods: MoodEntry[];
  sleeps: SleepEntry[];
  gratitudes: Gratitude[];
  scores: DayScore[];
  answers: AnswerMark[];
  wishesDone: Wish[];
};

const avg = (values: number[]): number | null =>
  values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null;

// Автобалл человека за день (null, если записей нет)
export function dayAutoScore(data: RangeData, userId: string, day: string): number | null {
  const moods = data.moods.filter((m) => m.user_id === userId && m.day === day);
  const sleep = data.sleeps.find((s) => s.user_id === userId && s.day === day);
  const gratitudes = data.gratitudes.filter((g) => g.user_id === userId && g.day === day).length;
  const answered = data.answers.some((a) => a.user_id === userId && a.day === day);
  if (!moods.length && !sleep && !gratitudes && !answered) return null;
  return computeAutoScore({ sleepMin: sleep?.duration_min ?? null, moods, gratitudes, answered }).total;
}

export function dayMoodScore(data: RangeData, userId: string, day: string): number | null {
  return moodScore(data.moods.filter((m) => m.user_id === userId && m.day === day));
}

// Оценка дня: своя, а если её нет — автобалл
export function dayValue(data: RangeData, userId: string, day: string): number | null {
  const rating = data.scores.find((s) => s.user_id === userId && s.day === day)?.rating;
  return rating ?? dayAutoScore(data, userId, day);
}

export function avgSleepMin(data: RangeData, userId: string, days: string[]): number | null {
  const list = data.sleeps.filter((s) => s.user_id === userId && days.includes(s.day)).map((s) => s.duration_min);
  const value = avg(list);
  return value == null ? null : Math.round(value);
}

// Среднее настроение 0…10 по дням, где были отметки
export function avgMood(data: RangeData, userId: string, days: string[]): number | null {
  return avg(days.map((d) => dayMoodScore(data, userId, d)).filter((v): v is number => v != null));
}

export function periodEmotion(
  data: RangeData,
  userId: string,
  days: string[],
): { key: EmotionKey; share: number; strength: number } | null {
  return mainEmotion(data.moods.filter((m) => m.user_id === userId && days.includes(m.day)));
}

export type DayPoint = { day: string; me: number | null; partner: number | null; avg: number | null };

export function dayPoints(data: RangeData, days: string[], meId: string, partnerId: string | null): DayPoint[] {
  return days.map((day) => {
    const me = dayValue(data, meId, day);
    const partner = partnerId ? dayValue(data, partnerId, day) : null;
    const values = [me, partner].filter((v): v is number => v != null);
    return { day, me, partner, avg: values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null };
  });
}

// Лучшие дни периода (по средней оценке пары), от лучшего
export function bestDays(points: DayPoint[], count = 3): string[] {
  return points
    .filter((p) => p.avg != null)
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0) || (a.day < b.day ? 1 : -1))
    .slice(0, count)
    .map((p) => p.day);
}

export type WishStats = { total: number; done: number; byMe: number; byPartner: number };

// Сколько желаний исполнено из всех (за всё время)
export function wishStats(wishes: Wish[], meId: string): WishStats {
  const done = wishes.filter((w) => w.is_done);
  return {
    total: wishes.length,
    done: done.length,
    byMe: done.filter((w) => w.done_by === meId && w.user_id !== meId).length,
    byPartner: done.filter((w) => w.done_by != null && w.done_by !== meId && w.user_id === meId).length,
  };
}
