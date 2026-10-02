// Комната на троих (0.2.2): общая площадка для своих. Экран поверх вкладок, как гардероб.
// Мир шире экрана (rooms.world_w экранов), камера идёт за твоим чибиком, свайп — осмотреться, «К себе» — вернуться.
// Движения, реакции и «дай пять» — через закрытый канал комнаты (src/lib/roomLink.ts), у всех одинаково:
// место в долях мира, пиксели каждый телефон считает сам. Каждым чибиком «управляет» один телефон —
// человеком его владелец, ботом — тот, кто позвал. Он же запоминает место в базе (room_move) по прибытии.
// Способности — room_cast на сервере; сцену видят все (вставка в room_casts приходит каждому).
// Мини-игры — src/lib/games: колесо крутит любой, игру ведёт его телефон, остальные получают снимки через канал.
// «Назад» — остаёшься в комнате (у других — сидит полупрозрачный), «Выйти» — освобождаешь место.
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, PanResponder, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chibi } from '../src/components/Chibi';
import { Confetti, SparkPop, Toast } from '../src/components/Effects';
import { Icon, type IconName } from '../src/components/Icon';
import { Joystick } from '../src/components/Joystick';
import { LocationSheet } from '../src/components/LocationSheet';
import { actorGame } from '../src/components/room/games/actorGame';
import { GameHud } from '../src/components/room/games/GameHud';
import { GameWorld } from '../src/components/room/games/GameWorld';
import { Podium } from '../src/components/room/games/Podium';
import { PreGame } from '../src/components/room/games/PreGame';
import { RecordsSheet } from '../src/components/room/games/RecordsSheet';
import { ReactionBubble, ReactionIcon, REACTION_LABEL } from '../src/components/room/Reaction';
import { RoomActor } from '../src/components/room/RoomActor';
import { WideLand, WideSky } from '../src/components/room/WideLocation';
import { Basket, BASKET_W, basketSlot, FlyingShroom, MushroomPatch, PluckWord } from '../src/components/scene/Mushrooms';
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
import { useRoomGame } from '../src/lib/games/useRoomGame';
import { errorMessage } from '../src/lib/env';
import type { FaceKey } from '../src/lib/face';
import { useScreenFocused } from '../src/lib/focus';
import { isLocationId, LOCATION_BG, locationName, type LocationId } from '../src/lib/locations';
import { haptic, nativeDriver, useReducedMotion } from '../src/lib/motion';
import { HAT_ID, MUSH_REGROW_MS, putMushroom, ROOM_MUSHROOMS, showHatReveal, useHunt, type MushColor } from '../src/lib/mushrooms';
import { NightContext } from '../src/lib/night';
import { REACTIONS, RoomLink, type Presence, type ReactionKind, type Wire } from '../src/lib/roomLink';
import { fracX, fracY, freeSpot, makeGeo, Mover, pxX, pxY, RUN_SPEED, scaleAt, WALK_SPEED, type Geo } from '../src/lib/roomWorld';
import { getFlag } from '../src/lib/prefs';
import { canAutoplay, playSound } from '../src/lib/sound';
import { dayTimeOf } from '../src/lib/scene';
import { C, F } from '../src/theme';

type Phase = 'loading' | 'in' | 'full' | 'gone' | 'error';
type RoomScene = { cast: RoomCast; scene: Scene };
type Playing = RoomScene & { size: number; ground: number; casterEnd: number; fy: number };
type Pose = 'jump' | 'cheer' | 'wave' | 'sit';

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
  const [menu, setMenu] = useState<string | null>(null); // «инфо об игроке» — нажали на чужого чибика
  const [menuOpen, setMenuOpen] = useState(false); // одна кнопка-меню вверху: реакции, игры, место…
  const [people, setPeople] = useState(false); // список «Кто в комнате»
  const [picker, setPicker] = useState(false);
  const [zoomed, setZoomed] = useState(false); // камера отдалена — над головами видны имена
  const [stick, setStick] = useState(true); // джойстик (выключается в настройках)
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
  // Камера: свободная (camX — левый край в пикселях мира) или «приклеена» к моему чибику (без рывков: прямо от его x).
  // mix — плавный переход между ними; zoom — отдаление (1 — обычно, меньше — видно больше мира, у ног — земля).
  const camX = useRef(new Animated.Value(0)).current;
  const mix = useRef(new Animated.Value(1)).current;
  const zoom = useRef(new Animated.Value(1)).current;
  const zoomRef = useRef(1);
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
  const zoomedRef = useRef(false);
  const fitZoom = () => Math.min(1, geoRef.current.width / Math.max(1, geoRef.current.worldW));
  const clampCam = useCallback((v: number) => Math.min(Math.max(0, v), Math.max(0, geoRef.current.worldW - geoRef.current.width / zoomRef.current)), []);
  // Где камера сейчас (левый край мира на экране): приклеена — от моего чибика, свободна — camRef
  const camNow = useCallback(() => {
    const me = meRef.current;
    const mv = me ? movers.current.get(me) : undefined;
    if (followRef.current && mv && zoomRef.current === 1) return clampCam(pxX(geoRef.current, mv.now().x) - geoRef.current.width / 2);
    return camRef.current;
  }, [clampCam]);
  // Отцепить камеру от чибика там, где она сейчас
  const freeCam = useCallback(() => {
    if (!followRef.current) return;
    const v = camNow();
    camRef.current = v;
    camX.setValue(v);
    mix.setValue(0);
    followRef.current = false;
    setFollow(false);
  }, [camNow, camX, mix]);
  // Камеру — на точку мира (свободная камера)
  const camTo = useCallback(
    (px: number, duration = 450) => {
      freeCam();
      const v = clampCam(px - geoRef.current.width / zoomRef.current / 2);
      camRef.current = v;
      Animated.timing(camX, { toValue: v, duration: reduce ? 0 : duration, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }).start(() => bump());
    },
    [camX, clampCam, freeCam, reduce, bump],
  );
  // Снова за мной — плавно, даже если чибик сейчас идёт
  const followMe = useCallback(() => {
    if (followRef.current) return;
    followRef.current = true;
    setFollow(true);
    Animated.timing(mix, { toValue: 1, duration: reduce ? 0 : 480, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }).start(() => bump());
  }, [mix, reduce, bump]);
  const markZoomed = (z: number) => {
    const on = z < 0.86;
    if (on === zoomedRef.current) return;
    zoomedRef.current = on;
    setZoomed(on);
  };
  // Отдалить или приблизить (камера держит тот же центр); follow — после приближения снова за мной
  const zoomTo = useCallback(
    (z: number, follow = false) => {
      freeCam();
      const g = geoRef.current;
      const center = camRef.current + g.width / zoomRef.current / 2;
      zoomRef.current = z;
      const v = clampCam(center - g.width / z / 2);
      camRef.current = v;
      markZoomed(z);
      const t = (a: Animated.Value, to: number) => Animated.timing(a, { toValue: to, duration: reduce ? 0 : 420, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver });
      Animated.parallel([t(zoom, z), t(camX, v)]).start(() => {
        bump();
        if (follow) followMe();
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [freeCam, clampCam, followMe, reduce, bump, zoom, camX],
  );
  // Сразу без отдаления (сцена, игра)
  const unzoom = useCallback(() => {
    if (zoomRef.current === 1) return;
    zoomRef.current = 1;
    zoom.setValue(1);
    camRef.current = clampCam(camRef.current);
    camX.setValue(camRef.current);
    markZoomed(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, camX, clampCam]);

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
    (id: string, fx: number, fy: number, run: boolean, opts: { send?: boolean; force?: boolean; snap?: boolean; smooth?: boolean; onArrive?: () => void } = {}) => {
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
        dur = mv.go(fx, fy, run, arrive, reduce, opts.smooth);
      }
      // force — ведущий игры гонит чужого бота
      if ((mine || opts.force) && opts.send !== false) link.current?.send({ t: 'move', m: id, x: mv.state.to.x, y: mv.state.to.y, run, snap: opts.snap, ...(opts.smooth ? { e: 1 as const } : {}) });
      return dur; // камера за мной идёт сама (приклеена к чибику)
    },
    [persist, bump, reduce],
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
    setQueue((q) => [...q, { cast: c, scene: { key: c.id, ability: c.ability, from: 'partner' as const, castId: c.id, at: Date.parse(c.created_at) || Date.now(), blocked: c.blocked } }].slice(-4));
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

  // ---------- мини-игры ----------
  // Объявлено до канала: при уходе с экрана уборка игры («прервана») идёт раньше, чем закроется канал
  const game = useRoomGame({
    meId,
    members,
    membersRef,
    presentRef,
    isOnline,
    send: (w) => link.current?.send(w),
    geoRef,
    loc,
    movers,
    moveMember,
    camCenter: () => camNow() + geoRef.current.width / 2,
    toast: showToast,
  });
  const gameRef = useRef(game);
  gameRef.current = game;
  const [records, setRecords] = useState(false);

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
        if (gameRef.current.onWire(w)) return;
        if (w.t === 'move') {
          if (!movers.current.has(w.m)) return;
          if (w.snap) movers.current.get(w.m)!.snap(w.x, w.y);
          else movers.current.get(w.m)!.go(w.x, w.y, Boolean(w.run), bump, reduce, w.e === 1);
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
      onJoin: () => {
        setTimeout(sendHello, 300);
        gameRef.current.onJoin();
      },
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
      if (playing || five.current || gameRef.current.snap) return;
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
  const sceneFollow = useRef(false);
  const castMember = (id: string) => members.find((m) => m.id === id);
  const sceneReady = Boolean(current && focused && !playing && !game.snap && (allowed === current.scene.key || canAutoplay() || current.cast.from_member === meId));
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
    // сцена — на обычном приближении и со свободной камерой; потом камера снова за мной, если была
    unzoom();
    sceneFollow.current = followRef.current;
    freeCam();
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
    if (sceneFollow.current) {
      sceneFollow.current = false;
      setTimeout(followMe, 0); // после того, как применивший встал рядом с целью
    }
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
  }, [playing, userId, moveMember, enqueueCast, bump, followMe]);

  // ---------- действия ----------
  const myMover = meId ? movers.current.get(meId) : undefined;

  // Сдвиг мира на экране: камера (свободная или за мной) и отдаление — масштаб вокруг низа экрана (земля остаётся внизу).
  // Всё на native driver: камера за чибиком едет в одном кадре с ним, без рывков.
  const camFollow = useMemo(() => {
    if (!myMover || geo.worldW <= geo.width + 1) return null;
    return myMover.x.interpolate({ inputRange: [geo.width / 2, geo.worldW - geo.width / 2], outputRange: [0, geo.worldW - geo.width], extrapolate: 'clamp' });
  }, [myMover, geo]);
  const worldMove = useMemo(() => {
    const one = new Animated.Value(1);
    const minus = new Animated.Value(-1);
    const cam = camFollow ? Animated.add(Animated.multiply(camX, Animated.subtract(one, mix)), Animated.multiply(camFollow, mix)) : camX;
    const zm1 = Animated.subtract(zoom, one);
    return [
      { translateX: Animated.add(Animated.multiply(Animated.multiply(zoom, cam), minus), Animated.multiply(zm1, new Animated.Value(geo.worldW / 2))) },
      { translateY: Animated.multiply(zm1, new Animated.Value(-height / 2)) },
      { scale: zoom },
    ];
  }, [camFollow, camX, mix, zoom, geo.worldW, height]);
  const unscale = useMemo(() => Animated.divide(new Animated.Value(1), zoom), [zoom]);

  // Можно ли сейчас ходить: не во время сцены; в игре — только в «Звездопаде» (и не оглушён)
  const canWalk = () => {
    if (!meId || playing) return false;
    const gs = game.snap;
    if (!gs) return true;
    if (gs.phase !== 'play' || gs.st?.g !== 'stars' || !gs.players.includes(meId) || gs.st.out.includes(meId)) return false;
    return game.toLocal(gs.st.stun[meId] ?? 0) <= Date.now(); // оглушило — стоит
  };

  const goTo = (pageX: number, pageY: number) => {
    if (!meId || !canWalk()) return;
    const g = geo;
    if (pageY < g.farPx - g.base * 0.4) return; // нажали в небо
    touch();
    haptic.tap();
    const want = freeSpot(g, loc, pageX, Math.min(g.nearPx, Math.max(g.farPx, pageY)));
    if (!game.snap) followMe(); // в игре камера стоит на арене
    moveMember(meId, fracX(g, want.px), fracY(g, want.py), true, { smooth: true });
  };

  // Джойстик: идёт в сторону пальца отрезками на ~1,6 с вперёд; новый отрезок — когда сменилось направление,
  // скорость или отрезок кончается. Так движение ровное, а в канал уходит мало сообщений.
  const steer = useRef<{ ang: number; run: boolean; at: number } | null>(null);
  const onSteer = (ang: number, power: number) => {
    if (!meId || !myMover || !canWalk()) return;
    touch();
    const run = power > 0.62;
    const prev = steer.current;
    const now = Date.now();
    if (prev && prev.run === run && now - prev.at < 1100) {
      let d = Math.abs(ang - prev.ang) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d < 0.22) return;
    }
    const g = geo;
    const p = myMover.now();
    const dist = (run ? RUN_SPEED : WALK_SPEED) * g.s * 1.6;
    const tx = pxX(g, p.x) + Math.cos(ang) * dist;
    const ty = pxY(g, p.y) + (Math.sin(ang) * dist) / 1.4; // вглубь медленнее
    const want = freeSpot(g, loc, Math.min(g.worldW - g.margin, Math.max(g.margin, tx)), Math.min(g.nearPx, Math.max(g.farPx, ty)));
    steer.current = { ang, run, at: now };
    if (!game.snap) followMe();
    moveMember(meId, fracX(g, want.px), fracY(g, want.py), run);
  };
  const onSteerEnd = () => {
    steer.current = null;
    if (!meId || !myMover || !myMover.state.moving) return;
    const p = myMover.now();
    moveMember(meId, p.x, p.y, false);
  };
  useEffect(() => {
    getFlag('joystick').then((off) => setStick(!off)).catch(() => undefined);
  }, [focused]);

  // Свайп по земле — осмотреться; короткое нажатие — идти туда; щипок двумя пальцами — отдалить (видны имена)
  const pan = useRef<{ start: number; moved: boolean; x: number; y: number; multi: boolean; pinch: { d: number; z: number; world: number } | null }>({
    start: 0, moved: false, x: 0, y: 0, multi: false, pinch: null,
  });
  const goRef = useRef(goTo);
  goRef.current = goTo;
  const pinchMove = (ts: { pageX: number; pageY: number }[]) => {
    const g = geoRef.current;
    if (g.worldW <= g.width + 1 || gameRef.current.snap) return;
    const d = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
    const mid = (ts[0].pageX + ts[1].pageX) / 2;
    if (!pan.current.pinch) {
      freeCam();
      camX.stopAnimation();
      zoom.stopAnimation();
      pan.current.multi = true;
      pan.current.pinch = { d: Math.max(24, d), z: zoomRef.current, world: camRef.current + mid / zoomRef.current };
      return;
    }
    const pz = pan.current.pinch;
    const z = Math.min(1, Math.max(fitZoom(), (pz.z * d) / pz.d));
    zoomRef.current = z;
    zoom.setValue(z);
    const v = clampCam(pz.world - mid / z);
    camRef.current = v;
    camX.setValue(v);
    markZoomed(z);
  };
  const pinchRef = useRef(pinchMove);
  pinchRef.current = pinchMove;
  const zoomToRef = useRef(zoomTo);
  zoomToRef.current = zoomTo;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, gs) => Math.abs(gs.dx) > 6 || gs.numberActiveTouches > 1,
        onPanResponderGrant: (e) => {
          pan.current = { start: camRef.current, moved: false, x: e.nativeEvent.locationX, y: e.nativeEvent.locationY, multi: false, pinch: null };
        },
        onPanResponderMove: (e, gs) => {
          const ts = e.nativeEvent.touches;
          if (ts && ts.length >= 2) {
            pinchRef.current(ts as unknown as { pageX: number; pageY: number }[]);
            return;
          }
          if (pan.current.multi) return; // после щипка — до отпускания не двигаем
          if (gameRef.current.snap) return; // в игре камера стоит на арене
          if (!pan.current.moved && Math.abs(gs.dx) < 8) return;
          if (!pan.current.moved) {
            pan.current.moved = true;
            freeCam();
            pan.current.start = camRef.current;
            camX.stopAnimation((v) => {
              pan.current.start = v;
              camRef.current = v;
            });
          }
          const v = clampCam(pan.current.start - gs.dx / zoomRef.current);
          camRef.current = v;
          camX.setValue(v);
        },
        onPanResponderRelease: () => {
          if (pan.current.multi) {
            // щипок кончился: почти без отдаления — обычный вид (камера снова за мной), иначе — как оставили
            if (zoomRef.current > 0.9) zoomToRef.current(1, true);
            setTick((n) => n + 1);
            return;
          }
          if (pan.current.moved) setTick((n) => n + 1);
          else if (zoomRef.current < 0.98) zoomToRef.current(1, true); // в обзоре нажатие — вернуться к себе
          else goRef.current(pan.current.x, pan.current.y);
        },
        onPanResponderTerminate: () => setTick((n) => n + 1),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [camX, clampCam, freeCam, zoom],
  );

  const backToMe = () => {
    if (!myMover) return;
    if (zoomRef.current !== 1) zoomTo(1, true);
    else followMe();
  };

  // Игра началась — камера на арену, меню закрыть; кончилась — камера снова за мной
  const gameId = game.snap?.id;
  const hadGame = useRef(false);
  useEffect(() => {
    const gs = gameRef.current.snap;
    if (gs) {
      hadGame.current = true;
      if (gameRef.current.active) {
        setMenu(null);
        setMenuOpen(false);
        setPeople(false);
        setPicker(false);
        unzoom();
        camTo(pxX(geoRef.current, gs.cx), 700);
      }
      return;
    }
    if (hadGame.current) {
      hadGame.current = false;
      backToMe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, Boolean(game.snap)]);

  // В игре камера стоит на арене: при каждой смене фазы и размера экрана — проверить и вернуть
  const arenaPx = game.snap && game.active ? pxX(geo, game.snap.cx) : null;
  useEffect(() => {
    if (arenaPx === null) return;
    const want = clampCam(arenaPx - geoRef.current.width / 2);
    if (followRef.current || zoomRef.current !== 1 || Math.abs(camRef.current - want) > 1) {
      unzoom();
      camTo(arenaPx, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arenaPx, game.snap?.phase]);

  // Нажали на чибика во время игры: тыква — передать, звездопад — бежать туда
  const tapInGame = (m: RoomMember) => {
    const gs = game.snap;
    const st = gs?.st;
    if (!gs || gs.phase !== 'play' || !st || !meId) return;
    if (st.g === 'pumpkin') {
      if (st.holder === meId && st.phase === 'hold' && m.id !== meId && st.alive.includes(m.id)) {
        haptic.light();
        game.act({ k: 'pass', to: m.id });
      }
      return;
    }
    if (st.g === 'stars') {
      const p = movers.current.get(m.id)?.now();
      if (p) goTo(pxX(geo, p.x), pxY(geo, p.y));
    }
  };
  const nameOf = (id: string) => (id === meId ? 'Ты' : (members.find((x) => x.id === id)?.name ?? 'Кто-то'));
  const colorOf = (id: string) => (id === meId ? C.me : members.find((x) => x.id === id)?.bot ? C.good : C.partner);

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
    const cx = fracX(g, camNow() + width / 2);
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
  // ---------- грибы (лес) ----------
  const hunt = useHunt();
  const [gone, setGone] = useState<Record<number, number>>({});
  const [plucking, setPlucking] = useState(false);
  const [fly, setFly] = useState<{ n: number; c: MushColor; from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  const [chpok, setChpok] = useState<{ n: number; x: number; y: number } | null>(null);
  const forest = loc === 'forest';
  const mushrooms = useMemo(
    () =>
      ROOM_MUSHROOMS.map((m) => {
        const p = freeSpot(geo, 'forest', pxX(geo, m.fx), pxY(geo, m.fy));
        return { ...m, px: p.px, py: p.py, k: scaleAt(geo, fracY(geo, p.py)) };
      }),
    [geo],
  );

  const abilities = useMemo(
    () => [...catalog.values()].filter((it) => it.cat === 'ability' && (it.source === 'free' || inventory.has(it.id))).sort((a, b) => a.sort - b.sort),
    [catalog, inventory],
  );

  const basketTop = insets.top + 58;
  const mushSize = (k: number) => Math.round(40 * geo.s * k);
  // Нажал на гриб: бежит к нему, присаживается, срывает — гриб летит в корзинку
  const tapMushroom = (i: number) => {
    if (!meId || !myMover || playing || game.snap || plucking || hunt.checking || hunt.basket.length >= 5) return;
    if (zoomRef.current !== 1) {
      zoomTo(1, true); // в обзоре — сначала вернуться
      return;
    }
    touch();
    haptic.tap();
    followMe();
    const m = mushrooms[i];
    const me = pxX(geo, myMover.now().x);
    const dir: 1 | -1 = me <= m.px ? 1 : -1;
    const tx = m.px - dir * geo.base * m.k * 0.4;
    moveMember(meId, fracX(geo, tx), fracY(geo, m.py), true, { smooth: true, onArrive: () => pluck(i, dir) });
  };
  const pluck = (i: number, dir: 1 | -1) => {
    const id = meRef.current;
    if (!id) return;
    const m = mushrooms[i];
    setPlucking(true);
    setPoses((p) => ({ ...p, [id]: 'sit' }));
    setFaces((f) => ({ ...f, [id]: dir }));
    const up = () => {
      setPlucking(false);
      setPoses((p) => {
        if (p[id] !== 'sit') return p;
        const { [id]: _, ...rest } = p;
        return rest;
      });
    };
    later('pluck', 320, () => {
      if (gone[i] && Date.now() - gone[i] < MUSH_REGROW_MS) {
        up();
        return;
      }
      const at = Date.now();
      playSound('pluck');
      haptic.light();
      setGone((g) => ({ ...g, [i]: at }));
      later(`regrow${i}`, MUSH_REGROW_MS + 600, () => setGone((g) => (g[i] === at ? { ...g, [i]: 0 } : g)));
      const size = mushSize(m.k);
      const x = m.px - camNow();
      const y = m.py - size * 0.4;
      const slot = basketSlot(Math.min(4, hunt.basket.length));
      setChpok((c) => ({ n: (c?.n ?? 0) + 1, x: x + dir * size * 0.9, y: y - size * 0.5 })); // в сторону от чибика
      setFly((f) => ({ n: (f?.n ?? 0) + 1, c: m.c, from: { x, y }, to: { x: (width - BASKET_W) / 2 + slot.x, y: basketTop + slot.y } }));
      // убираем сами, не полагаясь на конец анимации (на Android «чпок» мог остаться висеть)
      later('chpokOff', 900, () => setChpok(null));
      later('flyOff', 800, () => setFly(null));
      later('pluckUp', 420, up);
      later('put', 560, () => {
        putMushroom(m.c, inventory.has(HAT_ID)).then((r) => {
          if (r.kind === 'hat') {
            setInventory((v) => new Set([...v, HAT_ID]));
            showHatReveal();
          } else if (r.kind === 'wrong') {
            playSound('wilt');
            showToast(r.message);
          } else if (r.kind === 'error') {
            showToast(r.message);
          } else if (r.kind === 'again') {
            playSound('ding', 0.7);
            showToast('Полная корзинка! Шляпа грибника уже у тебя');
          }
        });
      });
    });
  };

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
    return `${from} → ${to}: ${name}`; // что «Мог» отразила шляпа, покажет сама сцена
  };
  const waiting = current && !playing && !sceneReady && focused ? current : null;
  const menuMember = menu ? members.find((m) => m.id === menu) : undefined;
  const humans = members.length;
  const g = geo;

  // Кто за краем экрана — стрелка с именем
  const cam = camNow();
  const arrows = zoomed
    ? []
    : (members
        .filter((m) => m.id !== meId)
        .map((m) => {
          const mv = movers.current.get(m.id);
          if (!mv) return null;
          const p = mv.now();
          const sx = pxX(g, p.x) - cam;
          if (sx > -g.base * 0.25 && sx < width + g.base * 0.25) return null;
          return { m, side: sx < 0 ? ('L' as const) : ('R' as const), y: pxY(g, p.y) - g.base * 0.9, px: pxX(g, p.x) };
        })
        .filter(Boolean) as { m: RoomMember; side: 'L' | 'R'; y: number; px: number }[]);

  const free = !playing && !game.snap; // не идёт ни сцена, ни игра
  const stickOn = stick && !playing && !zoomed && (!game.snap || (game.snap.phase === 'play' && game.snap.st?.g === 'stars' && Boolean(meId && game.snap.players.includes(meId))));
  const stickSize = Math.round(Math.min(112, width * 0.27));
  const stickBottom = Math.max(insets.bottom, 12) + 14;
  const topY = insets.top + 8;
  const closeMenu = () => setMenuOpen(false);
  const menuItems: { key: string; icon: IconName; label: string; onPress: () => void; color?: string; hide?: boolean }[] = [
    { key: 'play', icon: 'wheel', label: game.starting ? 'Крутим…' : 'Играть', color: C.accent, onPress: () => (closeMenu(), game.play()) },
    { key: 'five', icon: 'hand', label: 'Все — пять', onPress: () => (closeMenu(), fiveAll()) },
    { key: 'people', icon: 'users', label: 'Кто здесь', onPress: () => (closeMenu(), setPeople(true)) },
    { key: 'zoom', icon: zoomed ? 'zoomIn' : 'zoomOut', label: zoomed ? 'Ближе' : 'Обзор', hide: g.worldW <= g.width + 1, onPress: () => (closeMenu(), zoomed ? zoomTo(1, true) : zoomTo(Math.max(fitZoom(), 0.5))) },
    { key: 'place', icon: 'pin', label: 'Место', onPress: () => (closeMenu(), setPicker(true)) },
    { key: 'records', icon: 'trophy', label: 'Рекорды', color: '#FFD45E', onPress: () => (closeMenu(), setRecords(true)) },
    { key: 'bot', icon: 'bot', label: busy === 'bot' ? 'Зовём…' : 'Позвать бота', color: C.good, hide: !isDevRole(access) || members.length >= (room?.capacity ?? 3), onPress: () => (closeMenu(), addBot()) },
    { key: 'leave', icon: 'exit', label: busy === 'leave' ? 'Выходим…' : 'Выйти', color: C.accent, onPress: () => (closeMenu(), leave()) },
  ];

  return (
    <NightContext.Provider value={time === 'night'}>
    <View style={[styles.root, { backgroundColor: LOCATION_BG[loc][time] }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: world }]}>
        <WideSky id={loc} width={width} height={height} time={time} />
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: g.worldW, height, transform: worldMove }}>
          <WideLand id={loc} width={width} height={height} tiles={g.tiles} time={time} active={focused} />
          <View style={StyleSheet.absoluteFill} pointerEvents={playing ? 'none' : 'auto'} {...responder.panHandlers} accessibilityLabel="Земля: нажми — твой чибик побежит туда, проведи — осмотреться, сведи два пальца — обзор" />
          {forest
            ? mushrooms.map((m, i) => (
                <MushroomPatch
                  key={`${m.c}${i}`}
                  color={m.c}
                  x={m.px}
                  y={m.py}
                  size={mushSize(m.k)}
                  night={time === 'night'}
                  goneAt={gone[i] ?? 0}
                  shake={hunt.shake}
                  zIndex={Math.round(m.py) - 1}
                  disabled={Boolean(playing || game.snap)}
                  onPress={() => tapMushroom(i)}
                />
              ))
            : null}
          {members.map((m) => {
            const mv = movers.current.get(m.id);
            if (!mv) return null;
            const isMe = m.id === meId;
            const r = reacts[m.id];
            const online = isOnline(m);
            const hidden = Boolean(playing && (playing.cast.from_member === m.id || playing.cast.to_member === m.id));
            const ga = actorGame(game.snap, m.id, game.toLocal, g.base, reduce);
            const playingNow = Boolean(game.active && game.snap?.players.includes(m.id));
            const pose = ga?.pose ?? poses[m.id] ?? (r ? 'wave' : null);
            // свой чибик не перехватывает нажатия — нажал рядом с собой, значит идёшь туда (в игре — как раньше)
            const tappable = !isMe || Boolean(game.snap);
            return (
              <RoomActor
                key={m.id}
                mover={mv}
                geo={g}
                look={lookOf({ chibi: m.chibi })}
                emotion={ga?.emotion ?? (pose || r ? 'joy' : 'calm')}
                value={ga?.value ?? (pose || r ? 80 : 40)}
                pose={pose}
                face={faces[m.id]}
                label={isMe ? `${m.name} · ты` : `${m.name} · ${m.title}`}
                dot={isMe ? C.me : m.bot ? C.good : C.partner}
                online={online || playingNow}
                hidden={hidden}
                faded={ga?.faded}
                cover={ga?.cover}
                showName={zoomed}
                unscale={unscale}
                tappable={tappable}
                a11y={isMe ? 'Это ты' : `${m.name}. Нажми — инфо, дай пять и способности`}
                onPress={() => {
                  if (playing) return;
                  if (game.snap) {
                    tapInGame(m);
                    return;
                  }
                  if (isMe) return;
                  haptic.light();
                  touch();
                  setMenu(m.id);
                }}
                over={
                  ga?.over || r ? (
                    <>
                      {ga?.over}
                      {r ? <ReactionBubble key={r.n} kind={r.k} nonce={r.n} size={Math.round(40 * Math.max(0.9, g.s))} /> : null}
                    </>
                  ) : null
                }
              />
            );
          })}
          <SparkPop trigger={sparks.n} x={sparks.x} y={sparks.y} scale={g.s * 1.2} />
          {game.snap ? <GameWorld snap={game.snap} toLocal={game.toLocal} geo={g} loc={loc} movers={movers.current} colorOf={colorOf} reduce={reduce} /> : null}
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
      {forest && chpok ? <PluckWord key={chpok.n} x={chpok.x} y={chpok.y} nonce={chpok.n} /> : null}
      {forest && fly ? <FlyingShroom key={fly.n} from={fly.from} to={fly.to} color={fly.c} nonce={fly.n} size={mushSize(1)} /> : null}
      {forest && free && !zoomed && !menuOpen ? <Basket top={basketTop} width={width} /> : null}
      {clapWord ? (
        <View pointerEvents="none" style={[styles.clapWrap, { top: height * 0.3 }]}>
          <Txt weight="display" size={34} color="#FFD45E" style={styles.clap}>
            Хлоп!
          </Txt>
        </View>
      ) : null}

      {/* мини-игра: колесо и отсчёт, игра, пьедестал */}
      {game.snap?.phase === 'wheel' ? (
        <PreGame
          key={game.snap.id}
          snap={game.snap}
          toLocal={game.toLocal}
          spinText={game.snap.host === meId ? 'Колесо крутишь ты' : `Колесо крутит ${nameOf(game.snap.host)}`}
          who={game.snap.players.map((id) => ({ id, name: nameOf(id), color: colorOf(id), note: game.snap!.bots.includes(id) ? 'бот' : 'играет' }))}
          width={width}
          top={insets.top}
          reduce={reduce}
        />
      ) : null}
      {game.snap && (game.snap.phase === 'play' || game.snap.phase === 'end') ? (
        <GameHud
          snap={game.snap}
          toLocal={game.toLocal}
          meId={meId}
          nameOf={nameOf}
          colorOf={colorOf}
          width={width}
          height={height}
          top={insets.top}
          bottom={insets.bottom}
          reduce={reduce}
          act={game.act}
        />
      ) : null}
      {game.snap?.phase === 'podium' ? (
        <Podium
          key={game.snap.id}
          snap={game.snap}
          meId={meId}
          userId={userId}
          members={members}
          catalog={catalog}
          width={width}
          height={height}
          top={insets.top}
          bottom={insets.bottom}
          busy={game.starting}
          onClose={game.close}
          onAgain={game.play}
          onRecords={() => setRecords(true)}
        />
      ) : null}

      {/* джойстик — слева внизу; кнопки сверху, внизу больше ничего нет: ходить ничто не мешает */}
      {stickOn ? (
        <Joystick size={stickSize} onSteer={onSteer} onRelease={onSteerEnd} style={{ left: 16, bottom: stickBottom + (game.snap ? 46 : 0) }} />
      ) : null}

      {menuOpen && !playing ? <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} accessibilityLabel="Закрыть меню" /> : null}

      {/* верх: назад, кто и где, одна кнопка-меню */}
      <View style={[styles.top, { top: topY }, playing ? styles.hidden : null]} pointerEvents="box-none">
        <IconButton icon="back" label="Назад — останешься в комнате" onPress={goBack} tint="rgba(24,18,40,0.66)" />
        <Pressy onPress={() => (closeMenu(), setPeople(true))} style={styles.flex} innerStyle={styles.title} scaleTo={0.97} accessibilityLabel="Кто в комнате">
          <Txt weight="display" size={15} center>
            Комната
          </Txt>
          <Txt weight="bold" size={12} center color="rgba(246,243,255,0.86)" numberOfLines={1}>
            {humans} из {room?.capacity ?? 3} · {locationName(loc)}
          </Txt>
        </Pressy>
        <Pressy
          onPress={() => setMenuOpen((v) => !v)}
          innerStyle={[styles.menuBtn, menuOpen ? styles.menuBtnOn : null]}
          scaleTo={0.92}
          accessibilityLabel={menuOpen ? 'Закрыть меню' : 'Меню: игры, реакции, место, рекорды, выход'}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} size={22} color={menuOpen ? C.onAccent : C.text} strokeWidth={2.4} />
        </Pressy>
      </View>

      {/* меню: реакции рядком, ниже — действия */}
      {menuOpen && !playing ? (
        <>
          <View style={[styles.menuCard, { top: topY + 50, width: Math.min(300, width - 32) }]}>
            {free ? (
              <View style={styles.reactRow}>
                {REACTIONS.map((k) => (
                  <Pressy
                    key={k}
                    onPress={() => {
                      if (meId) react(meId, k);
                      touch();
                      closeMenu();
                    }}
                    innerStyle={styles.reactBtn}
                    scaleTo={0.86}
                    accessibilityLabel={`Реакция: ${REACTION_LABEL[k]}`}
                  >
                    <ReactionIcon kind={k} size={26} />
                  </Pressy>
                ))}
              </View>
            ) : null}
            <View style={styles.menuGrid}>
              {menuItems
                .filter((it) => !it.hide && (free || it.key === 'leave' || it.key === 'people' || it.key === 'records'))
                .map((it) => (
                  <Pressy key={it.key} onPress={it.onPress} style={styles.menuCell} innerStyle={styles.menuItem} scaleTo={0.95} accessibilityLabel={it.label}>
                    <Icon name={it.icon} size={20} color={it.color ?? C.text} />
                    <Txt weight="heavy" size={13.5} numberOfLines={1} style={styles.flex}>
                      {it.label}
                    </Txt>
                  </Pressy>
                ))}
            </View>
          </View>
        </>
      ) : null}

      {/* камера не на мне — «К себе» под верхней панелью справа */}
      {free && (!follow || zoomed) && !menuOpen ? (
        <View style={[styles.side, { top: topY + 52 }]} pointerEvents="box-none">
          <Pressy onPress={backToMe} innerStyle={styles.sideBtn} scaleTo={0.94} accessibilityLabel="Камеру — к себе">
            <Icon name="locate" size={18} color={C.text} />
            <Txt weight="heavy" size={12.5}>
              К себе
            </Txt>
          </Pressy>
        </View>
      ) : null}

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

      {free
        ? arrows.map((a) => (
            <Pressy
              key={a.m.id}
              onPress={() => camTo(a.px)}
              style={[styles.arrow, a.side === 'L' ? { left: 6 } : { right: 6 }, { top: Math.min(height - stickBottom - stickSize - 50, Math.max(insets.top + 70 + (forest ? 62 : 0), a.y)) }]}
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

      <Toast text={toast} top={insets.top + 62 + (forest && free ? 62 : 0)} />

      {/* «инфо об игроке»: кто это, в сети ли, дай пять и способности */}
      <Sheet visible={Boolean(menuMember)} onClose={() => setMenu(null)} title={menuMember ? `${menuMember.name} · ${menuMember.title}` : ''}>
        {menuMember ? (
          <View style={styles.menu}>
            <View style={styles.menuHead}>
              <Chibi look={lookOf({ chibi: menuMember.chibi })} emotion="joy" value={50} pose="idle" size={56} still />
              <View style={styles.flex}>
                <View style={styles.onlineRow}>
                  <View style={[styles.arrowDot, { backgroundColor: isOnline(menuMember) ? C.good : '#7D7690' }]} />
                  <Txt weight="heavy" size={13.5} color={isOnline(menuMember) ? C.good : C.muted}>
                    {menuMember.bot ? `Бот${isOnline(menuMember) ? ' · в сети' : ''}` : isOnline(menuMember) ? 'В сети' : 'Не в сети'}
                  </Txt>
                </View>
                <Txt muted size={12.5}>
                  {isOnline(menuMember) ? 'Нажми на действие — твой чибик подбежит' : 'Увидит сцену, когда вернётся'}
                </Txt>
              </View>
            </View>
            <MenuRow icon="hand" color={C.text} label="Дай пять" onPress={() => giveFive(menuMember)} />
            {abilities.map((it) => {
              const left = (cooldowns[it.id] ?? 0) - Date.now();
              const info = abilityInfo(it.id);
              return <MenuRow key={it.id} icon={info.icon} color={info.color} label={it.name} note={left > 0 ? leftLabel(left) : undefined} onPress={() => cast(menuMember, it.id)} />;
            })}
            <MenuRow
              icon="locate"
              color={C.text}
              label="Показать"
              onPress={() => {
                const mv = movers.current.get(menuMember.id);
                setMenu(null);
                if (mv) camTo(pxX(geo, mv.now().x));
              }}
            />
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

      {/* «Кто здесь»: имена теперь не висят над головами — они тут, в обзоре и в «инфо» */}
      <Sheet visible={people} onClose={() => setPeople(false)} title={`Кто в комнате · ${humans} из ${room?.capacity ?? 3}`}>
        <View style={styles.menu}>
          {members.map((m) => {
            const isMe = m.id === meId;
            const on = isOnline(m);
            return (
              <Pressy
                key={m.id}
                onPress={() => {
                  setPeople(false);
                  if (isMe) backToMe();
                  else setMenu(m.id);
                }}
                innerStyle={styles.personRow}
                scaleTo={0.97}
                accessibilityLabel={`${m.name}, ${m.title}, ${on ? 'в сети' : 'не в сети'}`}
              >
                <Chibi look={lookOf({ chibi: m.chibi })} emotion={on ? 'joy' : 'calm'} value={on ? 60 : 30} pose="idle" size={40} still />
                <View style={styles.flex}>
                  <Txt weight="heavy" size={15} numberOfLines={1}>
                    {m.name}
                    {isMe ? ' · ты' : ''}
                  </Txt>
                  <Txt size={12.5} color={on ? C.good : C.faint}>
                    {m.title} · {on ? 'в сети' : 'не в сети'}
                  </Txt>
                </View>
                <View style={[styles.who, { backgroundColor: isMe ? C.me : m.bot ? C.good : C.partner }]} />
              </Pressy>
            );
          })}
        </View>
      </Sheet>

      <RecordsSheet visible={records} onClose={() => setRecords(false)} userId={userId} initial={game.snap?.game} />

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
    </NightContext.Provider>
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
  title: { alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 18, ...glass },
  menuBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', ...glass },
  menuBtnOn: { backgroundColor: C.accent, borderColor: C.accent },
  menuCard: { position: 'absolute', right: 16, padding: 10, gap: 10, borderRadius: 26, backgroundColor: 'rgba(28,23,48,0.96)', borderWidth: 1, borderColor: C.glassBorder, boxShadow: '0px 14px 34px rgba(8,5,18,0.5)' },
  reactRow: { flexDirection: 'row', justifyContent: 'space-between' },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  menuCell: { width: '48%', flexGrow: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 12, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.07)' },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 58, paddingHorizontal: 12, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)' },
  who: { width: 6, height: 26, borderRadius: 3 },
  castWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  castPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, ...glass },
  castMog: { backgroundColor: 'rgba(255,194,102,0.18)', borderColor: C.warn },
  watch: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 18, borderRadius: 23, backgroundColor: C.accent, maxWidth: 360 },
  arrow: { position: 'absolute' },
  arrowIn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 10, borderRadius: 17, backgroundColor: 'rgba(24,18,40,0.78)', borderWidth: 1.5, maxWidth: 170 },
  arrowDot: { width: 7, height: 7, borderRadius: 4 },
  side: { position: 'absolute', right: 16, alignItems: 'flex-end', gap: 8 },
  sideBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 19, ...glass },
  reactBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  clapWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  clap: { fontFamily: F.display, textShadowColor: '#2B2035', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  menu: { gap: 8 },
  menuHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 50, paddingHorizontal: 16, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.06)' },
  dimText: { opacity: 0.55 },
});
