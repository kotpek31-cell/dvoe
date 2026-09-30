import { moodEntryScore } from './emotions';

// Автоматический балл дня 0…10 из трёх частей:
//   сон (35%) — 7–9 часов = 10 баллов, за каждый час недосыпа −2.5, пересыпа −2;
//   настроение (40%) — среднее по отметкам дня (приятные эмоции выше);
//   выполненные пункты (25%) — сон, настроение, благодарность, вопрос дня.
// Если сна или настроения нет, их вес перераспределяется. Вода с версии 0.1 не учитывается.

export type ChecklistKey = 'sleep' | 'mood' | 'gratitude' | 'question';
export type ChecklistItem = { key: ChecklistKey; label: string; done: boolean };

type MoodLike = { emotion: string; intensity: number; emotions?: unknown };

export type DayInputs = {
  sleepMin: number | null;
  moods: MoodLike[];
  gratitudes: number;
  answered: boolean;
};

export type AutoScore = {
  total: number;
  sleep: number | null;
  mood: number | null;
  completion: number;
  checklist: ChecklistItem[];
};

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const round1 = (v: number) => Math.round(v * 10) / 10;

export function sleepScore(min: number | null): number | null {
  if (min == null || min <= 0) return null;
  const h = min / 60;
  if (h >= 7 && h <= 9) return 10;
  if (h < 7) return round1(clamp(10 - (7 - h) * 2.5, 0, 10));
  return round1(clamp(10 - (h - 9) * 2, 0, 10));
}

export function moodScore(moods: MoodLike[]): number | null {
  if (moods.length === 0) return null;
  const sum = moods.reduce((acc, m) => acc + moodEntryScore(m), 0);
  return round1(sum / moods.length);
}

export function computeAutoScore(input: DayInputs): AutoScore {
  const checklist: ChecklistItem[] = [
    { key: 'sleep', label: 'Сон отмечен', done: input.sleepMin != null },
    { key: 'mood', label: 'Настроение отмечено', done: input.moods.length > 0 },
    { key: 'gratitude', label: 'Благодарность записана', done: input.gratitudes > 0 },
    { key: 'question', label: 'Ответ на вопрос дня', done: input.answered },
  ];
  const completion = round1((checklist.filter((c) => c.done).length / checklist.length) * 10);
  const sleep = sleepScore(input.sleepMin);
  const mood = moodScore(input.moods);

  const parts: [number, number][] = [[completion, 0.25]];
  if (sleep != null) parts.push([sleep, 0.35]);
  if (mood != null) parts.push([mood, 0.4]);
  const weight = parts.reduce((acc, [, w]) => acc + w, 0);
  const total = round1(parts.reduce((acc, [v, w]) => acc + v * w, 0) / weight);

  return { total, sleep, mood, completion, checklist };
}

export function formatScore(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return (Math.round(v * 10) / 10).toString().replace('.', ',');
}
