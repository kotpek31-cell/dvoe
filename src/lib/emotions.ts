// Справочник эмоций и модель настроения 0.1.
// Отметка настроения — это «смесь»: сила каждой эмоции от 0 до 100 ({ joy: 65, love: 45 }).
// valence — насколько эмоция приятная (-2…+2): из неё считается балл 0…10.

export type EmotionKey =
  | 'joy'
  | 'calm'
  | 'love'
  | 'passion'
  | 'inspiration'
  | 'sadness'
  | 'boredom'
  | 'anxiety'
  | 'anger'
  | 'tiredness';

export type Emotion = {
  key: EmotionKey;
  label: string;
  emoji: string; // только для текстов уведомлений
  color: string;
  valence: number;
  group: 'light' | 'heavy';
  subs: string[];
};

export const EMOTIONS: Emotion[] = [
  { key: 'joy', label: 'Радость', emoji: '😊', color: '#FFD166', valence: 2, group: 'light', subs: ['счастье', 'восторг', 'гордость', 'веселье', 'облегчение'] },
  { key: 'calm', label: 'Спокойствие', emoji: '😌', color: '#7FD8BE', valence: 1.5, group: 'light', subs: ['умиротворение', 'расслабленность', 'уверенность', 'безопасность', 'баланс'] },
  { key: 'love', label: 'Нежность', emoji: '🥰', color: '#FF9EBB', valence: 2, group: 'light', subs: ['любовь', 'близость', 'забота', 'благодарность', 'теплота'] },
  { key: 'passion', label: 'Страсть', emoji: '🔥', color: '#FF7A7A', valence: 1.5, group: 'light', subs: ['желание', 'влечение', 'азарт', 'увлечённость'] },
  { key: 'inspiration', label: 'Вдохновение', emoji: '✨', color: '#B39DFF', valence: 2, group: 'light', subs: ['энтузиазм', 'любопытство', 'творческий подъём', 'мотивация', 'надежда'] },
  { key: 'sadness', label: 'Грусть', emoji: '😢', color: '#6FA8DC', valence: -1.5, group: 'heavy', subs: ['тоска', 'одиночество', 'разочарование', 'ностальгия', 'печаль'] },
  { key: 'boredom', label: 'Скука', emoji: '😐', color: '#A0A0B2', valence: -0.5, group: 'heavy', subs: ['апатия', 'пустота', 'безразличие', 'рутина'] },
  { key: 'anxiety', label: 'Тревога', emoji: '😰', color: '#F4A261', valence: -1.5, group: 'heavy', subs: ['беспокойство', 'страх', 'напряжение', 'неуверенность', 'паника'] },
  { key: 'anger', label: 'Злость', emoji: '😠', color: '#E76F51', valence: -2, group: 'heavy', subs: ['раздражение', 'обида', 'ревность', 'негодование', 'бессилие'] },
  { key: 'tiredness', label: 'Усталость', emoji: '🥱', color: '#8D99AE', valence: -1, group: 'heavy', subs: ['сонливость', 'выгорание', 'опустошённость', 'перегруженность', 'вялость'] },
];

const BY_KEY = new Map<string, Emotion>(EMOTIONS.map((e) => [e.key, e]));

export function isEmotionKey(key: unknown): key is EmotionKey {
  return typeof key === 'string' && BY_KEY.has(key);
}

export function getEmotion(key: string | null | undefined): Emotion {
  return (key && BY_KEY.get(key)) || BY_KEY.get('calm')!;
}

export type MoodMix = Partial<Record<EmotionKey, number>>;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Приводит «сырые» данные из базы к аккуратной смеси: только известные эмоции, 1…100
export function cleanMix(raw: unknown): MoodMix {
  const out: MoodMix = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (isEmotionKey(key) && Number.isFinite(n) && n > 0) out[key] = clamp(Math.round(n), 1, 100);
  });
  return out;
}

type MoodLike = { emotion: string; intensity: number; emotions?: unknown };

// Смесь из записи: новая колонка emotions, а у старых записей (до 0.1) — одна эмоция силой 1…5
export function entryMix(entry: MoodLike): MoodMix {
  const mix = cleanMix(entry.emotions);
  if (Object.keys(mix).length) return mix;
  if (isEmotionKey(entry.emotion)) return { [entry.emotion]: clamp(Math.round(entry.intensity * 20), 1, 100) };
  return {};
}

export type MixItem = { key: EmotionKey; value: number; emotion: Emotion };

export function mixTop(mix: MoodMix): MixItem[] {
  return EMOTIONS.filter((e) => (mix[e.key] ?? 0) > 0)
    .map((e) => ({ key: e.key, value: mix[e.key] ?? 0, emotion: e }))
    .sort((a, b) => b.value - a.value);
}

export function mixDominant(mix: MoodMix): MixItem | null {
  return mixTop(mix)[0] ?? null;
}

// Балл 0…10: 5 — нейтрально; приятные эмоции поднимают, неприятные опускают.
// Одна эмоция силой 20 даёт то же, что старая «сила 1» (5 ± valence/2).
export function mixScore(mix: MoodMix): number | null {
  let sum = 0;
  let weighted = 0;
  EMOTIONS.forEach((e) => {
    const a = (mix[e.key] ?? 0) / 100;
    sum += a;
    weighted += e.valence * a;
  });
  if (sum === 0) return null;
  return clamp(5 + (2.5 * weighted) / Math.max(1, sum), 0, 10);
}

export function moodEntryScore(entry: MoodLike): number {
  return mixScore(entryMix(entry)) ?? 5;
}

// «Радость и нежность»: вторая эмоция называется, если она хотя бы на 40% от главной
export function mixSummary(mix: MoodMix): string {
  const top = mixTop(mix);
  if (!top.length) return '';
  if (top[1] && top[1].value >= top[0].value * 0.4) return `${top[0].emotion.label} и ${top[1].emotion.label.toLowerCase()}`;
  return top[0].emotion.label;
}

export function mixLabels(mix: MoodMix, limit = 3): string {
  return mixTop(mix)
    .slice(0, limit)
    .map((t, i) => (i === 0 ? t.emotion.label : t.emotion.label.toLowerCase()))
    .join(', ');
}

export function intensityWord(value: number): string {
  if (value <= 0) return 'нет';
  if (value <= 20) return 'едва';
  if (value <= 40) return 'слегка';
  if (value <= 60) return 'заметно';
  if (value <= 80) return 'сильно';
  return 'очень сильно';
}

// Для старых колонок emotion/intensity (их читают старые версии приложения и виджет)
export function legacyIntensity(value: number): number {
  return clamp(Math.ceil(value / 20), 1, 5);
}

// Главная эмоция за период: у какой эмоции больше суммарная сила по всем отметкам
export function mainEmotion(entries: MoodLike[]): { key: EmotionKey; share: number; strength: number } | null {
  const totals = new Map<EmotionKey, number>();
  let all = 0;
  entries.forEach((entry) => {
    const mix = entryMix(entry);
    (Object.keys(mix) as EmotionKey[]).forEach((key) => {
      const v = mix[key] ?? 0;
      totals.set(key, (totals.get(key) ?? 0) + v);
      all += v;
    });
  });
  let best: Emotion | null = null;
  let bestValue = 0;
  for (const e of EMOTIONS) {
    const v = totals.get(e.key) ?? 0;
    if (v > bestValue) {
      best = e;
      bestValue = v;
    }
  }
  if (best === null || all === 0) return null;
  const key = best.key;
  // strength — средняя сила этой эмоции там, где она была отмечена (для лица)
  const marked = entries.filter((entry) => (entryMix(entry)[key] ?? 0) > 0).length;
  return { key, share: bestValue / all, strength: Math.round(bestValue / Math.max(1, marked)) };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

// Цвет для балла 0…10: красный → серый → зелёный
export function scoreColor(score: number | null | undefined): string | null {
  if (score == null || !Number.isFinite(score)) return null;
  const s = clamp(score, 0, 10);
  return s < 5 ? mix('#D9485F', '#55556A', s / 5) : mix('#55556A', '#2FA873', (s - 5) / 5);
}
