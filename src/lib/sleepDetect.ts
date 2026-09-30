// Чистые алгоритмы определения сна (без нативного кода — легко тестировать).

// Коды событий Android UsageEvents.Event
export const SCREEN_EVENT = {
  INTERACTIVE: 15, // экран включился (Android 9+)
  NON_INTERACTIVE: 16, // экран погас
  KEYGUARD_SHOWN: 17,
  KEYGUARD_HIDDEN: 18,
  SHUTDOWN: 26, // телефон выключен (Android 10+)
  STARTUP: 27, // телефон включён
} as const;

export type ScreenEvent = { type: number; time: number };
export type Interval = { bed: number; wake: number };

// Периоды, когда экран был выключен
export function screenOffIntervals(events: ScreenEvent[], now: number): Interval[] {
  const sorted = [...events].sort((a, b) => a.time - b.time);
  const out: Interval[] = [];
  let offSince: number | null = null;
  for (const e of sorted) {
    if (e.type === SCREEN_EVENT.NON_INTERACTIVE || e.type === SCREEN_EVENT.SHUTDOWN) {
      if (offSince === null) offSince = e.time;
    } else if (e.type === SCREEN_EVENT.INTERACTIVE || e.type === SCREEN_EVENT.STARTUP) {
      if (offSince !== null && e.time > offSince) out.push({ bed: offSince, wake: e.time });
      offSince = null;
    }
  }
  if (offSince !== null && now > offSince) out.push({ bed: offSince, wake: now });
  return out;
}

// Склеивает интервалы, если между ними не больше maxGapMs
// (экран на минуту загорелся от уведомления или вы посмотрели время ночью)
export function mergeIntervals(intervals: Interval[], maxGapMs: number): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.bed - b.bed);
  const out: Interval[] = [];
  for (const cur of sorted) {
    const last = out[out.length - 1];
    if (last && cur.bed - last.wake <= maxGapMs) {
      last.wake = Math.max(last.wake, cur.wake);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

export type ScreenSleepOptions = {
  now: number;
  nightStart: number; // начало «ночного окна», например вчера 20:00
  nightEnd: number; // конец окна, например сегодня 12:00
  mergeGapMs?: number;
  minSleepMs?: number;
};

// Самый длинный период выключенного экрана, пересекающий ночное окно
export function detectSleepFromScreenEvents(events: ScreenEvent[], opts: ScreenSleepOptions): Interval | null {
  // Склеиваем только короткие включения экрана (уведомление, посмотреть время) —
  // если пользоваться телефоном дольше 3 минут, это уже бодрствование
  const mergeGap = opts.mergeGapMs ?? 3 * 60_000;
  const minSleep = opts.minSleepMs ?? 3 * 60 * 60_000;
  const merged = mergeIntervals(screenOffIntervals(events, opts.now), mergeGap);
  let best: Interval | null = null;
  for (const it of merged) {
    const overlapsNight = it.bed < opts.nightEnd && it.wake > opts.nightStart;
    const length = it.wake - it.bed;
    if (!overlapsNight || length < minSleep) continue;
    if (!best || length > best.wake - best.bed) best = it;
  }
  return best;
}

// Значения HKCategoryValueSleepAnalysis
export const HK_SLEEP = { IN_BED: 0, ASLEEP: 1, AWAKE: 2, CORE: 3, DEEP: 4, REM: 5 } as const;

export type HealthSleepSample = { start: number; end: number; value: number };
export type HealthSleep = { bed: number; wake: number; asleepMin: number };

// Главный сон ночи из образцов Apple Health: объединяем пересечения
// (часы и телефон пишут одновременно), склеиваем разрывы до часа, берём самую длинную сессию.
export function detectSleepFromHealth(
  samples: HealthSleepSample[],
  opts: { nightStart: number; nightEnd: number; sessionGapMs?: number },
): HealthSleep | null {
  const asleepValues: number[] = [HK_SLEEP.ASLEEP, HK_SLEEP.CORE, HK_SLEEP.DEEP, HK_SLEEP.REM];
  const asleep = samples.filter((s) => asleepValues.includes(s.value));
  const base = asleep.length ? asleep : samples.filter((s) => s.value === HK_SLEEP.IN_BED);
  const union = mergeIntervals(
    base.map((s) => ({ bed: s.start, wake: s.end })).filter((i) => i.wake > i.bed),
    0,
  );

  const gap = opts.sessionGapMs ?? 60 * 60_000;
  const sessions: { bed: number; wake: number; asleepMs: number }[] = [];
  for (const it of union) {
    const last = sessions[sessions.length - 1];
    if (last && it.bed - last.wake <= gap) {
      last.wake = Math.max(last.wake, it.wake);
      last.asleepMs += it.wake - it.bed;
    } else {
      sessions.push({ bed: it.bed, wake: it.wake, asleepMs: it.wake - it.bed });
    }
  }

  const candidates = sessions.filter((s) => s.bed < opts.nightEnd && s.wake > opts.nightStart);
  if (!candidates.length) return null;
  const best = candidates.reduce((a, b) => (b.asleepMs > a.asleepMs ? b : a));
  return { bed: best.bed, wake: best.wake, asleepMin: Math.round(best.asleepMs / 60_000) };
}
