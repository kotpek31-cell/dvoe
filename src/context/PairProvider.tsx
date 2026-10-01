// Профили пары + realtime-подписка: любое изменение у партнёра сразу
// увеличивает «версию» таблицы, и открытые экраны перезагружают данные.
import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fetchPair, fetchProfiles } from '../lib/api';
import { syncCatalog } from '../lib/catalog';
import { errorMessage } from '../lib/env';
import { supabase } from '../lib/supabase';
import { refreshWidgets } from '../lib/widgets';
import { REALTIME_TABLES, type Pair, type Profile, type TableName } from '../types';
import { useAuth } from './AuthProvider';

type Versions = Record<TableName, number>;

type PairValue = {
  loading: boolean;
  error: string | null;
  me: Profile | null;
  partner: Profile | null;
  pair: Pair | null;
  versions: Versions;
  lastNudgeAt: number | null;
  refresh: () => Promise<void>;
  bump: (table?: TableName) => void;
  patchPair: (patch: Partial<Pair>) => void; // сразу показать своё изменение, не дожидаясь realtime
  partnerOnline: boolean; // партнёр сейчас в приложении (присутствие realtime, в базу не пишется)
};

const initialVersions = REALTIME_TABLES.reduce((acc, t) => ({ ...acc, [t]: 0 }), {} as Versions);

const PairContext = createContext<PairValue | null>(null);

export function PairProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pair, setPair] = useState<Pair | null>(null);
  const [versions, setVersions] = useState<Versions>(initialVersions);
  const [lastNudgeAt, setLastNudgeAt] = useState<number | null>(null);
  const [online, setOnline] = useState<string[]>([]);
  const widgetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bump = useCallback((table?: TableName) => {
    setVersions((prev) => {
      if (table) return { ...prev, [table]: prev[table] + 1 };
      const next = { ...prev };
      REALTIME_TABLES.forEach((t) => {
        next[t] += 1;
      });
      return next;
    });
  }, []);

  const patchPair = useCallback((patch: Partial<Pair>) => setPair((prev) => (prev ? { ...prev, ...patch } : prev)), []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    syncCatalog().catch(() => undefined); // вещи из каталога: новые появятся без обновления приложения
    try {
      const [list, currentPair] = await Promise.all([fetchProfiles(), fetchPair()]);
      setProfiles(list);
      setPair(currentPair);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Загрузка при входе/выходе
  useEffect(() => {
    if (!userId) {
      setProfiles([]);
      setPair(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
  }, [userId, refresh]);

  const me = useMemo(() => profiles.find((p) => p.id === userId) ?? null, [profiles, userId]);
  const partner = useMemo(
    () => profiles.find((p) => p.id !== userId && me?.pair_id != null && p.pair_id === me.pair_id) ?? null,
    [profiles, userId, me],
  );
  const pairId = me?.pair_id ?? null;

  const scheduleWidgetRefresh = useCallback(() => {
    if (widgetTimer.current) clearTimeout(widgetTimer.current);
    widgetTimer.current = setTimeout(() => {
      refreshWidgets();
    }, 1500);
  }, []);

  // Realtime: изменения по нашей паре
  useEffect(() => {
    if (!pairId || !userId) return;
    const channel = supabase.channel(`pair-${pairId}`);
    REALTIME_TABLES.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `pair_id=eq.${pairId}` },
        (payload) => {
          bump(table);
          if (table === 'profiles') refresh();
          if (table === 'nudges' && payload.eventType === 'INSERT') {
            const row = payload.new as { from_user?: string };
            if (row.from_user && row.from_user !== userId) {
              setLastNudgeAt(Date.now());
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
            }
          }
          if (table === 'mood_entries' || table === 'day_scores' || table === 'profiles') scheduleWidgetRefresh();
        },
      );
    });
    // Пара: смена локации (у pairs нет pair_id — фильтр по id)
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pairs', filter: `id=eq.${pairId}` }, (payload) => {
      const row = payload.new as Pair;
      if (row?.id) setPair((prev) => (prev ? { ...prev, ...row } : row));
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [pairId, userId, bump, refresh, scheduleWidgetRefresh]);

  // Присутствие: кто из пары сейчас в приложении. В фоне — уходим из списка.
  useEffect(() => {
    if (!pairId || !userId) {
      setOnline([]);
      return;
    }
    const channel = supabase.channel(`online-${pairId}`, { config: { presence: { key: userId } } });
    const sync = () => setOnline(Object.keys(channel.presenceState()));
    channel.on('presence', { event: 'sync' }, sync);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' && AppState.currentState !== 'background') channel.track({ at: Date.now() }).catch(() => undefined);
    });
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') channel.track({ at: Date.now() }).catch(() => undefined);
      else if (state === 'background') channel.untrack().catch(() => undefined);
    });
    return () => {
      sub.remove();
      supabase.removeChannel(channel);
    };
  }, [pairId, userId]);

  // Вернулись в приложение — обновляем всё (на случай, если realtime был недоступен)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && userId) {
        refresh();
        bump();
      }
    });
    return () => sub.remove();
  }, [userId, refresh, bump]);

  useEffect(
    () => () => {
      if (widgetTimer.current) clearTimeout(widgetTimer.current);
    },
    [],
  );

  const value = useMemo<PairValue>(
    () => ({ loading, error, me, partner, pair, versions, lastNudgeAt, refresh, bump, patchPair, partnerOnline: Boolean(partner && online.includes(partner.id)) }),
    [loading, error, me, partner, pair, versions, lastNudgeAt, refresh, bump, patchPair, partner, online],
  );

  return <PairContext.Provider value={value}>{children}</PairContext.Provider>;
}

export function usePair(): PairValue {
  const ctx = useContext(PairContext);
  if (!ctx) throw new Error('usePair должен использоваться внутри PairProvider');
  return ctx;
}

// Сумма версий нужных таблиц — удобно класть в зависимости загрузчика
export function useTableVersion(...tables: TableName[]): number {
  const { versions } = usePair();
  return tables.reduce((acc, t) => acc + versions[t], 0);
}
