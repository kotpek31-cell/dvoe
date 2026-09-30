// Работа с датами в локальном часовом поясе. «День» хранится строкой YYYY-MM-DD.

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const WEEKDAYS_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

export const WEEK_HEADER = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const pad2 = (n: number) => String(n).padStart(2, '0');

export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayKey(): string {
  return toDayKey(new Date());
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(key: string, n: number): string {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + n);
  return toDayKey(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDayKey(a).getTime() - parseDayKey(b).getTime()) / 86_400_000);
}

export function rangeDays(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  for (let i = 0; cur <= to && i < 400; i += 1) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function startOfWeek(key: string): string {
  const shift = (parseDayKey(key).getDay() + 6) % 7; // понедельник = 0
  return addDays(key, -shift);
}

export function dayKeyOf(value: string | number | Date): string {
  return toDayKey(new Date(value));
}

export function atTime(key: string, hours: number, minutes = 0): Date {
  const d = parseDayKey(key);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export function formatTime(value: string | number | Date): string {
  const d = new Date(value);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatDuration(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return '—';
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

export function formatHours(min: number | null | undefined): string {
  if (min == null) return '—';
  return (min / 60).toFixed(1).replace('.', ',');
}

export function formatDayLong(key: string): string {
  const d = parseDayKey(key);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}, ${WEEKDAYS_FULL[d.getDay()]}`;
}

export function formatDayShort(key: string): string {
  const d = parseDayKey(key);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

export function weekdayShort(key: string): string {
  return WEEKDAYS_SHORT[parseDayKey(key).getDay()];
}

export function weekdayFull(key: string): string {
  return WEEKDAYS_FULL[parseDayKey(key).getDay()];
}

export function monthTitle(year: number, monthIndex: number): string {
  return `${MONTHS_NOM[monthIndex]} ${year}`;
}

export function relativeDay(key: string): string {
  const diff = diffDays(todayKey(), key);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  return formatDayShort(key);
}

export function weekTitle(startKey: string): string {
  const a = parseDayKey(startKey);
  const b = parseDayKey(addDays(startKey, 6));
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()}–${b.getDate()} ${MONTHS_GEN[b.getMonth()]}`;
  }
  return `${a.getDate()} ${MONTHS_GEN[a.getMonth()]} – ${b.getDate()} ${MONTHS_GEN[b.getMonth()]}`;
}

// Сетка месяца по неделям (пн–вс); пустые клетки = null
export function monthGrid(year: number, monthIndex: number): (string | null)[][] {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(toDayKey(new Date(year, monthIndex, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// Русские окончания: plural(5, 'день', 'дня', 'дней') → 'дней'
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
