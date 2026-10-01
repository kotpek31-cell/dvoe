// «Режим проверки» из комнаты разработчиков: подмена времени суток и локации на этом устройстве.
// Живёт до перезапуска приложения (в памяти); пока включён, на главной плашка «Режим проверки».
import { useSyncExternalStore } from 'react';
import type { LocationId } from './locations';
import type { DayTime } from './scene';

export type DevOverride = { time?: DayTime; location?: LocationId };

let state: DevOverride = {};
const listeners = new Set<() => void>();

export function setDevOverride(patch: DevOverride | null) {
  state = patch ? { ...state, ...patch } : {};
  listeners.forEach((l) => l());
}

export function useDevOverride(): DevOverride {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export const hasOverride = (o: DevOverride) => Boolean(o.time || o.location);
