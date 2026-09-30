// JS-обёртка над локальным нативным модулем ScreenSleep (только Android).
// В Expo Go и на iOS модуля нет — функции возвращают безопасные значения.
import { requireNativeModule } from 'expo';
import { Platform } from 'react-native';

export type NativeScreenEvent = { type: number; time: number };

type ScreenSleepNative = {
  hasUsageAccess(): boolean;
  openUsageAccessSettings(): void;
  getScreenEvents(startMs: number, endMs: number): Promise<NativeScreenEvent[]>;
};

let native: ScreenSleepNative | null = null;
if (Platform.OS === 'android') {
  try {
    native = requireNativeModule<ScreenSleepNative>('ScreenSleep');
  } catch {
    native = null;
  }
}

export const isAvailable = native !== null;

export function hasUsageAccess(): boolean {
  try {
    return native?.hasUsageAccess() ?? false;
  } catch {
    return false;
  }
}

export function openUsageAccessSettings(): void {
  native?.openUsageAccessSettings();
}

export async function getScreenEvents(startMs: number, endMs: number): Promise<NativeScreenEvent[]> {
  if (!native) return [];
  return native.getScreenEvents(startMs, endMs);
}
