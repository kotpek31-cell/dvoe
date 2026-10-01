// Способности: применение, перезарядка и очередь сцен.
// Сцена от партнёра приходит по realtime (ability_casts, to_user = я); пропущенные, пока приложение было
// закрыто, — из pending_casts при входе и возвращении в приложение (играем одну, последнюю, за сутки).
// Сцена играет на главной; на другом экране сверху плашка «Смотреть» (CastBanner).
import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { cooldownMs } from '../lib/abilities';
import { castAbility, fetchMyRecentCasts, fetchPendingCasts, markCastsSeen, type AbilityCast } from '../lib/api';
import { getCatalog } from '../lib/catalog';
import { errorMessage } from '../lib/env';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { usePair } from './PairProvider';

export type Scene = {
  key: string;
  ability: string;
  from: 'me' | 'partner';
  castId?: string;
  at: number; // когда применили (мс)
  dry?: boolean; // «вхолостую» из комнаты разработчиков: только у себя, без записи и пуша
};

type CastOutcome = { ok: true } | { ok: false; message: string };

type AbilityValue = {
  scene: Scene | null; // текущая (первая в очереди)
  finishScene: () => void;
  dismissScene: () => void; // закрыли плашку — не показываем
  cast: (ability: string) => Promise<CastOutcome>;
  rehearse: (ability: string) => void;
  cooldowns: Record<string, number>; // способность → до какого момента перезарядка (мс)
  homeVisible: boolean;
  setHomeVisible: (v: boolean) => void;
};

const DAY = 24 * 3600 * 1000;
const AbilityContext = createContext<AbilityValue | null>(null);

export function AbilityProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const { me, partner } = usePair();
  const [queue, setQueue] = useState<Scene[]>([]);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [homeVisible, setHomeVisible] = useState(false);
  const known = useRef(new Set<string>()); // id применений, которые уже в очереди или показаны
  const pairId = me?.pair_id ?? null;

  const enqueue = useCallback((s: Scene) => {
    if (s.castId) {
      if (known.current.has(s.castId)) return;
      known.current.add(s.castId);
    }
    setQueue((q) => [...q.filter((x) => Date.now() - x.at < DAY), s].slice(-4));
  }, []);

  const incoming = useCallback(
    (c: AbilityCast) => enqueue({ key: c.id, ability: c.ability, from: 'partner', castId: c.id, at: Date.parse(c.created_at) || Date.now() }),
    [enqueue],
  );

  // Пропущенные сцены: показываем последнюю, остальные сразу отмечаем просмотренными
  const loadPending = useCallback(async () => {
    try {
      const list = (await fetchPendingCasts()).filter((c) => !known.current.has(c.id));
      if (!list.length) return;
      const last = list[list.length - 1];
      const rest = list.slice(0, -1).map((c) => c.id);
      rest.forEach((id) => known.current.add(id));
      markCastsSeen(rest).catch(() => undefined);
      incoming(last);
    } catch {
      // нет связи — попробуем при следующем открытии
    }
  }, [incoming]);

  // Перезарядка после перезапуска: по моим последним применениям
  useEffect(() => {
    if (!userId) {
      setQueue([]);
      setCooldowns({});
      known.current.clear();
      return;
    }
    let alive = true;
    fetchMyRecentCasts(userId)
      .then((rows) => {
        if (!alive) return;
        const catalog = getCatalog();
        const next: Record<string, number> = {};
        rows.forEach((r) => {
          const until = Date.parse(r.created_at) + cooldownMs(r.ability, catalog);
          if (until > Date.now() && !(next[r.ability] > until)) next[r.ability] = until;
        });
        setCooldowns((prev) => ({ ...next, ...prev }));
      })
      .catch(() => undefined);
    loadPending();
    return () => {
      alive = false;
    };
  }, [userId, loadPending]);

  // Realtime: партнёр применил способность ко мне
  useEffect(() => {
    if (!userId || !pairId) return;
    const channel = supabase.channel(`casts-${userId}`);
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ability_casts', filter: `to_user=eq.${userId}` }, (payload) => {
      const row = payload.new as AbilityCast;
      if (!row?.id || row.from_user === userId) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      incoming(row);
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, pairId, incoming]);

  // Вернулись в приложение — вдруг realtime не дошёл
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && userId) loadPending();
    });
    return () => sub.remove();
  }, [userId, loadPending]);

  const scene = queue[0] ?? null;

  const finishScene = useCallback(() => {
    setQueue((q) => {
      const [done, ...rest] = q;
      if (done?.castId && done.from === 'partner') markCastsSeen([done.castId]).catch(() => undefined);
      return rest;
    });
  }, []);

  const cast = useCallback(
    async (ability: string): Promise<CastOutcome> => {
      if (!partner) return { ok: false, message: 'Сначала нужна пара' };
      try {
        const res = await castAbility(ability);
        if (res.ok) {
          setCooldowns((c) => ({ ...c, [ability]: Date.now() + res.cooldown_s * 1000 }));
          enqueue({ key: res.id, ability, from: 'me', castId: res.id, at: Date.now() });
          return { ok: true };
        }
        if (res.error === 'cooldown' && res.wait_s) setCooldowns((c) => ({ ...c, [ability]: Date.now() + res.wait_s! * 1000 }));
        return { ok: false, message: res.message };
      } catch (e) {
        return { ok: false, message: errorMessage(e) };
      }
    },
    [partner, enqueue],
  );

  const rehearse = useCallback((ability: string) => {
    enqueue({ key: `dry-${Date.now()}`, ability, from: 'me', at: Date.now(), dry: true });
  }, [enqueue]);

  const value = useMemo<AbilityValue>(
    () => ({ scene, finishScene, dismissScene: finishScene, cast, rehearse, cooldowns, homeVisible, setHomeVisible }),
    [scene, finishScene, cast, rehearse, cooldowns, homeVisible],
  );

  return <AbilityContext.Provider value={value}>{children}</AbilityContext.Provider>;
}

export function useAbility(): AbilityValue {
  const ctx = useContext(AbilityContext);
  if (!ctx) throw new Error('useAbility должен использоваться внутри AbilityProvider');
  return ctx;
}
