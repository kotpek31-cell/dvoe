// «Что нового»: показывается само один раз после обновления, потом открывается из профиля.
// Пока не открывали — на плитке в профиле горит точка.
import { useSyncExternalStore } from 'react';
import { getFlag, setFlag } from './prefs';

type State = { loaded: boolean; seen: boolean; open: boolean };
let state: State = { loaded: false, seen: true, open: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

getFlag('whatsNew')
  .then((seen) => set({ loaded: true, seen }))
  .catch(() => set({ loaded: true, seen: true }));

export function useWhatsNew(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export const openWhatsNew = () => set({ open: true });

export function closeWhatsNew() {
  set({ open: false, seen: true });
  setFlag('whatsNew');
}
