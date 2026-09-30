// Фоновая синхронизация при открытии приложения:
// push-токен, напоминания, автоопределение сна и виджеты.
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { usePair } from '../context/PairProvider';
import { registerBackgroundRefresh } from './backgroundTask';
import { registerForPushAsync, scheduleReminders } from './notifications';
import { autoSaveLastNight } from './sleep';
import { refreshWidgets } from './widgets';

let lastSleepCheck = 0;

export function useBackgroundSync(): void {
  const { me, bump } = usePair();
  const userId = me?.id ?? null;
  const paired = Boolean(me?.pair_id);

  useEffect(() => {
    if (!userId || !paired) return;
    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      registerForPushAsync(userId)
        .then((res) => (res.ok ? scheduleReminders() : undefined))
        .catch((e) => console.warn('[push]', e));

      if (Date.now() - lastSleepCheck > 15 * 60_000) {
        lastSleepCheck = Date.now();
        autoSaveLastNight(userId)
          .then((res) => {
            if (res === 'saved' && !cancelled) bump('sleep_entries');
          })
          .catch((e) => console.warn('[sleep]', e));
      }

      refreshWidgets();
      registerBackgroundRefresh().catch((e) => console.warn('[background]', e));
    };

    run();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [userId, paired, bump]);
}
