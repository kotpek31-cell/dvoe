// Мини-игры в комнате: запуск колеса, ведущий (если крутил я), приём снимков от ведущего, ходы игроков,
// сбор на арене, «ведущий ушёл — игра прервана». Правила — rules.ts, ведущий — host.ts.
// Ведущий ушёл с экрана или в фон — игра прерывается у всех (и на сервере — room_game_cancel).
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { AppState } from 'react-native';
import { roomGameCancel, roomGameFinish, roomGameStart, type RoomMember } from '../api';
import { errorMessage } from '../env';
import type { LocationId } from '../locations';
import type { Presence, Wire } from '../roomLink';
import { fracX, fracY, freeSpot, pxX, pxY, type Geo, type Mover } from '../roomWorld';
import { GameHost, type GameSnap, type StarBots } from './host';
import * as Rules from './rules';
import { near, starSchedule, starSpot, STARS, type Action, type Star } from './rules';

type MoveOpts = { send?: boolean; force?: boolean; snap?: boolean; onArrive?: () => void };

type Deps = {
  meId: string | null;
  members: RoomMember[];
  membersRef: MutableRefObject<RoomMember[]>;
  presentRef: MutableRefObject<Map<string, Presence>>;
  isOnline: (m: RoomMember) => boolean;
  send: (w: Wire) => void;
  geoRef: MutableRefObject<Geo>;
  loc: LocationId;
  movers: MutableRefObject<Map<string, Mover>>;
  moveMember: (id: string, fx: number, fy: number, run: boolean, opts?: MoveOpts) => void;
  camCenter: () => number; // середина экрана в пикселях мира
  toast: (text: string) => void;
};

export const isActive = (s: GameSnap | null | undefined) => Boolean(s && (s.phase === 'wheel' || s.phase === 'play' || s.phase === 'end'));

// Где упадёт звезда (доли мира): на арене, но не в костре и не в дереве
export function gameSpot(g: Geo, loc: LocationId, s: Pick<GameSnap, 'cx' | 'half'>, st: Pick<Star, 'u' | 'v'>) {
  const p = starSpot(s.cx, s.half, st);
  const f = freeSpot(g, loc, pxX(g, p.x), pxY(g, p.y));
  return { x: fracX(g, f.px), y: fracY(g, f.py) };
}

// Насколько близко надо стоять к тени, чтобы поймать (доли мира и глубины)
export const catchR = (g: Geo) => ({ rx: (g.base * 0.5) / Math.max(1, g.worldW - 2 * g.margin), ry: 0.22 });

const round3 = (v: number) => Math.round(v * 1000) / 1000;

export function useRoomGame(d: Deps) {
  const [snap, setSnapState] = useState<GameSnap | null>(null);
  const snapRef = useRef<GameSnap | null>(null);
  const host = useRef<GameHost | null>(null);
  const offset = useRef(0); // мои часы − часы ведущего
  const closed = useRef<string | null>(null);
  const lastRecv = useRef(0);
  const hostGone = useRef(0);
  const [starting, setStarting] = useState(false);
  const dRef = useRef(d);
  dRef.current = d;

  const setSnap = useCallback((s: GameSnap | null) => {
    snapRef.current = s;
    setSnapState(s);
  }, []);
  const toLocal = useCallback((t: number) => t + offset.current, []);
  const amHost = Boolean(snap && host.current && host.current.snap.id === snap.id);

  // ---------- снимки от ведущего ----------
  const receive = useCallback(
    (s: GameSnap) => {
      const now = Date.now();
      if (host.current && host.current.snap.id === s.id) return;
      if (closed.current === s.id) return;
      const cur = snapRef.current;
      if (cur && cur.id === s.id) {
        lastRecv.current = now; // пульс ведущего (тот же снимок раз в 2,5 с) — он на связи
        offset.current = Math.min(offset.current, now - s.now); // задержка только добавляет — берём наименьший сдвиг
        if (s.v <= cur.v) return;
      } else {
        if (host.current && !host.current.done) return; // я сам веду игру — сервер второй не даст
        host.current = null;
        offset.current = now - s.now;
        hostGone.current = 0;
      }
      lastRecv.current = now;
      setSnap(s);
    },
    [setSnap],
  );

  const onWire = useCallback(
    (w: Wire): boolean => {
      if (w.t === 'g') {
        receive(w.s);
        return true;
      }
      if (w.t === 'gi') {
        if (host.current && host.current.snap.id === w.id) host.current.input(w.m, w.a);
        return true;
      }
      return false;
    },
    [receive],
  );

  // Кто-то зашёл на экран — пусть сразу увидит игру
  const onJoin = useCallback(() => {
    setTimeout(() => {
      if (host.current && !host.current.done) host.current.flush(true);
    }, 350);
  }, []);

  // ---------- ход ----------
  const act = useCallback((a: Action) => {
    const s = snapRef.current;
    const me = dRef.current.meId;
    if (!s || !me || s.phase !== 'play' || !s.players.includes(me)) return;
    if (host.current && host.current.snap.id === s.id) host.current.input(me, a);
    else dRef.current.send({ t: 'gi', id: s.id, m: me, a });
  }, []);

  // ---------- колесо ----------
  const play = useCallback(async () => {
    const dd = dRef.current;
    if (!dd.meId || starting) return;
    if (isActive(snapRef.current)) {
      dd.toast('Уже идёт игра');
      return;
    }
    const want = dd.members.filter((m) => m.bot || m.id === dd.meId || dd.isOnline(m)).map((m) => m.id);
    if (want.length < 2) {
      dd.toast('Нужно хотя бы двое — позови бота');
      return;
    }
    setStarting(true);
    try {
      const res = await roomGameStart(want);
      if (!res.ok) {
        dd.toast(res.message);
        return;
      }
      const d2 = dRef.current;
      const g = d2.geoRef.current;
      const players = res.players.map((p) => p.m).filter(Boolean);
      const bots = res.players.filter((p) => !p.u).map((p) => p.m);
      // Арена — участок с экран там, куда смотрит камера
      const half = Math.min(0.5, (0.45 * g.width) / Math.max(1, g.worldW - 2 * g.margin));
      const cx = half >= 0.49 ? 0.5 : Math.min(1 - half - 0.01, Math.max(half + 0.01, fracX(g, d2.camCenter())));
      const n = players.length;
      const step = n > 1 ? Math.min((half * 1.6) / (n - 1), half * 0.62) : 0;
      const spots: Record<string, [number, number]> = {};
      players.forEach((m, i) => {
        const x = cx + (i - (n - 1) / 2) * step;
        const y = n > 3 ? (i % 2 ? 0.66 : 0.36) : i % 2 ? 0.58 : 0.46;
        const f = freeSpot(g, d2.loc, pxX(g, x), pxY(g, y));
        spots[m] = [round3(fracX(g, f.px)), round3(fracY(g, f.py))];
      });
      const r = catchR(g);
      const starBots: StarBots | undefined =
        res.game === 'stars'
          ? {
              pos: (m) => dRef.current.movers.current.get(m)?.now() ?? null,
              move: (m, x, y) => dRef.current.moveMember(m, x, y, true, { force: true }),
              spot: (st) => gameSpot(dRef.current.geoRef.current, dRef.current.loc, { cx, half }, st),
              rx: r.rx,
              ry: r.ry,
            }
          : undefined;
      closed.current = null;
      offset.current = 0;
      host.current = new GameHost(
        { id: res.id, game: res.game, seed: res.seed, host: d2.meId!, players, bots, cx: round3(cx), half: round3(half), spots },
        {
          rules: Rules,
          clock: Date.now,
          emit: (s) => {
            if (closed.current !== s.id) setSnap(s);
            dRef.current.send({ t: 'g', s });
          },
          finish: (places, best) => roomGameFinish(res.id, places, best),
          starBots,
        },
      );
    } catch (e) {
      dd.toast(errorMessage(e));
    } finally {
      setStarting(false);
    }
  }, [starting, setSnap]);

  // ---------- ведущий: тик, кто ушёл ----------
  const sid = snap?.id;
  useEffect(() => {
    const h = host.current;
    if (!sid || !h || h.snap.id !== sid || h.done) return;
    const t = setInterval(() => {
      const dd = dRef.current;
      const onScreen = new Set(dd.presentRef.current.keys());
      if (dd.meId) onScreen.add(dd.meId);
      h.present(onScreen, new Set(dd.membersRef.current.map((m) => m.id)));
      h.tick();
      if (h.done) clearInterval(t);
    }, 100);
    return () => clearInterval(t);
  }, [sid]);

  // Ведущий ушёл с экрана или в фон — прервать у всех
  useEffect(() => {
    const abort = () => {
      const h = host.current;
      if (!h || h.done) return;
      const dd = dRef.current;
      const name = dd.membersRef.current.find((m) => m.id === dd.meId)?.name ?? 'Ведущий';
      h.abort(`${name} ушёл — игра прервана`);
      roomGameCancel(h.snap.id).catch(() => undefined);
    };
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background') abort();
    });
    return () => {
      sub.remove();
      abort();
    };
  }, []);

  // ---------- не ведущий: ведущий пропал — прервать у себя ----------
  const phase = snap?.phase;
  useEffect(() => {
    if (!sid || amHost || !isActive(snapRef.current)) return;
    const t = setInterval(() => {
      const s = snapRef.current;
      if (!s || !isActive(s)) return;
      const dd = dRef.current;
      const now = Date.now();
      if (dd.presentRef.current.has(s.host) && now - lastRecv.current < 9000) {
        hostGone.current = 0;
        return;
      }
      if (!hostGone.current) hostGone.current = now;
      if (now - hostGone.current > 3500) {
        const name = dd.membersRef.current.find((m) => m.id === s.host)?.name ?? 'Ведущий';
        setSnap({ ...s, phase: 'aborted', reason: `${name} ушёл — игра прервана` });
      }
    }, 500);
    return () => clearInterval(t);
  }, [sid, phase, amHost, setSnap]);

  // Прервана — сказать и убрать
  useEffect(() => {
    const s = snapRef.current;
    if (!s || s.phase !== 'aborted') return;
    dRef.current.toast(s.reason ?? 'Игра прервана');
    const t = setTimeout(() => {
      if (snapRef.current?.id === s.id) {
        closed.current = s.id;
        setSnap(null);
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [sid, phase, setSnap]);

  // ---------- новая игра: все бегут на арену ----------
  useEffect(() => {
    const s = snapRef.current;
    if (!s || !isActive(s)) return;
    if (s.phase !== 'wheel' && s.game === 'stars') return; // в «Звездопаде» уже бегают сами
    const dd = dRef.current;
    Object.entries(s.spots).forEach(([m, [x, y]]) => {
      if (dd.movers.current.has(m)) dd.moveMember(m, x, y, true, { send: false });
    });
  }, [sid]);

  // ---------- «Звездопад»: поймал ли я (решает мой экран, засчитывает ведущий) ----------
  useEffect(() => {
    const s = snapRef.current;
    const me = dRef.current.meId;
    if (!s || s.game !== 'stars' || s.phase !== 'play' || !me || !s.players.includes(me)) return;
    const sched = starSchedule(s.seed);
    const checked = new Set<number>();
    const t = setInterval(() => {
      const cur = snapRef.current;
      if (!cur || cur.id !== s.id || cur.phase !== 'play' || cur.st?.g !== 'stars' || cur.st.out.includes(me)) return;
      const dd = dRef.current;
      const now = Date.now();
      const start = toLocal(cur.st.start);
      const g = dd.geoRef.current;
      const r = catchR(g);
      for (const x of sched) {
        if (checked.has(x.i)) continue;
        const land = start + x.at + STARS.FALL;
        if (now < land) break;
        checked.add(x.i);
        if (now - land > 500) continue; // был в фоне — не считаем
        const p = dd.movers.current.get(me)?.now();
        if (p && near(p, gameSpot(g, dd.loc, cur, x), r.rx, r.ry)) act({ k: x.kind === 'cloud' ? 'zap' : 'catch', i: x.i });
      }
    }, 40);
    return () => clearInterval(t);
  }, [sid, phase, act, toLocal]);

  // Пьедестал закрыт — до следующего колеса
  const close = useCallback(() => {
    const s = snapRef.current;
    if (s) closed.current = s.id;
    if (host.current?.done) host.current = null;
    setSnap(null);
  }, [setSnap]);

  return { snap, active: isActive(snap), amHost, starting, toLocal, play, act, onWire, onJoin, close };
}

export type RoomGame = ReturnType<typeof useRoomGame>;
