// Чтение сна из Apple Health (HealthKit) через @kingstinct/react-native-healthkit.
// Модуль загружается лениво: в Expo Go и на Android его нет, и приложение не падает.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { isExpoGo } from './env';
import { loadHealthKitModule } from './healthkitModule';
import { detectSleepFromHealth, type HealthSleep } from './sleepDetect';

type HKSample = { startDate: Date | string; endDate: Date | string; value: number };

type HealthKitModule = {
  isHealthDataAvailable?: () => boolean | Promise<boolean>;
  requestAuthorization: (request: { toRead?: string[]; toShare?: string[] }) => Promise<boolean>;
  queryCategorySamples: (
    identifier: string,
    options: {
      limit: number;
      ascending?: boolean;
      filter?: { date?: { startDate?: Date; endDate?: Date } };
    },
  ) => Promise<readonly HKSample[]>;
};

const SLEEP_TYPE = 'HKCategoryTypeIdentifierSleepAnalysis';
const ASKED_KEY = 'dvoe:healthkit-asked';

let cached: HealthKitModule | null | undefined;

function loadHealthKit(): HealthKitModule | null {
  if (cached !== undefined) return cached;
  cached = null;
  if (Platform.OS !== 'ios' || isExpoGo) return cached;
  try {
    const mod = loadHealthKitModule() as { queryCategorySamples?: unknown; default?: unknown } | null;
    const candidate = (typeof mod?.queryCategorySamples === 'function' ? mod : mod?.default) as unknown as
      | HealthKitModule
      | undefined;
    if (candidate && typeof candidate.queryCategorySamples === 'function') cached = candidate;
  } catch (error) {
    console.warn('[healthkit] модуль недоступен', error);
  }
  return cached;
}

export function isHealthKitSupported(): boolean {
  return loadHealthKit() !== null;
}

export async function wasHealthAccessRequested(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ASKED_KEY)) === '1';
  } catch {
    return false;
  }
}

// Показывает системное окно доступа к «Здоровью» (только первый раз).
// iOS не сообщает приложению, дал ли пользователь доступ на чтение, —
// если доступа нет, запросы просто вернут пустой список.
export async function requestSleepAccess(): Promise<boolean> {
  const hk = loadHealthKit();
  if (!hk) return false;
  try {
    if (hk.isHealthDataAvailable && !(await hk.isHealthDataAvailable())) return false;
    await hk.requestAuthorization({ toRead: [SLEEP_TYPE] });
    await AsyncStorage.setItem(ASKED_KEY, '1');
    return true;
  } catch (error) {
    console.warn('[healthkit] не удалось запросить доступ', error);
    return false;
  }
}

export async function readSleepFromHealth(window: {
  queryStart: Date;
  queryEnd: Date;
  nightStart: Date;
  nightEnd: Date;
}): Promise<HealthSleep | null> {
  const hk = loadHealthKit();
  if (!hk) return null;
  const samples = await hk.queryCategorySamples(SLEEP_TYPE, {
    limit: 1000,
    ascending: true,
    filter: { date: { startDate: window.queryStart, endDate: window.queryEnd } },
  });
  return detectSleepFromHealth(
    samples.map((s) => ({
      start: new Date(s.startDate).getTime(),
      end: new Date(s.endDate).getTime(),
      value: Number(s.value),
    })),
    { nightStart: window.nightStart.getTime(), nightEnd: window.nightEnd.getTime() },
  );
}
