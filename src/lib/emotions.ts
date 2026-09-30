// Справочник эмоций. valence — насколько эмоция приятная (-2…+2),
// используется в автобалле дня и в цвете тепловой карты.

export type Emotion = {
  key: string;
  label: string;
  emoji: string;
  color: string;
  valence: number;
  subs: string[];
};

export const EMOTIONS: Emotion[] = [
  { key: 'joy', label: 'Радость', emoji: '😊', color: '#FFD166', valence: 2, subs: ['счастье', 'восторг', 'гордость', 'веселье', 'облегчение'] },
  { key: 'calm', label: 'Спокойствие', emoji: '😌', color: '#7FD8BE', valence: 1.5, subs: ['умиротворение', 'расслабленность', 'уверенность', 'безопасность', 'баланс'] },
  { key: 'love', label: 'Нежность', emoji: '🥰', color: '#FF9EBB', valence: 2, subs: ['любовь', 'близость', 'забота', 'благодарность', 'теплота'] },
  { key: 'passion', label: 'Страсть', emoji: '🔥', color: '#FF7A7A', valence: 1.5, subs: ['желание', 'влечение', 'азарт', 'увлечённость'] },
  { key: 'inspiration', label: 'Вдохновение', emoji: '✨', color: '#B39DFF', valence: 2, subs: ['энтузиазм', 'любопытство', 'творческий подъём', 'мотивация', 'надежда'] },
  { key: 'sadness', label: 'Грусть', emoji: '😢', color: '#6FA8DC', valence: -1.5, subs: ['тоска', 'одиночество', 'разочарование', 'ностальгия', 'печаль'] },
  { key: 'boredom', label: 'Скука', emoji: '😐', color: '#A0A0B2', valence: -0.5, subs: ['апатия', 'пустота', 'безразличие', 'рутина'] },
  { key: 'anxiety', label: 'Тревога', emoji: '😰', color: '#F4A261', valence: -1.5, subs: ['беспокойство', 'страх', 'напряжение', 'неуверенность', 'паника'] },
  { key: 'anger', label: 'Злость', emoji: '😠', color: '#E76F51', valence: -2, subs: ['раздражение', 'обида', 'ревность', 'негодование', 'бессилие'] },
  { key: 'tiredness', label: 'Усталость', emoji: '🥱', color: '#8D99AE', valence: -1, subs: ['сонливость', 'выгорание', 'опустошённость', 'перегруженность', 'вялость'] },
];

const UNKNOWN: Emotion = { key: 'unknown', label: 'Настроение', emoji: '🙂', color: '#A0A0B2', valence: 0, subs: [] };

export function getEmotion(key: string | null | undefined): Emotion {
  return EMOTIONS.find((e) => e.key === key) ?? UNKNOWN;
}

export const INTENSITY_LABELS = ['', 'едва', 'слегка', 'заметно', 'сильно', 'очень сильно'];

// Балл одной отметки 0…10: 5 — нейтрально, приятные эмоции выше, неприятные ниже
export function moodEntryScore(emotionKey: string, intensity: number): number {
  const v = 5 + (getEmotion(emotionKey).valence * intensity) / 2;
  return Math.min(10, Math.max(0, v));
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
  const s = Math.min(10, Math.max(0, score));
  return s < 5 ? mix('#D9485F', '#55556A', s / 5) : mix('#55556A', '#3FBF83', (s - 5) / 5);
}
