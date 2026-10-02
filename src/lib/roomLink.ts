// Связь комнаты.
// 1) Закрытый канал «room:<id>» (config.private): пускает только вошедших — проверяет сервер (политики на realtime.messages).
//    Движения, реакции, «дай пять» и ходы мини-игр — broadcast, в базу не пишутся. Кто на экране комнаты — presence.
// 2) Изменения в базе (по RLS — только своя комната): комната (место, лимит), кто вошёл и вышел, способности.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { ROOM_ID, type RoomCast, type RoomInfo } from './api';
import type { GameSnap } from './games/host';
import type { Action } from './games/rules';
import { supabase } from './supabase';

export type ReactionKind = 'heart' | 'laugh' | 'wow' | 'fire' | 'tear' | 'star';
export const REACTIONS: ReactionKind[] = ['heart', 'laugh', 'wow', 'fire', 'tear', 'star'];

export type Wire =
  | { t: 'move'; m: string; x: number; y: number; run?: boolean; snap?: boolean }
  | { t: 'react'; m: string; k: ReactionKind }
  | { t: 'five'; id: string; a: string; b: string; ax: number; ay: number; bx: number; by: number }
  | { t: 'fiveAll'; id: string; from: string; spots: Record<string, [number, number]> }
  | { t: 'g'; s: GameSnap } // мини-игра: снимок от ведущего
  | { t: 'gi'; id: string; m: string; a: Action }; // ход игрока — ведущему

export type Presence = { m: string; bots: string[] };

type Handlers = {
  onWire: (w: Wire) => void;
  onPresence: (present: Map<string, Presence>) => void;
  onJoin: () => void; // кто-то зашёл на экран — пошлём ему, где стоят наши
  onRoom: (room: Partial<RoomInfo>) => void;
  onMembers: (deletedId: string | null) => void; // вход или выход; при выходе — id участника
  onCast: (c: RoomCast) => void;
  onStatus: (ok: boolean) => void;
};

const isWire = (v: unknown): v is Wire => {
  const w = v as Wire | null;
  return Boolean(w && typeof w === 'object' && typeof w.t === 'string');
};

export class RoomLink {
  private live: RealtimeChannel | null = null;
  private db: RealtimeChannel | null = null;
  private me: Presence | null = null;
  private closed = false;

  constructor(private h: Handlers) {}

  async open(me: Presence) {
    this.me = me;
    try {
      await supabase.realtime.setAuth(); // закрытому каналу нужен токен пользователя
    } catch {
      // нет сессии — канал не пустит, onStatus(false)
    }
    if (this.closed) return;

    const live = supabase.channel(`room:${ROOM_ID}`, {
      config: { private: true, broadcast: { self: false }, presence: { key: me.m } },
    });
    live.on('broadcast', { event: 'w' }, ({ payload }) => {
      if (isWire(payload)) this.h.onWire(payload);
    });
    const sync = () => {
      const state = live.presenceState<Presence>();
      const map = new Map<string, Presence>();
      Object.entries(state).forEach(([key, metas]) => {
        const meta = metas[metas.length - 1];
        map.set(key, { m: key, bots: Array.isArray(meta?.bots) ? meta.bots : [] });
      });
      this.h.onPresence(map);
    };
    live.on('presence', { event: 'sync' }, sync);
    live.on('presence', { event: 'join' }, ({ key }) => {
      if (key !== this.me?.m) this.h.onJoin();
    });
    live.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.h.onStatus(true);
        if (this.me) live.track(this.me).catch(() => undefined);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.h.onStatus(false);
      }
    });
    this.live = live;

    const db = supabase.channel(`room-db-${me.m}`);
    db.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${ROOM_ID}` }, ({ new: row }) =>
      this.h.onRoom(row as Partial<RoomInfo>),
    );
    db.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_members', filter: `room_id=eq.${ROOM_ID}` }, () => this.h.onMembers(null));
    // DELETE не фильтруется на сервере и приходит только с id
    db.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'room_members' }, ({ old }) => {
      const id = (old as { id?: string })?.id;
      if (id) this.h.onMembers(id);
    });
    db.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_casts', filter: `room_id=eq.${ROOM_ID}` }, ({ new: row }) => {
      const c = row as RoomCast;
      if (c?.id) this.h.onCast(c);
    });
    db.subscribe();
    this.db = db;
  }

  send(w: Wire) {
    this.live?.send({ type: 'broadcast', event: 'w', payload: w }).catch(() => undefined);
  }

  // Мои боты поменялись — обновим presence
  retrack(me: Presence) {
    this.me = me;
    this.live?.track(me).catch(() => undefined);
  }

  // Ушёл в фон: для остальных «не в сети», но канал держим
  away(on: boolean) {
    if (!this.live) return;
    if (on) this.live.untrack().catch(() => undefined);
    else if (this.me) this.live.track(this.me).catch(() => undefined);
  }

  close() {
    this.closed = true;
    if (this.live) supabase.removeChannel(this.live);
    if (this.db) supabase.removeChannel(this.db);
    this.live = null;
    this.db = null;
  }
}
