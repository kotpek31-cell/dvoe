// Комната на троих (0.2.2): общая площадка для своих. Экран поверх вкладок, как гардероб.
// Мир шире экрана (rooms.world_w экранов), камера идёт за твоим чибиком, свайп — осмотреться, «К себе» — вернуться.
// Движения, реакции и «дай пять» — через закрытый канал комнаты (src/lib/roomLink.ts), у всех одинаково:
// место в долях мира, пиксели каждый телефон считает сам. Каждым чибиком «управляет» один телефон —
// человеком его владелец, ботом — тот, кто позвал. Он же запоминает место в базе (room_move) по прибытии.
// Способности — room_cast на сервере; сцену видят все (вставка в room_casts приходит каждому).
// «Назад» — остаёшься в комнате (у других — сидит полупрозрачный), «Выйти» — освобождаешь место.
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, PanResponder, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chibi } from '../src/components/Chibi';
import { Confetti, SparkPop, Toast } from '../src/components/Effects';
import { Icon, type IconName } from '../src/components/Icon';
import { LocationSheet } from '../src/components/LocationSheet';
import { ReactionBubble, ReactionIcon, REACTION_LABEL } from '../src/components/room/Reaction';
import { RoomActor } from '../src/components/room/RoomActor';
import { WideLand, WideSky } from '../src/components/room/WideLocation';
import { AbilityScene, sceneKind, worldTransform } from '../src/components/scene/AbilityScene';
import { Sheet } from '../src/components/Sheet';
import { Button, IconButton, Pressy, Txt } from '../src/components/ui';
import { useAuth } from '../src/context/AuthProvider';
import type { Scene } from '../src/context/AbilityProvider';
import { abilityInfo, leftLabel } from '../src/lib/abilities';
import { useAccess } from '../src/lib/access';
import { useAmbient } from '../src/lib/ambient';
import {
  fetchInventory,
  isDevRole,
  roomBotAdd,
  roomBotRemove,
  roomCast,
  roomEnter,
  roomKick,
  roomLeave,
  roomMarkCastsSeen,
  roomMove,
  roomNotify,
  roomPendingCasts,
  roomPing,
  roomSetLocation,
  roomState,
  type RoomCast,
  type RoomInfo,
  type RoomMember,
} from '../src/lib/api';
import { useCatalog } from '../src/lib/catalog';
import { lookOf, type Look } from '../src/lib/chibi';
import { useDevOverride } from '../src/lib/devOverride';
import { errorMessage } from '../src/lib/env';
import type { FaceKey } from '../src/lib/face';
import { useScreenFocused } from '../src/lib/focus';
import { isLocationId, LOCATION_BG, locationName, type LocationId } from '../src/lib/locations';
import { haptic, nativeDriver, useReducedMotion } from '../src/lib/motion';
import { REACTIONS, RoomLink, type Presence, type ReactionKind, type Wire } from '../src/lib/roomLink';
import { fracX, fracY, freeSpot, makeGeo, Mover, pxX, pxY, scaleAt, type Geo } from '../src/lib/roomWorld';
import { canAutoplay, playSound } from '../src/lib/sound';
import { dayTimeOf } from '../src/lib/scene';
import { C, F } from '../src/theme';

type Phase = 'loading' | 'in' | 'full' | 'gone' | 'error';
type RoomScene = { cast: RoomCast; scene: Scene };
type Playing = RoomScene & { size: number; ground: number; casterEnd: number; fy: number };
type Pose = 'jump' | 'cheer' | 'wave';

const IDLE_MS = 20_000; // без дела — гуляет сам
const PING_MS = 30_000;
const SCENE_COLORS = [C.accent, C.warn, C.me, C.good, C.partner];
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Где окажутся способный и цель в сцене (та же раскладка, что в AbilityScene)
function scenePlaces(ability: string, width: number, size: number) {
  if (sceneKind(ability) === 'mog') {
    const t = Math.min(width - size * 1.5, width * 0.5);
    return { target: t, caster: t - size * 0.92 };
  }
  const cx = width / 2;
  return { target: cx - size * 0.26, caster: cx - size * 0.74 };
}

export default function RoomScreen() {
  const { userId } = useAuth();
  const access = useAccess();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const focused = useScreenFocused();
  const reduce = useReducedMotion();
  const catalog = useCatalog();
  const override = useDevOverride();

  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [full, setFull] = useState<{ capacity: number; members: RoomMember[] } | null>(null);
  const [present, setPresent] = useState<Map<string, Presence>>(() => new Map());
  const [linkOk, setLinkOk] = useState(false);
  const [owned, setOwned] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null); // меню на чужом чибике
  const [reactOpen, setReactOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const [reacts, setReacts] = useState<Record<string, { k: ReactionKind; n: number }>>({});
  const [poses, setPoses] = useState<Record<string, Pose>>({});
  const [faces, setFaces] = useState<Record<string, 1 | -1>>({});
  const [sparks, setSparks] = useState<{ n: number; x: number; y: number }>({ n: 0, x: 0, y: 0 });
  const [confetti, setConfetti] = useState(0);
  const [clapWord, setClapWord] = useState(false);
  const [follow, setFollow] = useState(true);
  const [, setTick] = useState(0);
  const [queue, setQueue] = useState<RoomScene[]>([]);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [allowed, setAllowed] = useState<string | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const link = useRef<RoomLink | null>(null);
  const movers = useRef(new Map<string, Mover>());
  const camX = useRef(new Animated.Value(0)).current;
  const camRef = useRef(0);
  const followRef = useRef(true);
  const sceneT = useRef(new Animated.Value(0)).current;
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const persistTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const idleAt = useRef(Date.now() + IDLE_MS);
  const botNext = useRef<Record<string, number>>({});
  const lastReact = useRef<Record<string, number>>({});
  const known = useRef(new Set<string>());
  const five = useRef<{ id: string; need: Set<string>; all: string[] } | null>(null);
  const lastHello = useRef(0);
  const membersRef = useRef<RoomMember[]>([]);
  membersRef.current = members;
  const meRef = useRef<string | null>(null);
  meRef.current = meId;
  const ownedRef = useRef(owned);
  ownedRef.current = owned;
  const presentRef = useRef(present);
  presentRef.current = present;

  const loc: LocationId = isLocationId(room?.location) ? room.location : 'forest';
  const time = override.time ?? dayTimeOf(now);
  const geo: Geo = useMemo(() => makeGeo(width, height, room?.world_w ?? 3, room?.world_d ?? 1.5), [width, height, room?.world_w, room?.world_d]);
  const geoRef = useRef(geo);
  geoRef.current = geo;
  useAmbient(loc, focused && phase === 'in');

  const later = (key: string, ms: number, fn: () => void) => {
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, ms);
  };
  const showToast = useCallback((text: string) => {
    setToast(text);
    if (timers.current.toast) clearTimeout(timers.current.toast);
    timers.current.toast = setTimeout(() => setToast(null), 2800);
  }, []);
  const bump = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    const all = timers.current;
    const persist = persistTimers.current;
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      clearInterval(tick);
      Object.values(all).forEach(clearTimeout);
      Object.values(persist).forEach(clearTimeout);
    };
  }, []);

  // ---------- участники и ходоки ----------
  const moverFor = useCallback((m: RoomMember) => {
    let mv = movers.current.get(m.id);
    if (!mv) {
      mv = new Mover(geoRef.current, m.x, m.y);
      movers.current.set(m.id, mv);
    }
    return mv;
  }, []);

  useEffect(() => {
    movers.current.forEach((mv) => mv.setGeo(geo));
  }, [geo]);

  const applyState = useCallback(
    (s: { room: RoomInfo; members: RoomMember[]; me: string | null }) => {
      setRoom(s.room);
      setMembers(s.members);
      setMeId(s.me);
      const ids = new Set(s.members.map((m) => m.id));
      movers.current.forEach((mv, id) => {
        if (!ids.has(id)) {
          mv.stop();
          movers.current.delete(id);
        }
      });
      s.members.forEach(moverFor);
      setOwned(new Set(s.members.filter((m) => m.user_id === userId || m.bot_owner === userId).map((m) => m.id)));
    },
    [moverFor, userId],
  );

  const reload = useCallback(async () => {
    try {
      const s = await roomState();
      if (!s.me) {
        setPhase('gone');
        return;
      }
      applyState(s);
    } catch (e) {
      showToast(errorMessage(e));
    }
  }, [applyState, showToast]);

  // ---------- камера ----------
  const clampCam = useCallback((v: number) => Math.min(Math.max(0, v), Math.max(0, geoRef.current.worldW - geoRef.current.width)), []);
  const camTo = useCallback(
    (px: number, duration = 450, linear = false) => {
      const v = clampCam(px - geoRef.current.width / 2);
      camRef.current = v;
      Animated.timing(camX, {
        toValue: v,
        duration: reduce ? 0 : duration,
        easing: linear ? Easing.linear : Easing.inOut(Easing.quad),
        useNativeDriver: nativeDriver,
      }).start(() => bump());
    },
    [camX, clampCam, reduce, bump],
  );
  const setFollowing = (on: boolean) => {
    followRef.current = on;
    setFollow(on);
  };

  // ---------- движение ----------
  const persist = useCallback((id: string) => {
    if (persistTimers.current[id]) clearTimeout(persistTimers.current[id]);
    persistTimers.current[id] = setTimeout(() => {
      const mv = movers.current.get(id);
      if (!mv) return;
      const p = mv.now();
      roomMove(p.x, p.y, id).catch(() => undefined);
    }, 700);
  }, []);

  // Пошёл: у себя сразу, остальным — через канал (только тем, кем управляю)
  const moveMember = useCallback(
    (id: string, fx: number, fy: number, run: boolean, opts: { send?: boolean; snap?: boolean; onArrive?: () => void } = {}) => {
      const mv = movers.current.get(id);
      if (!mv) return;
      const mine = ownedRef.current.has(id);
      const arrive = () => {
        if (mine) persist(id);
        opts.onArrive?.();
        bump();
      };
      let dur = 0;
      if (opts.snap) {
        mv.snap(fx, fy);
        arrive();
      } else {
        dur = mv.go(fx, fy, run, arrive, reduce);
      }
      if (mine && opts.send !== false) link.current?.send({ t: 'move', m: id, x: mv.state.to.x, y: mv.state.to.y, run, snap: opts.snap });
      if (id === meRef.current && followRef.current) camTo(pxX(geoRef.current, mv.state.to.x), Math.max(dur, 300), dur > 0);
    },
    [persist, bump, reduce, camTo],
  );

  // ---------- реакции ----------
  const showReact = useCallback((m: string, k: ReactionKind) => {
    setReacts((r) => ({ ...r, [m]: { k, n: (r[m]?.n ?? 0) + 1 } }));
    playSound('pop', 0.5);
    later(`react-${m}`, 3000, () =>
      setReacts((r) => {
        const { [m]: _, ...rest } = r;
        return rest;
      }),
    );
  }, []);
  const react = useCallback(
    (m: string, k: ReactionKind) => {
      if (Date.now() - (lastReact.current[m] ?? 0) < 1000) return; // не чаще раза в секунду
      lastReact.current[m] = Date.now();
      showReact(m, k);
      link.current?.send({ t: 'react', m, k });
    },
    [showReact],
  );

  // ---------- дай пять ----------
  const finishFive = useCallback((id: string) => {
    const f = five.current;
    if (!f || f.id !== id) return;
    five.current = null;
    const g = geoRef.current;
    const pts = f.all.map((m) => movers.current.get(m)?.now()).filter(Boolean) as { x: number; y: number }[];
    if (pts.length) {
      const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
      const cy = Math.min(...pts.map((p) => p.y));
      setSparks((s) => ({ n: s.n + 1, x: pxX(g, cx), y: pxY(g, cy) - g.base * 1.1 }));
    }
    const jump: Record<string, Pose> = {};
    f.all.forEach((m) => (jump[m] = 'jump'));
    setPoses((p) => ({ ...p, ...jump }));
    playSound('clap');
    haptic.success();
    if (f.all.length > 2) {
      setConfetti((n) => n + 1);
      setClapWord(true);
      later('clapWord', 1600, () => setClapWord(false));
    }
    later(`five-${id}`, 700, () => {
      const cheer: Record<string, Pose> = {};
      f.all.forEach((m) => (cheer[m] = 'cheer'));
      setPoses((p) => ({ ...p, ...cheer }));
      later(`five2-${id}`, 1100, () => {
        setPoses((p) => {
          const next = { ...p };
          f.all.forEach((m) => delete next[m]);
          return next;
        });
        setFaces({});
      });
    });
  }, []);

  const arriveFive = useCallback(
    (id: string, m: string) => {
      const f = five.current;
      if (!f || f.id !== id) return;
      f.need.delete(m);
      if (!f.need.size) finishFive(id);
    },
    [finishFive],
  );

  const runFive = useCallback(
    (id: string, spots: Record<string, [number, number]>, facesTo: Record<string, 1 | -1>) => {
      const all = Object.keys(spots).filter((m) => movers.current.has(m));
      five.current = { id, need: new Set(all), all };
      setFaces(facesTo);
      all.forEach((m) => {
        const [x, y] = spots[m];
        // у каждого — у себя, без отправки: команда уже пришла всем
        moveMember(m, x, y, true, { send: false, onArrive: () => arriveFive(id, m) });
      });
      later(`fiveMax-${id}`, 5000, () => finishFive(id)); // кто-то не добежал — всё равно хлопаем
    },
    [moveMember, arriveFive, finishFive],
  );

  // ---------- кто в сети ----------
  const isOnline = useCallback(
    (m: RoomMember) => {
      if (m.id === meId) return linkOk;
      if (present.has(m.id)) return true;
      if (m.bot && m.bot_owner) {
        if (m.bot_owner === userId) return linkOk;
        const owner = members.find((x) => x.user_id === m.bot_owner);
        return Boolean(owner && present.has(owner.id));
      }
      return false;
    },
    [meId, linkOk, present, members, userId],
  );

  // ---------- способности ----------
  const enqueueCast = useCallback((c: RoomCast) => {
    if (known.current.has(c.id)) return;
    known.current.add(c.id);
    setQueue((q) => [...q, { cast: c, scene: { key: c.id, ability: c.ability, from: 'partner' as const, castId: c.id, at: Date.parse(c.created_at) || Date.now() } }].slice(-4));
  }, []);

  // ---------- вход ----------
  const enter = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      const res = await roomEnter();
      if (!res.ok) {
        setFull({ capacity: res.capacity, members: res.members });
        setPhase('full');
        return;
      }
      applyState(res);
      setPhase(res.me ? 'in' : 'gone');
    } catch (e) {
      setError(errorMessage(e));
      setPhase('error');
    }
  }, [applyState]);

  useEffect(() => {
    if (userId) enter();
  }, [userId, enter]);

  // Канал и база — пока экран открыт и я в комнате
  const myBots = useMemo(() => members.filter((m) => m.bot && m.bot_owner === userId).map((m) => m.id), [members, userId]);
  const myBotsRef = useRef(myBots);
  myBotsRef.current = myBots;
  useEffect(() => {
    if (phase !== 'in' || !meId) return;
    const sendHello = () => {
      if (Date.now() - lastHello.current < 800) return;
      lastHello.current = Date.now();
      ownedRef.current.forEach((id) => {
        const mv = movers.current.get(id);
        if (!mv) return;
        const p = mv.state.to;
        link.current?.send({ t: 'move', m: id, x: p.x, y: p.y, snap: true });
      });
    };
    let reloadTimer: ReturnType<typeof setTimeout> | undefined;
    const l = new RoomLink({
      onWire: (w: Wire) => {
        if (w.t === 'move') {
          if (!movers.current.has(w.m)) return;
          if (w.snap) movers.current.get(w.m)!.snap(w.x, w.y);
          else movers.current.get(w.m)!.go(w.x, w.y, Boolean(w.run), bump, reduce);
          bump();
        } else if (w.t === 'react') {
          showReact(w.m, w.k);
        } else if (w.t === 'five') {
          runFive(w.id, { [w.a]: [w.ax, w.ay], [w.b]: [w.bx, w.by] }, { [w.a]: w.ax <= w.bx ? 1 : -1, [w.b]: w.ax <= w.bx ? -1 : 1 });
        } else if (w.t === 'fiveAll') {
          const cx = Object.values(w.spots).reduce((a, s) => a + s[0], 0) / Math.max(1, Object.keys(w.spots).length);
          const fs: Record<string, 1 | -1> = {};
          Object.entries(w.spots).forEach(([m, s]) => (fs[m] = s[0] <= cx ? 1 : -1));
          runFive(w.id, w.spots, fs);
        }
      },
      onPresence: setPresent,
      onJoin: () => setTimeout(sendHello, 300),
      onRoom: (r) => setRoom((cur) => (cur ? { ...cur, ...r } : cur)),
      onMembers: (deleted) => {
        if (deleted && deleted === meRef.current) {
          setPhase('gone');
          return;
        }
        if (deleted && !membersRef.current.some((m) => m.id === deleted)) return;
        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = setTimeout(reload, 300);
      },
      onCast: enqueueCast,
      onStatus: setLinkOk,
    });
    link.current = l;
    l.open({ m: meId, bots: myBotsRef.current });
    // Пропущенные сцены: показываем последнюю, остальные — просмотрены
    roomPendingCasts()
      .then((list) => {
        const fresh = list.filter((c) => !known.current.has(c.id));
        if (!fresh.length) return;
        const rest = fresh.slice(0, -1).map((c) => c.id);
        rest.forEach((id) => known.current.add(id));
        roomMarkCastsSeen(rest).catch(() => undefined);
        enqueueCast(fresh[fresh.length - 1]);
      })
      .catch(() => undefined);
    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      l.close();
      link.current = null;
      setLinkOk(false);
      setPresent(new Map());
    };
  }, [phase, meId, reload, bump, reduce, showReact, runFive, enqueueCast]);

  // Мои боты поменялись — сообщаем в presence
  useEffect(() => {
    if (meId) link.current?.retrack({ m: meId, bots: myBots });
  }, [meId, myBots]);

  // Камера — сразу к себе
  const placed = useRef(false);
  useEffect(() => {
    if (phase !== 'in' || !meId || placed.current) return;
    const mv = movers.current.get(meId);
    if (!mv) return;
    placed.current = true;
    const v = clampCam(pxX(geo, mv.state.to.x) - width / 2);
    camRef.current = v;
    camX.setValue(v);
    bump();
  }, [phase, meId, geo, width, camX, clampCam, bump]);

  // «Я на экране»: раз в 30 с; ушёл с экрана или в фон — сразу «нет», чтобы шли пуши
  useEffect(() => {
    if (phase !== 'in' || !focused) return;
    roomPing().catch(() => undefined);
    const t = setInterval(() => roomPing().catch(() => undefined), PING_MS);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        link.current?.away(false);
        roomPing().catch(() => undefined);
      } else if (st === 'background') {
        link.current?.away(true);
        roomPing(true).catch(() => undefined);
      }
    });
    return () => {
      clearInterval(t);
      sub.remove();
      roomPing(true).catch(() => undefined);
    };
  }, [phase, focused]);

  // Без дела 20 с — гуляю сам; боты гуляют и иногда реагируют (их ведёт мой телефон)
  useEffect(() => {
    if (phase !== 'in' || !focused || !linkOk) return;
    const t = setInterval(() => {
      if (playing || five.current) return;
      const n = Date.now();
      const me = meRef.current;
      const mv = me ? movers.current.get(me) : undefined;
      if (me && mv && !mv.state.moving && n > idleAt.current) {
        const p = mv.now();
        const g = geoRef.current;
        const dx = rand(0.03, 0.1) * (Math.random() < 0.5 ? -1 : 1);
        const want = freeSpot(g, loc, pxX(g, p.x + dx), pxY(g, rand(0.1, 0.9)));
        moveMember(me, fracX(g, want.px), fracY(g, want.py), false);
        idleAt.current = n + rand(7000, 15000);
      }
      myBotsRef.current.forEach((id) => {
        const bm = movers.current.get(id);
        if (!bm || bm.state.moving) return;
        if (!botNext.current[id]) botNext.current[id] = n + rand(2000, 6000);
        if (n < botNext.current[id]) return;
        botNext.current[id] = n + rand(6000, 14000);
        if (Math.random() < 0.25) {
          react(id, REACTIONS[Math.floor(Math.random() * REACTIONS.length)]);
          return;
        }
        const p = bm.now();
        const g = geoRef.current;
        const want = freeSpot(g, loc, pxX(g, p.x + rand(-0.12, 0.12)), pxY(g, rand(0.05, 0.95)));
        moveMember(id, fracX(g, want.px), fracY(g, want.py), false);
      });
    }, 1500);
    return () => clearInterval(t);
  }, [phase, focused, linkOk, playing, moveMember, react, loc]);

  const touch = () => {
    idleAt.current = Date.now() + IDLE_MS;
  };

  // ---------- сцены способностей ----------
  const current = queue[0] ?? null;
  const castMember = (id: string) => members.find((m) => m.id === id);
  const sceneReady = Boolean(current && focused && !playing && (allowed === current.scene.key || canAutoplay() || current.cast.from_member === meId));
  useEffect(() => {
    if (!sceneReady || !current) return;
    const target = movers.current.get(current.cast.to_member);
    const caster = movers.current.get(current.cast.from_member);
    if (!target || !caster) {
      setQueue((q) => q.slice(1)); // кого-то уже нет в комнате
      return;
    }
    const g = geoRef.current;
    const p = target.now();
    target.stop();
    caster.stop();
    const size = Math.round(g.base * scaleAt(g, p.y));
    const chibiH = Math.round((size * 170) / 120);
    const places = scenePlaces(current.cast.ability, width, size);
    const cam = clampCam(pxX(g, p.x) - (places.target + size / 2));
    camRef.current = cam;
    Animated.timing(camX, { toValue: cam, duration: reduce ? 0 : 420, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }).start(() => {
      setPlaying({ ...current, size, ground: pxY(g, p.y) - chibiH, casterEnd: cam + places.caster + size / 2, fy: p.y });
      bump();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, current?.scene.key]);

  const finishScene = useCallback(() => {
    const done = playing;
    setPlaying(null);
    setQueue((q) => q.slice(1));
    if (!done) return;
    const g = geoRef.current;
    const { cast } = done;
    // Применивший остался рядом с целью: запоминает тот, кто им управляет
    const fx = fracX(g, done.casterEnd);
    if (ownedRef.current.has(cast.from_member)) moveMember(cast.from_member, fx, done.fy, false, { snap: true });
    else movers.current.get(cast.from_member)?.snap(fx, done.fy);
    if (cast.to_user && cast.to_user === userId) roomMarkCastsSeen([cast.id]).catch(() => undefined);
    // Мой бот иногда отвечает объятиями
    const caster = membersRef.current.find((m) => m.id === cast.from_member);
    if (myBotsRef.current.includes(cast.to_member) && caster && !caster.bot && Math.random() < 0.35) {
      later(`botHug-${cast.id}`, 1400, () => roomCast(cast.from_member, 'ability.hug', cast.to_member).then((r) => r.ok && enqueueCast({ ...cast, id: r.id, from_member: cast.to_member, to_member: cast.from_member, from_user: null, to_user: caster.user_id, ability: 'ability.hug', blocked: false, created_at: r.created_at })).catch(() => undefined));
    }
    bump();
  }, [playing, userId, moveMember, enqueueCast, bump]);

  // ---------- действия ----------
  const myMover = meId ? movers.current.get(meId) : undefined;

  const goTo = (pageX: number, pageY: number) => {
    if (!meId || playing) return;
    const g = geo;
    if (pageY < g.farPx - g.base * 0.4) return; // нажали в небо
    touch();
    haptic.tap();
    const want = freeSpot(g, loc, pageX, Math.min(g.nearPx, Math.max(g.farPx, pageY)));
    setFollowing(true);
    moveMember(meId, fracX(g, want.px), fracY(g, want.py), true);
  };

  // Свайп по земле — осмотреться; короткое нажатие — идти туда
  const pan = useRef({ start: 0, moved: false, x: 0, y: 0 });
  const goRef = useRef(goTo);
  goRef.current = goTo;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, gs) => Math.abs(gs.dx) > 6,
        onPanResponderGrant: (e) => {
          pan.current = { start: camRef.current, moved: false, x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
          camX.stopAnimation((v) => {
            pan.current.start = v;
            camRef.current = v;
          });
        },
        onPanResponderMove: (_e, gs) => {
          if (!pan.current.moved && Math.abs(gs.dx) < 8) return;
          if (!pan.current.moved) {
            pan.current.moved = true;
            followRef.current = false;
            setFollow(false);
          }
          const v = clampCam(pan.current.start - gs.dx);
          camRef.current = v;
          camX.setValue(v);
        },
        onPanResponderRelease: () => {
          if (pan.current.moved) setTick((n) => n + 1);
          else goRef.current(pan.current.x, pan.current.y);
        },
        onPanResponderTerminate: () => setTick((n) => n + 1),
      }),
    [camX, clampCam],
  );

  const backToMe = () => {
    if (!myMover) return;
    setFollowing(true);
    camTo(pxX(geo, myMover.now().x));
  };

  const giveFive = (target: RoomMember) => {
    if (!meId || !myMover) return;
    setMenu(null);
    touch();
    const tm = movers.current.get(target.id);
    if (!tm) return;
    const g = geo;
    const a = myMover.now();
    const b = tm.now();
    const online = isOnline(target);
    const gap = (g.base * 0.36) / g.worldW;
    let ax: number, bx: number, y: number;
    if (online) {
      const mx = (a.x + b.x) / 2;
      y = (a.y + b.y) / 2;
      const left = a.x <= b.x;
      ax = mx + (left ? -gap : gap);
      bx = mx + (left ? gap : -gap);
    } else {
      y = b.y;
      bx = b.x;
      ax = b.x + (a.x <= b.x ? -gap * 2 : gap * 2);
    }
    const w: Wire = { t: 'five', id: uid(), a: meId, b: target.id, ax, ay: y, bx, by: online ? y : b.y };
    link.current?.send(w);
    if (w.t === 'five') runFive(w.id, { [meId]: [ax, y], [target.id]: [bx, w.by] }, { [meId]: ax <= bx ? 1 : -1, [target.id]: ax <= bx ? -1 : 1 });
    if (!target.bot) roomNotify('five', target.id).catch(() => undefined);
  };

  const fiveAll = () => {
    if (!meId || playing || five.current) return;
    touch();
    const g = geo;
    const crowd = members.filter((m) => isOnline(m) && movers.current.has(m.id));
    if (crowd.length < 2) {
      showToast('Пока в сети только ты');
      return;
    }
    const cx = fracX(g, camRef.current + width / 2);
    const step = (g.base * 0.62) / g.worldW;
    const spots: Record<string, [number, number]> = {};
    crowd.forEach((m, i) => {
      const off = (i - (crowd.length - 1) / 2) * step;
      spots[m.id] = [cx + off, i % 2 ? 0.62 : 0.46];
    });
    const w: Wire = { t: 'fiveAll', id: uid(), from: meId, spots };
    link.current?.send(w);
    const fs: Record<string, 1 | -1> = {};
    Object.entries(spots).forEach(([m, s]) => (fs[m] = s[0] <= cx ? 1 : -1));
    runFive(w.id, spots, fs);
    roomNotify('five_all').catch(() => undefined);
  };

  const cast = async (target: RoomMember, ability: string) => {
    setMenu(null);
    touch();
    if ((cooldowns[ability] ?? 0) > Date.now()) {
      showToast(`Перезарядка: ещё ${leftLabel(cooldowns[ability] - Date.now())}`);
      return;
    }
    try {
      const res = await roomCast(target.id, ability);
      if (res.ok) {
        setCooldowns((c) => ({ ...c, [ability]: Date.now() + res.cooldown_s * 1000 }));
        enqueueCast({
          id: res.id,
          room_id: 'dev',
          from_member: meId!,
          to_member: target.id,
          from_user: userId ?? null,
          to_user: target.user_id,
          ability,
          blocked: res.blocked,
          created_at: res.created_at,
          seen_at: null,
        });
      } else {
        if (res.error === 'cooldown' && res.wait_s) setCooldowns((c) => ({ ...c, [ability]: Date.now() + res.wait_s! * 1000 }));
        showToast(res.message);
      }
    } catch (e) {
      showToast(errorMessage(e));
    }
  };

  const [inventory, setInventory] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (phase !== 'in') return;
    fetchInventory()
      .then((rows) => setInventory(new Set(rows.map((r) => r.item_id))))
      .catch(() => undefined);
  }, [phase]);
  const abilities = useMemo(
    () => [...catalog.values()].filter((it) => it.cat === 'ability' && (it.source === 'free' || inventory.has(it.id))).sort((a, b) => a.sort - b.sort),
    [catalog, inventory],
  );

  const leave = async () => {
    setBusy('leave');
    try {
      await roomLeave();
      haptic.light();
      goBack();
    } catch (e) {
      showToast(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  const addBot = async () => {
    setBusy('bot');
    try {
      await roomBotAdd();
      haptic.success();
      await reload();
    } catch (e) {
      showToast(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  // ---------- экраны «занято», «вывели», ошибка ----------
  const owner = access?.role === 'owner';
  if (phase !== 'in') {
    return (
      <View style={[styles.root, { backgroundColor: LOCATION_BG[loc][time] }]}>
        <WideSky id={loc} width={width} height={height} time={time} />
        <WideLand id={loc} width={width} height={height} tiles={1} time={time} active={false} />
        <View style={[StyleSheet.absoluteFill, styles.dim]} />
        <View style={[styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          {phase === 'loading' ? (
            <Txt weight="heavy" size={16}>
              Входим в комнату…
            </Txt>
          ) : (
            <View style={styles.panel}>
              {phase === 'full' && full ? (
                <>
                  <Txt weight="display" size={18} center>
                    Комната занята
                  </Txt>
                  <Txt muted size={13} center>
                    {full.members.length} из {full.capacity} мест
                  </Txt>
                  <ScrollView style={{ maxHeight: height * 0.42 }} contentContainerStyle={styles.busyList}>
                    {full.members.map((m) => {
                      const on = !m.bot && Date.now() - Date.parse(m.seen_at) < 60_000;
                      const by = m.bot ? full.members.find((x) => x.user_id === m.bot_owner)?.name : null;
                      return (
                        <View key={m.id} style={styles.busyRow}>
                          <View style={[styles.busyIcon, { backgroundColor: m.bot ? 'rgba(94,211,160,0.22)' : 'rgba(255,158,187,0.22)' }]}>
                            <Icon name={m.bot ? 'bot' : 'profile'} size={18} color={m.bot ? C.good : C.partner} />
                          </View>
                          <View style={styles.flex}>
                            <Txt weight="heavy" size={14} numberOfLines={1}>
                              {m.name} · {m.title}
                            </Txt>
                            <Txt size={12} color={on ? C.good : C.faint}>
                              {m.bot ? `позвал${by ? ` ${by}` : 'и'}` : on ? 'в сети' : 'не в сети'}
                            </Txt>
                          </View>
                          {owner ? (
                            <Pressy
                              onPress={() =>
                                roomKick(m.id)
                                  .then(enter)
                                  .catch((e) => showToast(errorMessage(e)))
                              }
                              innerStyle={styles.kick}
                              accessibilityLabel={`Вывести: ${m.name}`}
                            >
                              <Txt weight="heavy" size={12.5} color={C.accent}>
                                Вывести
                              </Txt>
                            </Pressy>
                          ) : null}
                        </View>
                      );
                    })}
                  </ScrollView>
                  <Button title="Попробовать ещё" variant="secondary" onPress={enter} />
                </>
              ) : phase === 'gone' ? (
                <>
                  <Txt weight="display" size={18} center>
                    Ты не в комнате
                  </Txt>
                  <Txt muted size={14} center>
                    Тебя вывели или сняли роль. Войти снова можно, если есть место.
                  </Txt>
                  {access ? <Button title="Войти снова" onPress={enter} /> : null}
                </>
              ) : (
                <>
                  <Txt weight="display" size={18} center>
                    Не получилось войти
                  </Txt>
                  <Txt muted size={14} center>
                    {error ?? 'Попробуй ещё раз'}
                  </Txt>
                  <Button title="Ещё раз" onPress={enter} />
                </>
              )}
              <Button title="Назад" variant="secondary" onPress={goBack} />
            </View>
          )}
        </View>
      </View>
    );
  }

  // ---------- комната ----------
  const sceneKindNow = playing ? sceneKind(playing.cast.ability) : 'hug';
  const world = playing ? worldTransform(sceneT, sceneKindNow, reduce) : [];
  const actorOf = (m: RoomMember | undefined): { look: Look; emotion: FaceKey; value: number } => ({ look: lookOf({ chibi: m?.chibi }), emotion: 'calm', value: 40 });
  const castBanner = (c: RoomCast) => {
    const from = castMember(c.from_member)?.name ?? 'Кто-то';
    const to = castMember(c.to_member)?.name ?? 'кто-то';
    const name = catalog.get(c.ability)?.name ?? 'способность';
    return `${from} → ${to}: ${name}${c.blocked ? ' — отражено шляпой' : ''}`;
  };
  const waiting = current && !playing && !sceneReady && focused ? current : null;
  const menuMember = menu ? members.find((m) => m.id === menu) : undefined;
  const humans = members.length;
  const g = geo;

  // Кто за краем экрана — стрелка с именем
  const cam = camRef.current;
  const arrows = members
    .filter((m) => m.id !== meId)
    .map((m) => {
      const mv = movers.current.get(m.id);
      if (!mv) return null;
      const p = mv.now();
      const sx = pxX(g, p.x) - cam;
      if (sx > -g.base * 0.25 && sx < width + g.base * 0.25) return null;
      return { m, side: sx < 0 ? ('L' as const) : ('R' as const), y: pxY(g, p.y) - g.base * 0.9, px: pxX(g, p.x) };
    })
    .filter(Boolean) as { m: RoomMember; side: 'L' | 'R'; y: number; px: number }[];

  const bar: { key: string; icon: IconName; label: string; onPress: () => void; accent?: boolean }[] = [
    { key: 'r', icon: 'smile', label: 'Реакции', onPress: () => setReactOpen((v) => !v) },
    { key: 'f', icon: 'hand', label: 'Все — пять', onPress: fiveAll },
    { key: 'p', icon: 'wheel', label: 'Играть', onPress: () => showToast('Игры появятся совсем скоро'), accent: true },
    { key: 'm', icon: 'pin', label: 'Место', onPress: () => setPicker(true) },
  ];
  const barBottom = Math.max(insets.bottom, 10) + 6;

  return (
    <View style={[styles.root, { backgroundColor: LOCATION_BG[loc][time] }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: world }]}>
        <WideSky id={loc} width={width} height={height} time={time} />
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: g.worldW, height, transform: [{ translateX: Animated.multiply(camX, -1) }] }}>
          <WideLand id={loc} width={width} height={height} tiles={g.tiles} time={time} active={focused} />
          <View style={StyleSheet.absoluteFill} pointerEvents={playing ? 'none' : 'auto'} {...responder.panHandlers} accessibilityLabel="Земля: нажми — твой чибик побежит туда, проведи — осмотреться" />
          {members.map((m) => {
            const mv = movers.current.get(m.id);
            if (!mv) return null;
            const isMe = m.id === meId;
            const r = reacts[m.id];
            const online = isOnline(m);
            const hidden = Boolean(playing && (playing.cast.from_member === m.id || playing.cast.to_member === m.id));
            const pose = poses[m.id] ?? (r ? 'wave' : null);
            return (
              <RoomActor
                key={m.id}
                mover={mv}
                geo={g}
                look={lookOf({ chibi: m.chibi })}
                emotion={pose || r ? 'joy' : 'calm'}
                value={pose || r ? 80 : 40}
                pose={pose}
                face={faces[m.id]}
                label={`${m.name} · ${m.title}`}
                dot={isMe ? C.me : m.bot ? C.good : C.partner}
                online={online}
                hidden={hidden}
                a11y={isMe ? 'Это ты. Нажми — реакции' : `${m.name}. Нажми — дай пять и способности`}
                onPress={() => {
                  if (playing) return;
                  haptic.light();
                  touch();
                  if (isMe) setReactOpen((v) => !v);
                  else setMenu(m.id);
                }}
                over={r ? <ReactionBubble key={r.n} kind={r.k} nonce={r.n} size={Math.round(40 * Math.max(0.9, g.s))} /> : null}
              />
            );
          })}
          <SparkPop trigger={sparks.n} x={sparks.x} y={sparks.y} scale={g.s * 1.2} />
        </Animated.View>
      </Animated.View>

      {playing ? (
        <AbilityScene
          key={playing.scene.key}
          scene={playing.scene}
          t={sceneT}
          reduce={reduce}
          caster={actorOf(castMember(playing.cast.from_member))}
          target={actorOf(castMember(playing.cast.to_member))}
          width={width}
          height={height}
          size={playing.size}
          ground={playing.ground}
          onDone={finishScene}
        />
      ) : null}

      <Confetti trigger={confetti} colors={SCENE_COLORS} width={width} />
      {clapWord ? (
        <View pointerEvents="none" style={[styles.clapWrap, { top: height * 0.3 }]}>
          <Txt weight="display" size={34} color="#FFD45E" style={styles.clap}>
            Хлоп!
          </Txt>
        </View>
      ) : null}

      {/* верх: назад, кто и где, выйти */}
      <View style={[styles.top, { top: insets.top + 8 }, playing ? styles.hidden : null]} pointerEvents="box-none">
        <IconButton icon="back" label="Назад — останешься в комнате" onPress={goBack} tint="rgba(24,18,40,0.66)" />
        <View style={styles.title} pointerEvents="none">
          <Txt weight="display" size={15} center>
            Комната
          </Txt>
          <Txt weight="bold" size={12} center color="rgba(246,243,255,0.86)" numberOfLines={1}>
            {humans} из {room?.capacity ?? 3} · {locationName(loc)}
          </Txt>
        </View>
        <Pressy onPress={leave} innerStyle={styles.exit} scaleTo={0.94} accessibilityLabel="Выйти из комнаты — освободить место">
          <Icon name="exit" size={18} color={C.text} />
          <Txt weight="heavy" size={13}>
            {busy === 'leave' ? '…' : 'Выйти'}
          </Txt>
        </Pressy>
      </View>

      {playing ? (
        <View style={[styles.castWrap, { top: insets.top + 62 }]} pointerEvents="none">
          <View style={[styles.castPill, playing.cast.ability === 'ability.mog' ? styles.castMog : null]}>
            <Icon name={abilityInfo(playing.cast.ability).icon} size={16} color={abilityInfo(playing.cast.ability).color} fill={abilityInfo(playing.cast.ability).color} />
            <Txt weight="heavy" size={13} color={playing.cast.ability === 'ability.mog' ? C.warn : C.text} numberOfLines={1}>
              {castBanner(playing.cast)}
            </Txt>
          </View>
        </View>
      ) : null}

      {waiting ? (
        <View style={[styles.castWrap, { top: insets.top + 62 }]}>
          <Pressy onPress={() => setAllowed(waiting.scene.key)} innerStyle={styles.watch} accessibilityLabel="Смотреть сцену способности">
            <Icon name="sparkle" size={18} color={C.onAccent} fill={C.onAccent} />
            <Txt weight="heavy" size={14} color={C.onAccent} numberOfLines={1}>
              {castBanner(waiting.cast)} — смотреть
            </Txt>
          </Pressy>
        </View>
      ) : null}

      {!playing
        ? arrows.map((a) => (
            <Pressy
              key={a.m.id}
              onPress={() => {
                setFollowing(false);
                camTo(a.px);
              }}
              style={[styles.arrow, a.side === 'L' ? { left: 6 } : { right: 6 }, { top: Math.min(height - barBottom - 140, Math.max(insets.top + 70, a.y)) }]}
              innerStyle={[styles.arrowIn, { borderColor: a.m.bot ? C.good : C.partner }]}
              accessibilityLabel={`${a.m.name} за краем экрана. Нажми — камера поедет к нему`}
            >
              {a.side === 'L' ? <Icon name="chevronLeft" size={16} color={C.text} strokeWidth={2.4} /> : null}
              <View style={[styles.arrowDot, { backgroundColor: isOnline(a.m) ? C.good : '#7D7690' }]} />
              <Txt weight="heavy" size={12.5} numberOfLines={1}>
                {a.m.name}
              </Txt>
              {a.side === 'R' ? <Icon name="chevronRight" size={16} color={C.text} strokeWidth={2.4} /> : null}
            </Pressy>
          ))
        : null}

      {/* справа над панелью: к себе, позвать бота */}
      {!playing ? (
        <View style={[styles.side, { bottom: barBottom + 76 }]} pointerEvents="box-none">
          {isDevRole(access) && members.length < (room?.capacity ?? 3) ? (
            <Pressy onPress={addBot} innerStyle={styles.sideBtn} scaleTo={0.94} accessibilityLabel="Позвать бота">
              <Icon name="bot" size={18} color={C.good} />
              <Txt weight="heavy" size={12.5}>
                {busy === 'bot' ? '…' : 'Бот'}
              </Txt>
            </Pressy>
          ) : null}
          {!follow ? (
            <Pressy onPress={backToMe} innerStyle={styles.sideBtn} scaleTo={0.94} accessibilityLabel="Камеру — к себе">
              <Icon name="locate" size={18} color={C.text} />
              <Txt weight="heavy" size={12.5}>
                К себе
              </Txt>
            </Pressy>
          ) : null}
        </View>
      ) : null}

      {reactOpen && !playing ? (
        <View style={[styles.reactCard, { bottom: barBottom + 76 }]}>
          {REACTIONS.map((k) => (
            <Pressy
              key={k}
              onPress={() => {
                if (meId) react(meId, k);
                touch();
                setReactOpen(false);
              }}
              innerStyle={styles.reactBtn}
              scaleTo={0.86}
              accessibilityLabel={`Реакция: ${REACTION_LABEL[k]}`}
            >
              <ReactionIcon kind={k} size={28} />
            </Pressy>
          ))}
        </View>
      ) : null}

      {/* нижняя панель */}
      {!playing ? (
        <View style={[styles.bar, { bottom: barBottom }]}>
          {bar.map((b) => (
            <Pressy key={b.key} onPress={b.onPress} style={styles.barItem} innerStyle={[styles.barIn, b.accent ? styles.barAccent : null]} scaleTo={0.92} accessibilityLabel={b.label}>
              <Icon name={b.icon} size={22} color={b.accent ? C.accent : C.text} />
              <Txt weight="heavy" size={11.5} color={b.accent ? C.accent : C.muted} numberOfLines={1}>
                {b.label}
              </Txt>
            </Pressy>
          ))}
        </View>
      ) : null}

      <Toast text={toast} top={insets.top + 62} />

      <Sheet visible={Boolean(menuMember)} onClose={() => setMenu(null)} title={menuMember ? `${menuMember.name} · ${menuMember.title}` : ''}>
        {menuMember ? (
          <View style={styles.menu}>
            <View style={styles.menuHead}>
              <Chibi look={lookOf({ chibi: menuMember.chibi })} emotion="joy" value={50} pose="idle" size={56} still />
              <Txt muted size={13} style={styles.flex}>
                {isOnline(menuMember) ? 'В сети' : 'Не в сети — увидит сцену, когда вернётся'}
              </Txt>
            </View>
            <MenuRow icon="hand" color={C.text} label="Дай пять" onPress={() => giveFive(menuMember)} />
            {abilities.map((it) => {
              const left = (cooldowns[it.id] ?? 0) - Date.now();
              const info = abilityInfo(it.id);
              return <MenuRow key={it.id} icon={info.icon} color={info.color} label={it.name} note={left > 0 ? leftLabel(left) : undefined} onPress={() => cast(menuMember, it.id)} />;
            })}
            {menuMember.bot && (menuMember.bot_owner === userId || owner) ? (
              <MenuRow
                icon="close"
                color={C.bad}
                label="Убрать бота"
                onPress={() => {
                  setMenu(null);
                  roomBotRemove(menuMember.id)
                    .then(reload)
                    .catch((e) => showToast(errorMessage(e)));
                }}
              />
            ) : null}
          </View>
        ) : null}
      </Sheet>

      <LocationSheet
        visible={picker}
        onClose={() => setPicker(false)}
        current={loc}
        time={time}
        onError={showToast}
        title="Где комната?"
        note="Место комнаты меняет любой — у всех сразу; место вашей пары не меняется."
        onChoose={async (id) => {
          await roomSetLocation(id);
          setRoom((r) => (r ? { ...r, location: id } : r));
        }}
      />
    </View>
  );
}

function MenuRow({ icon, color, label, note, onPress }: { icon: IconName; color: string; label: string; note?: string; onPress: () => void }) {
  return (
    <Pressy onPress={onPress} innerStyle={styles.menuRow} scaleTo={0.97} accessibilityLabel={note ? `${label}, перезарядка ${note}` : label}>
      <Icon name={icon} size={20} color={color} fill={icon === 'heart' || icon === 'flame' ? color : undefined} />
      <Txt weight="heavy" size={15} style={[styles.flex, note ? styles.dimText : null]}>
        {label}
      </Txt>
      {note ? (
        <Txt weight="heavy" size={13} color={C.warn}>
          {note}
        </Txt>
      ) : null}
    </Pressy>
  );
}

const glass = { backgroundColor: 'rgba(24,18,40,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' };

const styles = StyleSheet.create({
  // в браузере overflow: hidden можно прокрутить фокусом (нажали на чибика у края) — clip не прокручивается
  root: { flex: 1, overflow: Platform.OS === 'web' ? ('clip' as 'hidden') : 'hidden' },
  flex: { flex: 1 },
  hidden: { opacity: 0 },
  dim: { backgroundColor: 'rgba(8,5,18,0.62)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  panel: { width: '100%', maxWidth: 420, padding: 20, gap: 12, borderRadius: 24, backgroundColor: 'rgba(28,23,48,0.94)', borderWidth: 1, borderColor: C.glassBorder },
  busyList: { gap: 12, paddingVertical: 6 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  busyIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  kick: { height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center', backgroundColor: 'rgba(255,107,138,0.16)', borderWidth: 1, borderColor: 'rgba(255,107,138,0.4)' },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 18, ...glass },
  exit: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20, ...glass },
  castWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  castPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, ...glass },
  castMog: { backgroundColor: 'rgba(255,194,102,0.18)', borderColor: C.warn },
  watch: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 18, borderRadius: 23, backgroundColor: C.accent, maxWidth: 360 },
  arrow: { position: 'absolute' },
  arrowIn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 10, borderRadius: 17, backgroundColor: 'rgba(24,18,40,0.78)', borderWidth: 1.5, maxWidth: 170 },
  arrowDot: { width: 7, height: 7, borderRadius: 4 },
  side: { position: 'absolute', right: 16, alignItems: 'flex-end', gap: 8 },
  sideBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 19, ...glass },
  reactCard: { position: 'absolute', left: 16, flexDirection: 'row', gap: 4, padding: 6, borderRadius: 26, backgroundColor: 'rgba(28,23,48,0.94)', borderWidth: 1, borderColor: C.glassBorder },
  reactBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  bar: { position: 'absolute', left: 16, right: 16, height: 66, borderRadius: 33, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, backgroundColor: 'rgba(24,18,40,0.84)', borderWidth: 1, borderColor: C.glassBorder },
  barItem: { flex: 1 },
  barIn: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', gap: 2 },
  barAccent: { backgroundColor: 'rgba(255,107,138,0.2)' },
  clapWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  clap: { fontFamily: F.display, textShadowColor: '#2B2035', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  menu: { gap: 8 },
  menuHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 50, paddingHorizontal: 16, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.06)' },
  dimText: { opacity: 0.55 },
});
