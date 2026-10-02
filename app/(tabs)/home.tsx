// Главная: только чибики на локации. Нажатие на чибика партнёра = «Думаю о тебе».
// Справа внизу — кнопка способности; сцены способностей играют здесь (AbilityScene).
// Нажатие на землю — твой чибик идёт туда. Оба в приложении — зелёная точка у партнёра и раз в 1–2 минуты
// чибики подходят дать пять или машут издалека. Плашка с местом сверху — выбор локации.
// 0.2.2: в «Лесу с костром» растут грибы — нажал на гриб, чибик идёт и срывает его в корзинку сверху.
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AbilityButton } from '../../src/components/AbilityButton';
import { Chibi } from '../../src/components/Chibi';
import { HeartsBurst, Snore, SparkPop, Toast } from '../../src/components/Effects';
import { Face } from '../../src/components/Face';
import { Icon } from '../../src/components/Icon';
import { AbilityScene, sceneKind, worldTransform } from '../../src/components/scene/AbilityScene';
import { Location } from '../../src/components/scene/Location';
import { Basket, BASKET_W, basketSlot, FlyingShroom, MushroomPatch, PluckWord } from '../../src/components/scene/Mushrooms';
import { LocationSheet } from '../../src/components/LocationSheet';
import { IconButton, Pill, Pressy, Txt } from '../../src/components/ui';
import { Joystick } from '../../src/components/Joystick';
import { Walker } from '../../src/components/Walker';
import { useAbility } from '../../src/context/AbilityProvider';
import { usePair, useTableVersion } from '../../src/context/PairProvider';
import { fetchInventory, fetchMoods, fetchStreaks, sendNudge } from '../../src/lib/api';
import { LOOKS, lookOf } from '../../src/lib/chibi';
import { formatTime, plural, toDayKey } from '../../src/lib/dates';
import { entryMix, mixDominant } from '../../src/lib/emotions';
import { errorMessage } from '../../src/lib/env';
import type { FaceKey } from '../../src/lib/face';
import { hasOverride, setDevOverride, useDevOverride } from '../../src/lib/devOverride';
import { useAmbient } from '../../src/lib/ambient';
import { useScreenFocused } from '../../src/lib/focus';
import { useLoader } from '../../src/lib/hooks';
import { openWhatsNew, useWhatsNew } from '../../src/lib/whatsNew';
import { isLocationId, LOCATION_BG, locationName, type LocationId } from '../../src/lib/locations';
import { haptic, useReducedMotion } from '../../src/lib/motion';
import { HAT_ID, HOME_MUSHROOMS, MUSH_REGROW_MS, putMushroom, showHatReveal, useHunt, type MushColor } from '../../src/lib/mushrooms';
import { NightContext } from '../../src/lib/night';
import { canAutoplay, playSound } from '../../src/lib/sound';
import { getFlag, setFlag } from '../../src/lib/prefs';
import { dayTimeOf, sceneTransform } from '../../src/lib/scene';
import { C } from '../../src/theme';
import type { MoodEntry } from '../../src/types';

type FaceState = { emotion: FaceKey; value: number };

// Настроение человека сейчас: главная эмоция последней отметки за сегодня
function currentFace(moods: MoodEntry[], userId: string | undefined): FaceState & { has: boolean; label: string } {
  const last = moods.find((m) => m.user_id === userId);
  const top = last ? mixDominant(entryMix(last)) : null;
  return top
    ? { emotion: top.key, value: top.value, has: true, label: top.emotion.label }
    : { emotion: 'calm', value: 30, has: false, label: 'Пока без отметки' };
}

export default function HomeScreen() {
  const { me, partner, pair, lastNudgeAt, partnerOnline } = usePair();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const focused = useScreenFocused();
  const [now, setNow] = useState(() => new Date());
  const day = toDayKey(now);
  const override = useDevOverride();
  const time = override.time ?? dayTimeOf(now);
  const loc: LocationId = override.location ?? (isLocationId(pair?.location) ? pair.location : 'meadow');
  useAmbient(loc, focused);
  const version = useTableVersion('mood_entries', 'profiles', 'sleep_entries');
  const { data } = useLoader(async () => {
    const [moods, streaks] = await Promise.all([fetchMoods(day, day), fetchStreaks(day)]);
    return { moods, streaks };
  }, [day, version]);

  const [toast, setToast] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [bubble, setBubble] = useState(false);
  const [meAct, setMeAct] = useState<'wave' | 'jump' | 'love' | null>(null);
  const [picker, setPicker] = useState(false);
  const [goMe, setGoMe] = useState<{ x: number; y?: number; id: number } | null>(null);
  const [steer, setSteer] = useState<{ ang: number; run: boolean; n: number } | null>(null); // джойстик
  const steerAt = useRef(0);
  const [stick, setStick] = useState(true);
  const [goPartner, setGoPartner] = useState<{ x: number; y?: number; id: number } | null>(null);
  const [meet, setMeet] = useState<'go' | 'five' | 'wave' | null>(null);
  const [sparks, setSparks] = useState(0);
  const arrived = useRef(new Set<string>());
  const [partnerAct, setPartnerAct] = useState(false);
  const [heartsP, setHeartsP] = useState(0);
  const [heartsM, setHeartsM] = useState(0);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastSent = useRef(0);
  const mountedAt = useRef(Date.now());
  const { scene, finishScene, setHomeVisible } = useAbility();
  const reduce = useReducedMotion();
  const sceneT = useRef(new Animated.Value(0)).current;
  const [allowed, setAllowed] = useState<string | null>(null); // сцена, которую разрешили кнопкой «Смотреть»

  // Грибы в лесу: какой сорван (когда), кто сейчас срывает, гриб в полёте к корзинке
  const forest = loc === 'forest';
  const hunt = useHunt();
  const [gone, setGone] = useState<Record<number, number>>({});
  const [plucking, setPlucking] = useState<{ i: number; dir: 1 | -1 } | null>(null);
  const [fly, setFly] = useState<{ n: number; c: MushColor; from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  const [chpok, setChpok] = useState<{ n: number; x: number; y: number } | null>(null);
  const pluckGoal = useRef<{ id: number; i: number; dir: 1 | -1 } | null>(null);
  const [hasHat, setHasHat] = useState(false);
  useEffect(() => {
    if (!forest || !focused) return;
    fetchInventory()
      .then((rows) => setHasHat(rows.some((r) => r.item_id === HAT_ID)))
      .catch(() => undefined);
  }, [forest, focused]);

  // «Что нового» — само, один раз после обновления
  const news = useWhatsNew();
  useEffect(() => {
    if (focused && news.loaded && !news.seen && !news.open && me) openWhatsNew();
  }, [focused, news.loaded, news.seen, news.open, me]);

  // Плашка «Смотреть» на других экранах нужна, только пока главная не видна
  useEffect(() => {
    setHomeVisible(focused);
  }, [focused, setHomeVisible]);
  useEffect(() => () => setHomeVisible(false), [setHomeVisible]);

  const later = (key: string, ms: number, fn: () => void) => {
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, ms);
  };

  useEffect(() => {
    if (focused) getFlag('joystick').then((off) => setStick(!off)).catch(() => undefined);
  }, [focused]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    getFlag('nudgeHint').then((dismissed) => setHint(!dismissed));
    const all = timers.current;
    return () => {
      clearInterval(tick);
      Object.values(all).forEach(clearTimeout);
    };
  }, []);

  const showToast = (text: string) => {
    setToast(text);
    later('toast', 2800, () => setToast(null));
  };

  // Партнёр прислал «Думаю о тебе», пока приложение открыто
  useEffect(() => {
    if (!lastNudgeAt || lastNudgeAt < mountedAt.current) return;
    setHeartsM((n) => n + 1);
    setMeAct('love');
    setPartnerAct(true);
    showToast(`${partner?.display_name ?? 'Партнёр'} думает о тебе`);
    later('me', 2600, () => setMeAct(null));
    later('partner', 2600, () => setPartnerAct(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastNudgeAt]);

  // Оба в приложении и не спят: раз в 1–2 минуты чибики встречаются (у каждого на своём телефоне)
  const canMeet = Boolean(partner && partnerOnline && focused && !partner.sleeping_since && !me?.sleeping_since && !scene);
  useEffect(() => {
    if (!canMeet) return;
    const t = setTimeout(() => {
      if (Math.random() < 0.6) {
        const id = Date.now();
        const cx = width / 2;
        const sz = Math.round(104 * sceneTransform(width, height).s);
        arrived.current.clear();
        setMeet('go');
        const top = sceneTransform(width, height).y(534); // встречаются на одной глубине
        setGoMe({ x: cx - sz * 0.92, y: top, id });
        setGoPartner({ x: cx - sz * 0.08, y: top, id });
        later('meet', 7000, () => setMeet(null)); // не дошли — не страшно
      } else {
        setMeet('wave');
        later('meet', 2400, () => setMeet(null));
      }
    }, 60_000 + Math.random() * 60_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canMeet, meet === null, width, height]);

  const onArrive = (who: 'me' | 'partner') => () => {
    if (meet !== 'go') return;
    arrived.current.add(who);
    if (arrived.current.size < 2) return;
    setMeet('five');
    setSparks((n) => n + 1);
    haptic.light();
    later('meet', 1500, () => setMeet(null));
  };

  const tf = useMemo(() => sceneTransform(width, height), [width, height]);
  const size = Math.round(104 * tf.s);
  const chibiH = Math.round((size * 170) / 120);
  const minX = Math.max(8, tf.x(16));
  const maxX = Math.min(width - size - 8, tf.x(270));
  // Ходят и вглубь: верх чибика от дальнего края луга до ближнего (над нижней панелью)
  const minTop = tf.y(498);
  const maxTop = tf.y(590);

  if (!me) return <View style={styles.root} />;

  const moods = data?.moods ?? [];
  const myFace = currentFace(moods, me.id);
  const partnerFace = currentFace(moods, partner?.id);
  const myLook = lookOf(me);
  const partnerLook = lookOf(partner);
  const partnerSleeps = Boolean(partner?.sleeping_since);
  const meSleeps = Boolean(me.sleeping_since);
  const streak = data?.streaks.find((s) => s.user_id === me.id)?.streak ?? 0;
  const partnerName = partner?.display_name ?? 'Партнёр';

  const tapPartner = async () => {
    if (!partner) return;
    haptic.success();
    setHeartsP((n) => n + 1);
    setHint(false);
    setFlag('nudgeHint');
    if (!partnerSleeps) {
      setPartnerAct(true);
      later('partner', 2600, () => setPartnerAct(false));
    }
    if (Date.now() - lastSent.current < 3500) return; // не чаще раза в 3 секунды (так же ограничивает база)
    lastSent.current = Date.now();
    try {
      await sendNudge(me.id);
      showToast(partnerSleeps ? `${partnerName} спит — увидит утром` : `${partnerName} получит «думаю о тебе»`);
    } catch (e) {
      showToast(errorMessage(e));
    }
  };

  const tapMe = () => {
    haptic.light();
    setMeAct(!reduce && Math.random() < 0.4 ? 'jump' : 'wave');
    setBubble(true);
    later('me', 2600, () => setMeAct(null));
    later('bubble', 6000, () => setBubble(false));
  };

  // Долгое нажатие на своего чибика — гардероб
  const openWardrobe = () => {
    haptic.medium();
    router.push('/wardrobe');
  };

  // Спящие лежат на пледе; если спят оба — рядышком
  const sleepSpot = (who: 'me' | 'partner') => {
    const both = partnerSleeps && meSleeps;
    const center = both ? (who === 'partner' ? { x: 300, y: 626 } : { x: 286, y: 664 }) : { x: 292, y: 640 };
    const k = both ? 0.9 : 1;
    const w = size * k;
    const h = chibiH * k;
    return { left: tf.x(center.x) - w / 2, top: tf.y(center.y) - h / 2, w, h };
  };

  const faceFor = (face: FaceState, act: 'wave' | 'jump' | 'love' | null) =>
    act === 'wave' || act === 'jump' ? { emotion: 'joy' as FaceKey, value: 80 } : act === 'love' ? { emotion: 'love' as FaceKey, value: 72 } : face;

  // Джойстик: новый отрезок, когда сменилось направление или скорость (или раз в ~1 с — чтобы цель была впереди)
  const onSteer = (ang: number, power: number) => {
    if (meSleeps) return;
    const run = power > 0.62;
    const now = Date.now();
    if (steer && steer.run === run && now - steerAt.current < 1100) {
      let d = Math.abs(ang - steer.ang) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d < 0.22) return;
    }
    steerAt.current = now;
    if (bubble) setBubble(false);
    if (meAct) setMeAct(null);
    pluckGoal.current = null;
    setSteer({ ang, run, n: (steer?.n ?? 0) + 1 });
  };

  // Нажали на пустую землю — идём туда
  const tapGround = (pageX: number, pageY: number) => {
    if (meSleeps) return;
    haptic.tap();
    setBubble(false);
    setMeAct(null);
    setGoMe({ x: pageX - size / 2, y: pageY - chibiH, id: Date.now() });
  };
  const meetPose = meet === 'five' ? 'cheer' : meet === 'wave' ? 'wave' : null;

  // ---------- грибы ----------
  const mushSize = Math.round(40 * tf.s);
  const basketTop = insets.top + 56;
  const below = forest ? 64 : 0; // подсказки и плашки — под корзинкой
  const tapMushroom = (i: number) => {
    if (meSleeps) {
      showToast('Ты спишь — грибы подождут до утра');
      return;
    }
    if (plucking || hunt.checking || hunt.basket.length >= 5) return;
    haptic.tap();
    setBubble(false);
    setMeAct(null);
    const m = HOME_MUSHROOMS[i];
    const mx = tf.x(m.x);
    const leftSide = mx - size * 0.88 >= minX;
    const id = Date.now();
    pluckGoal.current = { id, i, dir: leftSide ? 1 : -1 };
    setGoMe({ x: leftSide ? mx - size * 0.88 : mx - size * 0.12, y: tf.y(m.y) - chibiH + 2, id });
  };
  const pluck = (i: number, dir: 1 | -1) => {
    const m = HOME_MUSHROOMS[i];
    setPlucking({ i, dir });
    later('pluck', 320, () => {
      if (gone[i] && Date.now() - gone[i] < MUSH_REGROW_MS) {
        setPlucking(null); // пока шли, сорвали — вырастет снова
        return;
      }
      const at = Date.now();
      playSound('pluck');
      haptic.light();
      setGone((g) => ({ ...g, [i]: at }));
      later(`regrow${i}`, MUSH_REGROW_MS + 600, () => setGone((g) => (g[i] === at ? { ...g, [i]: 0 } : g)));
      const x = tf.x(m.x);
      const y = tf.y(m.y) - mushSize * 0.4;
      const slot = basketSlot(Math.min(4, hunt.basket.length));
      setChpok((c) => ({ n: (c?.n ?? 0) + 1, x: x + dir * mushSize * 0.9, y: y - mushSize * 0.5 })); // в сторону от чибика
      setFly((f) => ({ n: (f?.n ?? 0) + 1, c: m.c, from: { x, y }, to: { x: (width - BASKET_W) / 2 + slot.x, y: basketTop + slot.y } }));
      // убираем сами, не полагаясь на конец анимации (на Android «чпок» мог остаться висеть)
      later('chpokOff', 900, () => setChpok(null));
      later('flyOff', 800, () => setFly(null));
      later('pluckUp', 420, () => setPlucking(null));
      later('put', 560, () => {
        putMushroom(m.c, hasHat).then((r) => {
          if (r.kind === 'hat') {
            setHasHat(true);
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

  const nameTag = (label: string, color: string, online = false) => (
    <View pointerEvents="none" style={[styles.tagWrap, { top: chibiH - 2, width: size + 80, left: -40 }]}>
      <View style={styles.tag}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Txt weight="heavy" size={12} numberOfLines={1}>
          {label}
        </Txt>
        {online ? <View style={styles.online} accessibilityLabel="сейчас в приложении" /> : null}
      </View>
    </View>
  );

  const sleeper = (who: 'me' | 'partner') => {
    const spot = sleepSpot(who);
    const isMe = who === 'me';
    const person = isMe ? me : partner;
    return (
      <View key={`sleep-${who}`} style={{ position: 'absolute', left: spot.left, top: spot.top }}>
        <Pressy
          onPress={isMe ? () => router.push('/sleep') : tapPartner}
          onLongPress={isMe ? openWardrobe : undefined}
          haptics={false}
          scaleTo={0.97}
          accessibilityLabel={isMe ? 'Это ты, ты спишь. Нажми, чтобы открыть сон' : `${partnerName} спит. Нажми — увидит «думаю о тебе» утром`}
        >
          <Chibi look={isMe ? myLook : partnerLook} emotion="calm" value={0} pose="sleep" size={spot.w} />
        </Pressy>
        <Snore x={spot.w * 0.02} y={spot.h * 0.12} scale={tf.s} />
        {!isMe ? <HeartsBurst trigger={heartsP} x={spot.w / 2} y={spot.h * 0.45} scale={tf.s} /> : null}
        <View pointerEvents="none" style={[styles.tagWrap, { top: spot.h * 0.82, width: spot.w + 120, left: -60 }]}>
          <View style={styles.tag}>
            <View style={[styles.dot, { backgroundColor: isMe ? C.me : C.partner }]} />
            <Txt weight="heavy" size={12} numberOfLines={1}>
              {isMe ? 'ты спишь' : `${partnerName} спит`}
              {person?.sleeping_since ? ` · с ${formatTime(person.sleeping_since)}` : ''}
            </Txt>
          </View>
        </View>
      </View>
    );
  };

  const pFace = faceFor(partnerFace, partnerAct ? 'love' : null);
  const mFace = faceFor(myFace, meAct);

  // Сцена идёт сразу; в браузере без единого касания звук запрещён — сначала кнопка «Смотреть»
  const sceneReady = Boolean(scene && focused && (partner || scene.dry) && (scene.from === 'me' || allowed === scene.key || canAutoplay()));
  const playing = sceneReady ? scene : null;
  const waiting = scene && focused && partner && !sceneReady ? scene : null;
  const kind = playing ? sceneKind(playing.ability) : 'hug';
  const world = playing ? worldTransform(sceneT, kind, reduce) : [];
  const meActor = { look: myLook, emotion: mFace.emotion, value: mFace.value };
  // без партнёра (проверка «вхолостую») — стоит чибик по умолчанию
  const partnerActor = { look: partner ? partnerLook : LOOKS.girl, emotion: pFace.emotion, value: pFace.value };

  return (
    <NightContext.Provider value={time === 'night'}>
    <View style={[styles.root, { backgroundColor: LOCATION_BG[loc][time] }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: world }]}>
        <Location id={loc} width={width} height={height} time={time} active={focused} />
      </Animated.View>

      {playing ? (
        <AbilityScene
          key={playing.key}
          scene={playing}
          t={sceneT}
          reduce={reduce}
          caster={playing.from === 'me' ? meActor : partnerActor}
          target={playing.from === 'me' ? partnerActor : meActor}
          width={width}
          height={height}
          size={size}
          ground={tf.y(534)}
          onDone={finishScene}
        />
      ) : null}

      {/* сцена с чибиками — свой слой (zIndex 0): их zIndex по глубине не поднимет их над кнопками */}
      <View style={[StyleSheet.absoluteFill, styles.stage, playing ? styles.hidden : null]} pointerEvents={playing ? 'none' : 'box-none'}>
      <Pressable
        style={[styles.ground, { top: tf.y(505) }]}
        onPress={(e) => tapGround(e.nativeEvent.pageX, e.nativeEvent.pageY)}
        accessibilityLabel="Земля: нажми, и твой чибик пойдёт туда"
      />
      {forest
        ? HOME_MUSHROOMS.map((m, i) => (
            <MushroomPatch
              key={`${m.c}${i}`}
              color={m.c}
              x={tf.x(m.x)}
              y={tf.y(m.y)}
              size={mushSize}
              night={time === 'night'}
              goneAt={gone[i] ?? 0}
              shake={hunt.shake}
              zIndex={Math.round(tf.y(m.y) - chibiH)}
              onPress={() => tapMushroom(i)}
            />
          ))
        : null}
      {partner && !partnerSleeps ? (
        <Walker
          look={partnerLook}
          emotion={pFace.emotion}
          value={pFace.value}
          size={size}
          top={tf.y(520)}
          minTop={minTop}
          maxTop={maxTop}
          minX={minX}
          maxX={maxX}
          startX={minX + (maxX - minX) * 0.85}
          speed={34 * tf.s}
          paused={!focused || partnerAct || meet === 'five' || meet === 'wave'}
          pose={partnerAct ? 'wave' : meetPose ?? 'idle'}
          face={meet === 'five' ? -1 : undefined}
          goTo={goPartner}
          onArrive={onArrive('partner')}
          label={`${partnerName}. Нажми — придёт «думаю о тебе»`}
          onPress={tapPartner}
        >
          <View pointerEvents="none" style={[styles.bubbleWrap, { top: -40, width: size + 140, left: -70 }]}>
            <View style={styles.moodBubble}>
              <Face emotion={partnerFace.emotion} value={partnerFace.has ? partnerFace.value : 0} size={26} />
              <Txt weight="heavy" size={12} color={C.ink} numberOfLines={1}>
                {partnerFace.label}
              </Txt>
            </View>
          </View>
          {nameTag(partnerName, C.partner, partnerOnline)}
          <HeartsBurst trigger={heartsP} x={size / 2} y={chibiH * 0.36} scale={tf.s} />
        </Walker>
      ) : null}

      {partner && partnerSleeps ? sleeper('partner') : null}
      {meSleeps ? sleeper('me') : null}

      {!meSleeps ? (
        <Walker
          look={myLook}
          emotion={mFace.emotion}
          value={mFace.value}
          size={size}
          top={tf.y(548)}
          minTop={minTop}
          maxTop={maxTop}
          minX={minX}
          maxX={maxX}
          startX={minX + (maxX - minX) * 0.15}
          speed={30 * tf.s}
          paused={!focused || meAct !== null || bubble || meet === 'five' || meet === 'wave' || plucking !== null}
          pose={plucking ? 'sit' : meAct === 'wave' ? 'wave' : meAct === 'jump' ? 'jump' : meetPose ?? 'idle'}
          face={plucking ? plucking.dir : meet === 'five' ? 1 : undefined}
          goTo={goMe}
          steer={steer}
          onArrive={(id) => {
            const p = pluckGoal.current;
            if (p && p.id === id) {
              pluckGoal.current = null;
              pluck(p.i, p.dir);
            } else onArrive('me')();
          }}
          label="Это ты. Нажми, чтобы отметить настроение; подержи — гардероб"
          onPress={tapMe}
          onLongPress={openWardrobe}
        >
          {nameTag('ты', C.me)}
          {bubble ? (
            <View pointerEvents="box-none" style={[styles.bubbleWrap, { top: -54, width: 230, left: size / 2 - 115 }]}>
              <View style={styles.askBubble}>
                <Txt weight="heavy" size={14} color={C.ink}>
                  Как ты?
                </Txt>
                <Pressy
                  onPress={() => {
                    setBubble(false);
                    router.push('/mood');
                  }}
                  innerStyle={styles.askButton}
                  accessibilityLabel="Отметить настроение"
                >
                  <Txt weight="heavy" size={13} color={C.onAccent}>
                    Отметить
                  </Txt>
                </Pressy>
              </View>
            </View>
          ) : null}
          <HeartsBurst trigger={heartsM} x={size / 2} y={chibiH * 0.36} scale={tf.s} />
        </Walker>
      ) : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.front]}>
        <SparkPop trigger={sparks} x={width / 2} y={tf.y(534) + chibiH * 0.05} scale={tf.s} />
        {forest && chpok ? <PluckWord key={chpok.n} x={chpok.x} y={chpok.y} nonce={chpok.n} /> : null}
        {forest && fly ? <FlyingShroom key={fly.n} from={fly.from} to={fly.to} color={fly.c} nonce={fly.n} size={mushSize} /> : null}
      </View>
      </View>

      <View style={[styles.topBar, { top: insets.top + 8 }, playing ? styles.hidden : null]} pointerEvents="box-none">
        <Pressy onPress={() => setPicker(true)} scaleTo={0.95} accessibilityLabel={`Место: ${locationName(loc)}. Нажми, чтобы сменить`}>
          <Pill>
            <Icon name="pin" size={17} color="#FFFFFF" />
            <Txt weight="heavy" size={13}>
              {locationName(loc)}
            </Txt>
            <Txt weight="heavy" size={13} color="rgba(255,255,255,0.8)">
              · {formatTime(now)}
            </Txt>
            <Icon name="chevronRight" size={14} color="rgba(255,255,255,0.8)" strokeWidth={2.4} />
          </Pill>
        </Pressy>
        {streak > 0 ? (
          <Pill>
            <Icon name="flame" size={17} color="#FFFFFF" fill="#FFB36B" strokeWidth={1.6} />
            <Txt weight="heavy" size={13}>
              {streak} {plural(streak, 'день', 'дня', 'дней')}
            </Txt>
          </Pill>
        ) : null}
      </View>

      {forest && !playing ? <Basket top={basketTop} width={width} /> : null}

      {hasOverride(override) && !playing ? (
        <View style={[styles.checkMode, { bottom: Math.max(insets.bottom, 10) + 6 + 68 + 96 }]}>
          <Icon name="settings" size={16} color={C.warn} />
          <Txt weight="heavy" size={13}>
            Режим проверки
          </Txt>
          <Pressy onPress={() => setDevOverride(null)} innerStyle={styles.reset} accessibilityLabel="Сбросить режим проверки">
            <Txt weight="heavy" size={12} color={C.onAccent}>
              Сбросить
            </Txt>
          </Pressy>
        </View>
      ) : null}

      {!partner ? (
        <View style={[styles.card, { top: insets.top + 56 + below }]}>
          <Txt weight="heavy" size={15}>
            Пригласи партнёра
          </Txt>
          <Txt size={14} color="rgba(255,255,255,0.85)">
            Отправь код пары — второй чибик появится здесь, как только партнёр его введёт.
          </Txt>
          {pair ? (
            <View style={styles.codeRow}>
              <Txt weight="display" size={24} color={C.accent} style={styles.code}>
                {pair.invite_code}
              </Txt>
              <IconButton
                icon="share"
                label="Поделиться кодом"
                onPress={() =>
                  Share.share({ message: `Давай вести общий дневник в «Двое». Мой код пары: ${pair.invite_code}` }).catch(() => undefined)
                }
              />
            </View>
          ) : null}
        </View>
      ) : hint && !partnerSleeps && !toast && !playing && !waiting ? (
        <View style={[styles.hint, { top: insets.top + 56 + below }]}>
          <View style={styles.hintIcon}>
            <Icon name="heart" size={18} color={C.accent} fill={C.accent} />
          </View>
          <Txt weight="bold" size={14} style={styles.flex}>
            Нажми на второго чибика — {partnerName} получит «думаю о тебе»
          </Txt>
          <IconButton
            icon="close"
            label="Скрыть подсказку"
            size={38}
            tint="transparent"
            onPress={() => {
              setHint(false);
              setFlag('nudgeHint');
            }}
          />
        </View>
      ) : null}

      {waiting ? (
        <View style={[styles.watchWrap, { top: insets.top + 56 + below }]}>
          <Pressy
            onPress={() => setAllowed(waiting.key)}
            innerStyle={styles.watch}
            accessibilityLabel={`${partnerName} применяет способность. Смотреть`}
          >
            <Icon name="sparkle" size={20} color={C.onAccent} fill={C.onAccent} />
            <Txt weight="heavy" size={15} color={C.onAccent}>
              {partnerName}: {waiting.ability === 'ability.mog' ? '«Мог»' : 'объятия'} — смотреть
            </Txt>
          </Pressy>
        </View>
      ) : null}

      {!playing && stick && !meSleeps ? (
        <Joystick
          size={Math.round(Math.min(100, width * 0.25))}
          onSteer={onSteer}
          onRelease={() => setSteer(null)}
          style={{ left: 16, bottom: Math.max(insets.bottom, 10) + 6 + 68 + 14 }}
        />
      ) : null}

      {!playing ? <AbilityButton onMessage={showToast} busy={Boolean(scene)} /> : null}

      <Toast text={toast} top={insets.top + 58 + below} />
      <LocationSheet visible={picker} onClose={() => setPicker(false)} current={loc} time={time} onError={showToast} />
    </View>
    </NightContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#6FB7F5', overflow: 'hidden' },
  hidden: { opacity: 0 },
  front: { zIndex: 5000 },
  stage: { zIndex: 0 },
  ground: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  online: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.good, marginLeft: 2 },
  checkMode: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingLeft: 12,
    paddingRight: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(24,18,40,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,194,102,0.5)',
  },
  reset: { height: 28, paddingHorizontal: 12, borderRadius: 14, backgroundColor: C.warn, justifyContent: 'center' },
  watchWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  watch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: C.accent,
    boxShadow: '0px 10px 26px rgba(255,107,138,0.4)',
  },
  flex: { flex: 1 },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tagWrap: { position: 'absolute', alignItems: 'center' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(24,18,40,0.56)',
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  bubbleWrap: { position: 'absolute', alignItems: 'center' },
  moodBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 11,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  askBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 8px 20px rgba(20,10,40,0.22)',
  },
  askButton: { height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.accent, justifyContent: 'center' },
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: 16,
    gap: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(24,18,40,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { letterSpacing: 4 },
  hint: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 4,
    borderRadius: 22,
    backgroundColor: 'rgba(24,18,40,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  hintIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,138,0.3)',
  },
});
