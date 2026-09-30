// Автоопределение сна: Android — по экрану, iPhone — по Apple Health.
import { Platform } from 'react-native';
import * as ScreenSleep from '../../modules/screen-sleep';
import type { SleepEntry } from '../types';
import { fetchMySleep, upsertSleep } from './api';
import { addDays, atTime, todayKey } from './dates';
import { isHealthKitSupported, readSleepFromHealth, requestSleepAccess, wasHealthAccessRequested } from './healthkit';
import { detectSleepFromScreenEvents } from './sleepDetect';

export type DetectedSleep = {
  bed: Date;
  wake: Date;
  durationMin: number;
  source: 'android_screen' | 'healthkit';
};

export type AutoSleepResult =
  | { status: 'unsupported'; message: string }
  | { status: 'needs_permission'; message: string }
  | { status: 'no_data'; message: string }
  | { status: 'found'; sleep: DetectedSleep };

// Ночь, которая закончилась в день `day`: ищем сон с 20:00 накануне до 12:00 дня
export function nightWindow(day: string) {
  return {
    queryStart: atTime(addDays(day, -1), 12),
    nightStart: atTime(addDays(day, -1), 20),
    nightEnd: atTime(day, 12),
  };
}

export function autoSleepSupport(): { supported: boolean; message: string } {
  if (Platform.OS === 'android') {
    return ScreenSleep.isAvailable
      ? { supported: true, message: 'Сон определяется по времени, когда экран был выключен ночью.' }
      : { supported: false, message: 'Автоопределение работает в установленном APK, а не в Expo Go.' };
  }
  if (Platform.OS === 'ios') {
    return isHealthKitSupported()
      ? { supported: true, message: 'Сон берётся из приложения «Здоровье» (Apple Watch, режим сна, другие трекеры).' }
      : { supported: false, message: 'Apple Health доступен в сборке из TestFlight, а не в Expo Go.' };
  }
  return { supported: false, message: 'В веб-версии сон отмечается кнопками «Иду спать» / «Проснулся» или вручную.' };
}

export async function detectLastNight(day: string, opts: { askPermission?: boolean } = {}): Promise<AutoSleepResult> {
  const { queryStart, nightStart, nightEnd } = nightWindow(day);
  const now = Date.now();
  const support = autoSleepSupport();
  if (!support.supported) return { status: 'unsupported', message: support.message };

  if (Platform.OS === 'android') {
    if (!ScreenSleep.hasUsageAccess()) {
      return {
        status: 'needs_permission',
        message: 'Разрешите «Доступ к истории использования» для приложения «Двое», чтобы оно видело, когда гас экран.',
      };
    }
    const events = await ScreenSleep.getScreenEvents(queryStart.getTime(), now);
    const found = detectSleepFromScreenEvents(events, {
      now,
      nightStart: nightStart.getTime(),
      nightEnd: nightEnd.getTime(),
    });
    if (!found) {
      return { status: 'no_data', message: 'Не нашли ночного перерыва в использовании телефона длиннее 3 часов.' };
    }
    return {
      status: 'found',
      sleep: {
        bed: new Date(found.bed),
        wake: new Date(found.wake),
        durationMin: Math.round((found.wake - found.bed) / 60_000),
        source: 'android_screen',
      },
    };
  }

  if (opts.askPermission) await requestSleepAccess();
  const found = await readSleepFromHealth({ queryStart, queryEnd: new Date(Math.min(now, nightEnd.getTime() + 6 * 3600_000)), nightStart, nightEnd });
  if (!found) {
    return {
      status: 'no_data',
      message: 'В «Здоровье» нет данных о сне за эту ночь (или доступ не выдан). Отметьте сон кнопками ниже.',
    };
  }
  return {
    status: 'found',
    sleep: { bed: new Date(found.bed), wake: new Date(found.wake), durationMin: found.asleepMin, source: 'healthkit' },
  };
}

const isAutoSource = (entry: SleepEntry | null) =>
  !entry || entry.source === 'android_screen' || entry.source === 'healthkit';

// Сохраняет найденный сон, если пользователь ещё не вводил его вручную.
// Автозапись обновляется, если позже нашёлся более длинный сон (например, досыпали утром).
export async function autoSaveLastNight(userId: string, day = todayKey()): Promise<'saved' | 'skipped' | AutoSleepResult['status']> {
  if (new Date().getHours() < 5) return 'skipped'; // ночью не решаем за человека
  if (Platform.OS === 'ios' && !(await wasHealthAccessRequested())) return 'skipped';
  const existing = await fetchMySleep(userId, day);
  if (!isAutoSource(existing)) return 'skipped';

  const result = await detectLastNight(day);
  if (result.status !== 'found') return result.status;
  const { sleep } = result;
  if (existing) {
    const sameBed = Math.abs(new Date(existing.bed_time).getTime() - sleep.bed.getTime()) < 60_000;
    const sameWake = Math.abs(new Date(existing.wake_time).getTime() - sleep.wake.getTime()) < 60_000;
    if ((sameBed && sameWake) || sleep.durationMin < existing.duration_min) return 'skipped';
  }
  await upsertSleep({ userId, day, bed: sleep.bed, wake: sleep.wake, durationMin: sleep.durationMin, source: sleep.source });
  return 'saved';
}
