// Чибик 3.0: основа (кожа, руки, ноги, голова) + надетые вещи из каталога, слоями SVG.
// Пропорции и переносы слоёв вещей на новое тело — src/lib/body.ts; мягкий контур и объём — src/lib/artStyle.ts.
// Сзади вперёд: спина, волосы сзади, ноги, тело и шея, руки с предметом, голова, лицо, волосы спереди, шляпа, нимб.
// Анимируются только слои целиком (трансформации на native driver) — дёшево даже на слабых телефонах.
// Стоящий чибик раз в 8–15 с сам что-то делает: оглядывается, потягивается или подпрыгивает.
// 0.2.2: шляпа может покачиваться (meta.anim = 'sway' у шляпы), ночью от неё летят споры (meta.spores).
// 3.0: голова живёт отдельно от тела (кивает при дыхании, отстаёт на шаге), прыжок — со сжатием и растяжением,
// нога на шаге уходит вбок, волосы и плащ качаются сильнее.
import { memo, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { saw, tri } from '../lib/anim';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, Ellipse, G, Rect } from 'react-native-svg';
import { renderLayer, type Paint, type Zone } from '../lib/art';
import {
  armArt,
  armBase,
  blanketArt,
  FEET_Y,
  handShift,
  headArt,
  headX,
  headY,
  HIP,
  HS,
  LEG,
  legArt,
  legTransform,
  mogArt,
  neckArt,
  pillowArt,
  SHOE_SPLIT,
  shoeTopTransform,
  SHOULDER,
  T_BLANKET,
  T_TORSO,
  torsoY,
  type Sleeve,
} from '../lib/body';
import { useCatalog } from '../lib/catalog';
import { dress, type Look, type WearCat, type Worn } from '../lib/chibi';
import { type FaceKey } from '../lib/face';
import { useScreenFocused } from '../lib/focus';
import { nativeDriver, useReducedMotion } from '../lib/motion';
import { useNight } from '../lib/night';
import { CLOTH } from '../lib/palette';
import { NEW_EYES } from '../lib/eyes';
import { Face, type EyeStyle } from './Face';

export type ChibiPose = 'idle' | 'walk' | 'run' | 'wave' | 'hug' | 'reach' | 'cheer' | 'jump' | 'fallen' | 'sleep' | 'sit';

type Props = {
  look: Look;
  emotion: FaceKey;
  value: number;
  pose: ChibiPose;
  size: number; // ширина, высота = size × 170/120 (крылья, нимб и шарик выходят за рамку)
  gaze?: number; // куда смотрят глаза (сдвиг по горизонтали)
  flip?: boolean;
  mog?: boolean; // тени-скулы для сцены «Мог»
  eyesClosed?: boolean;
  still?: boolean; // без анимаций: плитки, превью
  // Что рисовать (плитки гардероба): 'head' — без тени, ног, рук и спины, 'upper' — без тени, 'legs' — без головы и спины.
  // Каждый слой — отдельная картинка в памяти; то, что плитка всё равно обрезает, не рисуем.
  part?: 'all' | 'head' | 'upper' | 'legs';
};

// Холст слоя чуть больше рамки 120×170; у крыльев, нимба и предметов в руках — большой,
// чтобы ничего не обрезалось. Большой холст дороже по памяти, поэтому только там, где нужен.
const CANVAS = {
  small: { x: -12, y: -14, w: 144, h: 188 },
  big: { x: -30, y: -40, w: 200, h: 224 },
};

// Порядок вещей внутри одного слоя рисунка
const ORDER: WearCat[] = ['back', 'hair', 'hat', 'face', 'top', 'bottom', 'shoes', 'hand'];
const EYE_STYLES = new Set<EyeStyle>(['classic', 'lashes', 'sparkle', 'sleepy', 'azure', ...NEW_EYES]);

// Слой в координатах тела
function Layer({ k, big = false, children }: { k: number; big?: boolean; children: ReactNode }) {
  const c = big ? CANVAS.big : CANVAS.small;
  return (
    <Svg width={c.w * k} height={c.h * k} viewBox={`${c.x} ${c.y} ${c.w} ${c.h}`} style={[styles.layer, { left: c.x * k, top: c.y * k }]}>
      {children}
    </Svg>
  );
}

// Слой в координатах головы: тот же рисунок, но меньше и прижат к макушке (см. body.ts)
function HeadLayer({ k, big = false, children }: { k: number; big?: boolean; children: ReactNode }) {
  const c = big ? CANVAS.big : CANVAS.small;
  return (
    <Svg
      width={c.w * k * HS}
      height={c.h * k * HS}
      viewBox={`${c.x} ${c.y} ${c.w} ${c.h}`}
      style={[styles.layer, { left: headX(c.x) * k, top: headY(c.y) * k }]}
    >
      {children}
    </Svg>
  );
}

// Слой, который поворачивается или сдвигается целиком
function Moving({ transform, children }: { transform: object[]; children: ReactNode }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: transform as any }]}>{children}</Animated.View>;
}

type Num = Animated.AnimatedInterpolation<number> | Animated.AnimatedAddition<number> | Animated.Value;
const deg = (n: Num) => n.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });

function ChibiView({ look, emotion, value, pose, size, gaze, flip = false, mog = false, eyesClosed = false, still = false, part = 'all' }: Props) {
  const reduce = useReducedMotion();
  const visible = useScreenFocused();
  const catalog = useCatalog();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const k = size / 120;
  const w = size;
  const h = Math.round((size * 170) / 120);
  const sleep = pose === 'sleep';
  const fallen = pose === 'fallen';

  const dressed = useMemo(() => dress(look, catalog), [look, catalog]);
  const worn = dressed.worn;
  const top = worn.top;
  const hover = !sleep && ORDER.some((c) => worn[c]?.item.meta.hover);
  // Шляпа качается целиком (со своим верхним слоем); иначе верхний слой шляпы — нимб, он парит отдельно
  const hatSway = !sleep && worn.hat?.item.meta.anim === 'sway';
  const halo = Boolean(worn.hat?.item.art.layers?.over) && !hatSway;
  const night = useNight();
  const eyeStyle: EyeStyle = EYE_STYLES.has(worn.eyes?.item.meta.style as EyeStyle) ? (worn.eyes!.item.meta.style as EyeStyle) : 'classic';

  // ---------- рисунок слоёв (пересобирается только при смене образа) ----------
  const art = useMemo(() => {
    const skin = dressed.skin;
    const hidden = new Set<WearCat>();
    if (top?.item.meta.coversBottom) hidden.add('bottom');
    if (sleep) ['back', 'face', 'hand'].forEach((c) => hidden.add(c as WearCat));
    const items = ORDER.map((c) => (hidden.has(c) ? undefined : worn[c])).filter(Boolean) as Worn[];
    // id градиентов — свои у каждого чибика, вещи, цвета и слоя (в браузере id общие на всю страницу)
    const paint = (it: Worn, name: string): Paint => ({ c: it.color, skin, ids: `${uid}${it.item.id.replace('.', '')}${it.color.slice(1)}${name}` });
    const layer = (name: string, zone: Zone = 'body') =>
      items.flatMap((it) => renderLayer(it.item.art.layers?.[name], paint(it, name), `${it.item.id}.${name}`, zone));
    const has = (name: string) => items.some((it) => it.item.art.layers?.[name]);
    const base = (src: string, name: string, zone: Zone = 'body', c = skin) => renderLayer(src, { c, skin, ids: `${uid}b${name}${skin.slice(1)}${c.slice(1)}` }, `base.${name}`, zone);

    const leg = (side: 'L' | 'R') => {
      const shoe = `shoe${side}`;
      return (
        <>
          {has(`leg${side}`) ? <G transform={legTransform(side)}>{layer(`leg${side}`)}</G> : base(legArt(side), `leg${side}`)}
          {has(shoe) ? (
            <>
              <Defs>
                <ClipPath id={`${uid}st${side}`}>
                  <Rect x={-40} y={-60} width={200} height={SHOE_SPLIT + 60} />
                </ClipPath>
                <ClipPath id={`${uid}sb${side}`}>
                  <Rect x={-40} y={SHOE_SPLIT} width={200} height={80} />
                </ClipPath>
              </Defs>
              {/* голенище и чулок тянутся вверх вместе с ногой, сам ботинок остаётся как был */}
              <G transform={shoeTopTransform(side)}>
                <G clipPath={`url(#${uid}st${side})`}>{layer(shoe)}</G>
              </G>
              <G clipPath={`url(#${uid}sb${side})`}>{layer(shoe)}</G>
            </>
          ) : null}
        </>
      );
    };

    const sleeveKey = top?.item.meta.sleeveColor;
    const sleeveCol = sleeveKey && CLOTH[sleeveKey] ? CLOTH[sleeveKey][1] : top?.color ?? skin;
    const sleeve: Sleeve = !top ? 'none' : top.item.meta.sleeve === 'short' ? 'short' : 'full';
    const cuff = typeof top?.item.meta.cuff === 'string' ? top.item.meta.cuff : null;
    const arm = (side: 'L' | 'R') => {
      const [limb, hand] = armArt(side, sleeve, cuff);
      const held = side === 'L' ? 'handL' : 'handR';
      return (
        <G transform={armBase(side)}>
          {base(limb, `arm${side}`, 'body', sleeveCol)}
          {has(held) ? <G transform={handShift(side)}>{layer(held)}</G> : null}
          {base(hand, `hand${side}`)}
        </G>
      );
    };

    // Живые слои 0.2.1: спина одной вещи качается, слои *Fx мерцают
    const swayer = items.find((it) => it.item.meta.anim === 'sway' && it.item.art.layers?.back);
    const rest = items.filter((it) => it !== swayer);
    const backOf = (it: Worn, key: string) => renderLayer(it.item.art.layers?.back, paint(it, 'back'), `${it.item.id}.${key}`);
    const stillBack = rest.some((it) => it.item.art.layers?.back) ? <G transform={T_TORSO}>{rest.flatMap((it) => backOf(it, 'back'))}</G> : null;
    const pv = swayer?.item.meta.pivot;
    const hp = worn.hat?.item.meta.pivot;
    return {
      handL: has('handL'),
      handR: has('handR'),
      back: stillBack,
      sway: swayer ? <G transform={T_TORSO}>{backOf(swayer, 'sway')}</G> : null,
      pivot: (Array.isArray(pv) && pv.length === 2 ? pv : [60, 100]) as [number, number],
      backFx: has('backFx') ? <G transform={T_TORSO}>{layer('backFx')}</G> : null,
      handFx: has('handFx') ? (
        <G transform={armBase('R')}>
          <G transform={handShift('R')}>{layer('handFx')}</G>
        </G>
      ) : null,
      fxKind: items.find((it) => it.item.art.layers?.backFx || it.item.art.layers?.handFx)?.item.meta.anim === 'pulse' ? 'pulse' : 'flicker',
      hairBack: has('hairBack') ? layer('hairBack', 'head') : null,
      legL: leg('L'),
      legR: leg('R'),
      body: (
        <>
          <G transform={T_TORSO}>
            {layer('under')}
            {layer('body')}
            {layer('front')}
          </G>
          {base(neckArt, 'neck')}
        </>
      ),
      armL: arm('L'),
      armR: arm('R'),
      head: base(headArt, 'head', 'head'),
      pillow: base(pillowArt, 'pillow', 'head'),
      blanket: <G transform={T_BLANKET}>{base(blanketArt, 'blanket')}</G>,
      front: (
        <>
          {layer('mask', 'head')}
          {mog ? base(mogArt, 'mog', 'head') : null}
          {layer('hairFront', 'head')}
          {sleep || hatSway ? null : layer('hat', 'head')}
        </>
      ),
      hat: hatSway ? (
        <>
          {layer('hat', 'head')}
          {layer('over', 'head')}
        </>
      ) : null,
      hatPivot: (Array.isArray(hp) && hp.length === 2 ? hp : [60, 40]) as [number, number],
      over: has('over') && !hatSway ? layer('over', 'head') : null,
    };
  }, [dressed, worn, top, sleep, mog, uid, hatSway]);

  // ---------- анимации ----------
  const cycle = useRef(new Animated.Value(0)).current; // шаг: 0→1 по кругу
  const breath = useRef(new Animated.Value(0)).current;
  const flap = useRef(new Animated.Value(0)).current; // крылья, нимб, парение
  const wave = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current; // прыжок
  const swayV = useRef(new Animated.Value(0)).current; // плащ, шарф, хвост
  const fx = useRef(new Animated.Value(1)).current; // мерцание огоньков
  const stretch = useRef(new Animated.Value(0)).current; // потягивается
  const spore = useRef(new Animated.Value(0)).current; // споры над шляпой: 0→1 по кругу
  const [glance, setGlance] = useState(0); // оглядывается

  const animate = !still && !reduce && visible && !fallen;
  const moving = pose === 'walk' || pose === 'run';
  const floaty = hover || halo;
  const hasSway = Boolean(art.sway || art.hat);
  const spores = animate && night && !sleep && worn.hat?.item.meta.spores === true;
  const hasFx = Boolean(art.backFx || art.handFx);
  const fxKind = art.fxKind;
  // Крылья машут, только если парение — от крыльев (не от метлы или ранца)
  const flapWings = Boolean(worn.back?.item.meta.hover) && !worn.back?.item.meta.anim;

  useEffect(() => {
    swayV.setValue(0);
    fx.setValue(1);
    if (!animate) return;
    const loops: Animated.CompositeAnimation[] = [];
    const tm = (v: Animated.Value, toValue: number, duration: number, easing = Easing.inOut(Easing.sin)) =>
      Animated.timing(v, { toValue, duration, easing, useNativeDriver: nativeDriver });
    if (hasSway) loops.push(Animated.loop(Animated.sequence([tm(swayV, 1, moving ? 420 : 1300), tm(swayV, -1, moving ? 420 : 1300)])));
    if (hasFx) {
      loops.push(
        fxKind === 'pulse'
          ? Animated.loop(Animated.sequence([tm(fx, 0.5, 1100), tm(fx, 1, 1100)]))
          : Animated.loop(Animated.sequence([tm(fx, 0.55, 90, Easing.linear), tm(fx, 0.95, 120, Easing.linear), tm(fx, 0.5, 80, Easing.linear), tm(fx, 1, 140, Easing.linear), tm(fx, 0.8, 110, Easing.linear)])),
      );
    }
    loops.forEach((a) => a.start());
    return () => loops.forEach((a) => a.stop());
  }, [animate, hasSway, hasFx, fxKind, moving, swayV, fx]);

  useEffect(() => {
    spore.setValue(0);
    if (!spores) return;
    const loop = Animated.loop(Animated.timing(spore, { toValue: 1, duration: 4200, easing: Easing.linear, useNativeDriver: nativeDriver }));
    loop.start();
    return () => loop.stop();
  }, [spores, spore]);

  useEffect(() => {
    [cycle, breath, flap, wave, hop, stretch].forEach((v) => v.setValue(0));
    if (!animate) return;
    const timing = (v: Animated.Value, toValue: number, duration: number, easing = Easing.linear) =>
      Animated.timing(v, { toValue, duration, easing, useNativeDriver: nativeDriver });
    const swing = (v: Animated.Value, half: number, easing: (t: number) => number) =>
      Animated.loop(Animated.sequence([timing(v, 1, half, easing), timing(v, 0, half, easing)]));
    const loops: Animated.CompositeAnimation[] = [];
    if (moving) loops.push(Animated.loop(timing(cycle, 1, pose === 'run' ? 380 : 580)));
    else loops.push(swing(breath, sleep ? 2000 : 1600, Easing.inOut(Easing.sin)));
    if (pose === 'wave') loops.push(swing(wave, 420, Easing.inOut(Easing.quad)));
    // объятия — руки чуть сжимают и отпускают; тянется — руки подрагивают навстречу
    if (pose === 'hug') loops.push(swing(wave, 620, Easing.inOut(Easing.sin)));
    if (pose === 'reach') loops.push(swing(wave, 260, Easing.inOut(Easing.sin)));
    if (pose === 'jump') {
      loops.push(
        Animated.loop(
          Animated.sequence([timing(hop, 1, 280, Easing.out(Easing.quad)), timing(hop, 0, 300, Easing.in(Easing.quad)), Animated.delay(320)]),
        ),
      );
    }
    if (floaty && !sleep) loops.push(Animated.loop(timing(flap, 1, 1400)));
    loops.forEach((a) => a.start());
    return () => loops.forEach((a) => a.stop());
  }, [animate, pose, moving, sleep, floaty, cycle, breath, flap, wave, hop, stretch]);

  // Сам по себе: раз в 8–15 секунд оглядывается, потягивается или подпрыгивает
  useEffect(() => {
    if (!animate || pose !== 'idle') return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = (fn: () => void, ms: number) => {
      timer = setTimeout(() => alive && fn(), ms);
    };
    const schedule = () => later(act, 8000 + Math.random() * 7000);
    const act = () => {
      const r = Math.random();
      const done = ({ finished }: { finished: boolean }) => {
        if (alive && finished) schedule();
      };
      const t = (v: Animated.Value, to: number, ms: number, easing: (x: number) => number) =>
        Animated.timing(v, { toValue: to, duration: ms, easing, useNativeDriver: nativeDriver });
      if (r < 0.4) {
        setGlance(-4);
        later(() => {
          setGlance(4);
          later(() => {
            setGlance(0);
            schedule();
          }, 800);
        }, 800);
      } else if (r < 0.7) {
        Animated.sequence([t(stretch, 1, 520, Easing.out(Easing.quad)), Animated.delay(380), t(stretch, 0, 480, Easing.inOut(Easing.quad))]).start(done);
      } else {
        Animated.sequence([t(hop, 1, 240, Easing.out(Easing.quad)), t(hop, 0, 260, Easing.in(Easing.quad))]).start(done);
      }
    };
    schedule();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      stretch.stopAnimation();
      hop.stopAnimation();
      stretch.setValue(0);
      hop.setValue(0);
      setGlance(0);
    };
  }, [animate, pose, stretch, hop]);

  const t = useMemo(() => {
    const run = pose === 'run';
    const c = (n: number) => new Animated.Value(n);
    const add = (...xs: Num[]) => xs.reduce((a, b) => Animated.add(a, b) as Animated.AnimatedAddition<number>);
    // поворот слоя вокруг точки рисунка (px, py): центр слоя — точка (60, 85)
    const around = (px: number, py: number, rest: object[]) => [
      { translateX: (px - 60) * k },
      { translateY: (py - 85) * k },
      ...rest,
      { translateX: -(px - 60) * k },
      { translateY: -(py - 85) * k },
    ];
    // то же — для точки, заданной в координатах головы
    const aroundHead = (px: number, py: number, rest: object[]) => around(headX(px), headY(py), rest);

    // корпус: покачивание при ходьбе, дыхание, прыжок, парение
    const bob = moving
      ? cycle.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -(run ? 4 : 2.6) * k, 0, -(run ? 4 : 2.6) * k, 0] })
      : breath.interpolate({ inputRange: [0, 1], outputRange: [0, -1.1 * k] });
    const lift = hover ? flap.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-9 * k, -12 * k, -9 * k] }) : c(0);
    const rootY = add(bob, hop.interpolate({ inputRange: [0, 1], outputRange: [0, -16 * k] }), lift);
    const sway = moving
      ? cycle.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: run ? ['8deg', '6deg', '8deg', '10deg', '8deg'] : ['0deg', '-2.4deg', '0deg', '2.4deg', '0deg'],
        })
      : '0deg';
    // прыжок: у земли чибик приседает, в воздухе вытягивается; потягивание — чуть выше ростом
    const tall = Animated.multiply(
      stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }),
      hop.interpolate({ inputRange: [0, 0.22, 1], outputRange: [1, 0.94, 1.05] }),
    );
    const wide = hop.interpolate({ inputRange: [0, 0.22, 1], outputRange: [1, 1.05, 0.97] });
    // сидит (в комнате — кто закрыл приложение; на главной — срывает гриб): корпус ниже, ноги поджаты
    const sit = pose === 'sit';
    const sitDrop = (FEET_Y - LEG.top) * 0.56 * k;
    const root = fallen
      ? [{ translateX: 47 * k }, { translateY: -40 * k }, ...around(60, 156, [{ rotate: '-90deg' }])]
      : [{ translateY: sit ? add(rootY, c(sitDrop)) : rootY }, ...around(60, FEET_Y, [{ rotate: sway }, { scaleY: tall }, { scaleX: wide }])];

    // ноги: на шаге нога поднимается и чуть уходит вбок (коленом наружу)
    const lf = run ? 8 : 5.5;
    const out = run ? 9 : 6;
    const step = (phase: 0 | 0.5) =>
      moving
        ? cycle.interpolate({
            inputRange: phase === 0 ? [0, 0.25, 0.5, 1] : [0, 0.5, 0.75, 1],
            outputRange: phase === 0 ? [0, -lf * k, 0, 0] : [0, 0, -lf * k, 0],
          })
        : c(0);
    const knee = (phase: 0 | 0.5, dir: 1 | -1) =>
      moving
        ? cycle.interpolate({
            inputRange: phase === 0 ? [0, 0.25, 0.5, 1] : [0, 0.5, 0.75, 1],
            outputRange: (phase === 0 ? [0, dir * out, 0, 0] : [0, 0, dir * out, 0]).map((d) => `${d}deg`),
          })
        : '0deg';
    const legPose = (side: 'L' | 'R') =>
      sit
        ? around(60, LEG.top, [{ scaleY: 0.44 }])
        : [{ translateY: step(side === 'L' ? 0 : 0.5) }, ...around(HIP[side].x, HIP[side].y, [{ rotate: knee(side === 'L' ? 0 : 0.5, side === 'L' ? 1 : -1) }])];

    // руки: поза + размах при ходьбе + взмах + потягивание + прыжок
    // reach — тянется к тому, кто справа (у отражённого — слева): ближняя рука вперёд, дальняя чуть вверх
    const baseL = pose === 'hug' ? 70 : pose === 'reach' ? 28 : pose === 'cheer' ? 140 : 0;
    const baseR = pose === 'hug' ? -70 : pose === 'reach' ? -92 : pose === 'cheer' ? -140 : pose === 'wave' && !animate ? -114 : 0;
    const amp = run ? 34 : 13;
    const swingL = moving ? cycle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [amp, -amp, amp] }) : c(0);
    const swingR = moving ? cycle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-amp, amp, -amp] }) : c(0);
    const waveR =
      pose === 'wave' && animate
        ? wave.interpolate({ inputRange: [0, 1], outputRange: [-100, -128] })
        : (pose === 'hug' || pose === 'reach') && animate
          ? wave.interpolate({ inputRange: [0, 1], outputRange: pose === 'hug' ? [0, -14] : [0, -9] })
          : c(0);
    const hugL = (pose === 'hug' || pose === 'reach') && animate ? wave.interpolate({ inputRange: [0, 1], outputRange: pose === 'hug' ? [0, 14] : [0, 6] }) : c(0);
    // на вдохе руки едва расходятся — стоящий чибик не «деревянный»
    const breathL = moving ? c(0) : breath.interpolate({ inputRange: [0, 1], outputRange: [0, 2.2] });
    const breathR = moving ? c(0) : breath.interpolate({ inputRange: [0, 1], outputRange: [0, -2.2] });
    const armL = add(c(baseL), swingL, hugL, breathL, stretch.interpolate({ inputRange: [0, 1], outputRange: [0, 150] }), hop.interpolate({ inputRange: [0, 1], outputRange: [0, 46] }));
    const armR = add(c(baseR), swingR, waveR, breathR, stretch.interpolate({ inputRange: [0, 1], outputRange: [0, -150] }), hop.interpolate({ inputRange: [0, 1], outputRange: [0, -46] }));

    // голова: на шаге отстаёт от корпуса и остаётся ровнее, при дыхании кивает, в прыжке запрокидывается
    const neckY = 104;
    const headRot = moving
      ? cycle.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: run ? ['-4deg', '-2.6deg', '-4deg', '-5.4deg', '-4deg'] : ['0deg', '1.7deg', '0deg', '-1.7deg', '0deg'],
        })
      : pose === 'wave' || pose === 'cheer'
        ? wave.interpolate({ inputRange: [0, 1], outputRange: ['-2.5deg', '3deg'] })
        : breath.interpolate({ inputRange: [0, 1], outputRange: ['-0.9deg', '0.9deg'] });
    const headY2 = add(
      moving ? cycle.interpolate({ inputRange: [0, 0.125, 0.375, 0.625, 0.875, 1], outputRange: [0, 0.9 * k, -0.9 * k, 0.9 * k, -0.9 * k, 0] }) : breath.interpolate({ inputRange: [0, 1], outputRange: [0.5 * k, -0.6 * k] }),
      hop.interpolate({ inputRange: [0, 0.22, 1], outputRange: [0, 1.6 * k, -1.2 * k] }),
    );

    // волосы сзади качаются
    const hair = moving
      ? cycle.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: run ? ['0deg', '4.2deg', '0deg', '-4.2deg', '0deg'] : ['0deg', '2.6deg', '0deg', '-2.6deg', '0deg'] })
      : breath.interpolate({ inputRange: [0, 1], outputRange: ['-0.7deg', '1.1deg'] });

    // тень: уменьшается, когда чибик в воздухе
    const shadow = Animated.multiply(
      hop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.66] }),
      hover ? flap.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.9, 1] }) : c(1),
    );

    return {
      root,
      legL: legPose('L'),
      legR: legPose('R'),
      armL: around(SHOULDER.L.x, SHOULDER.L.y, [{ rotate: deg(armL) }]),
      armR: around(SHOULDER.R.x, SHOULDER.R.y, [{ rotate: deg(armR) }]),
      head: [{ translateY: headY2 }, ...aroundHead(60, neckY, [{ rotate: headRot }])],
      hair: aroundHead(60, 40, [{ rotate: hair }]),
      sway: around(art.pivot[0], torsoY(art.pivot[1]), [{ rotate: swayV.interpolate({ inputRange: [-1, 1], outputRange: moving ? ['-7deg', '7deg'] : ['-3.4deg', '3.4deg'] }) }]),
      hat: aroundHead(art.hatPivot[0], art.hatPivot[1], [{ rotate: swayV.interpolate({ inputRange: [-1, 1], outputRange: moving ? ['-4deg', '4deg'] : ['-2.2deg', '2.2deg'] }) }]),
      wings: around(60, torsoY(104), [{ scaleX: flap.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 0.84, 1, 0.84, 1] }) }]),
      halo: [
        { translateY: flap.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -1.8 * k, 0] }) },
        ...aroundHead(60, 0, [{ rotate: flap.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['0deg', '3deg', '0deg', '-3deg', '0deg'] }) }]),
      ],
      shadow: around(60, 157, [{ scale: shadow }]),
      sleep: [{ translateY: breath.interpolate({ inputRange: [0, 1], outputRange: [0, -1.2 * k] }) }],
    };
  }, [k, pose, moving, fallen, hover, animate, cycle, breath, flap, wave, hop, stretch, swayV, art.pivot, art.hatPivot]);

  // Споры: пять светящихся точек поднимаются от шляпки и гаснут
  const sporeDots = useMemo(
    () =>
      spores
        ? [0, 0.21, 0.43, 0.62, 0.81].map((off, i) => {
            const p = saw(spore, off, 0, 1);
            return {
              key: i,
              left: headX(22 + i * 19) * k,
              top: headY(4 + (i % 2) * 8) * k,
              r: (i % 2 ? 1.8 : 2.3) * k,
              color: ['#C9FFB0', '#FFF4C2', '#D9C4FF'][i % 3],
              opacity: p.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 0.95, 0.6, 0] }),
              transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, -40 * k] }) }, { translateX: tri(spore, off * 2, -5 * k, 5 * k) }],
            };
          })
        : [],
    [spores, spore, k],
  );

  const face = (
    <View style={{ position: 'absolute', left: headX(12.5) * k, top: headY(24.5) * k }}>
      <Face
        emotion={sleep ? 'sleep' : emotion}
        value={sleep ? 100 : value}
        size={95 * k * HS}
        bare
        eyes={eyeStyle === 'azure' ? 1.5 : 1.3}
        look={(gaze ?? (moving ? 2.5 : 0)) + glance}
        blink={!sleep && !eyesClosed && !still && visible}
        closed={eyesClosed}
        eyeStyle={eyeStyle}
        eyeColor={worn.eyes?.color}
        skin={dressed.skin}
        blushMin={0.18}
      />
    </View>
  );

  // Спит под пледом: шляпа, предмет в руке, спина и бандана прячутся; волосы и нимб остаются
  if (sleep) {
    return (
      <View pointerEvents="none" style={{ width: w, height: h, transform: [{ rotate: '-90deg' }, { scaleX: flip ? -1 : 1 }] }}>
        <Moving transform={t.sleep}>
          <HeadLayer k={k}>
            {art.pillow}
            {art.hairBack}
            {art.head}
          </HeadLayer>
          {face}
          <Layer k={k}>{art.blanket}</Layer>
          <HeadLayer k={k} big>
            {art.front}
            {art.over}
          </HeadLayer>
        </Moving>
      </View>
    );
  }

  const bust = part === 'head';
  const noHead = part === 'legs';
  const noBack = bust || noHead;
  return (
    <View pointerEvents="none" style={{ width: w, height: h, transform: [{ scaleX: flip ? -1 : 1 }] }}>
      {part === 'all' || noHead ? (
        <Moving transform={t.shadow}>
          <Layer k={k}>
            {/* тень — прямо под подошвами (низ обуви — 156,5), а не ниже: иначе чибик будто висит над ней */}
            <Ellipse cx={60} cy={hover ? 160 : FEET_Y} rx={hover ? 19 : 25} ry={hover ? 3.4 : 4.8} fill="#1B1426" opacity={hover ? 0.16 : 0.24} />
            {hover ? null : <Ellipse cx={60} cy={FEET_Y} rx={16} ry={2.8} fill="#1B1426" opacity={0.16} />}
          </Layer>
        </Moving>
      ) : null}
      <Moving transform={t.root}>
        {noBack ? null : art.sway ? (
          <Moving transform={t.sway}>
            <Layer k={k} big>
              {art.sway}
            </Layer>
          </Moving>
        ) : null}
        {noBack ? null : art.back ? (
          flapWings ? (
            <Moving transform={t.wings}>
              <Layer k={k} big>
                {art.back}
              </Layer>
            </Moving>
          ) : (
            <Layer k={k} big>
              {art.back}
            </Layer>
          )
        ) : null}
        {art.backFx && !noBack ? (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: fx }]}>
            <Layer k={k} big>
              {art.backFx}
            </Layer>
          </Animated.View>
        ) : null}
        {art.hairBack && !noHead ? (
          <Moving transform={t.head}>
            <Moving transform={t.hair}>
              <HeadLayer k={k}>{art.hairBack}</HeadLayer>
            </Moving>
          </Moving>
        ) : null}
        {bust ? null : (
          <>
            <Moving transform={t.legL}>
              <Layer k={k}>{art.legL}</Layer>
            </Moving>
            <Moving transform={t.legR}>
              <Layer k={k}>{art.legR}</Layer>
            </Moving>
          </>
        )}
        <Layer k={k}>{art.body}</Layer>
        {bust ? null : (
          <>
            <Moving transform={t.armL}>
              <Layer k={k} big={art.handL}>
                {art.armL}
              </Layer>
            </Moving>
            <Moving transform={t.armR}>
              <Layer k={k} big={art.handR}>
                {art.armR}
              </Layer>
              {art.handFx ? (
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: fx }]}>
                  <Layer k={k} big>
                    {art.handFx}
                  </Layer>
                </Animated.View>
              ) : null}
            </Moving>
          </>
        )}
        {noHead ? null : (
        <Moving transform={t.head}>
          <HeadLayer k={k}>{art.head}</HeadLayer>
          {face}
          <HeadLayer k={k} big>
            {art.front}
          </HeadLayer>
          {art.hat ? (
            <Moving transform={t.hat}>
              <HeadLayer k={k} big>
                {art.hat}
              </HeadLayer>
            </Moving>
          ) : null}
          {sporeDots.map((d) => (
            <Animated.View
              key={d.key}
              pointerEvents="none"
              style={{ position: 'absolute', left: d.left - d.r * 2, top: d.top - d.r * 2, width: d.r * 4, height: d.r * 4, borderRadius: d.r * 2, backgroundColor: `${d.color}40`, alignItems: 'center', justifyContent: 'center', opacity: d.opacity, transform: d.transform }}
            >
              <View style={{ width: d.r * 2, height: d.r * 2, borderRadius: d.r, backgroundColor: d.color }} />
            </Animated.View>
          ))}
          {art.over ? (
            <Moving transform={t.halo}>
              <HeadLayer k={k} big>
                {art.over}
              </HeadLayer>
            </Moving>
          ) : null}
        </Moving>
        )}
      </Moving>
    </View>
  );
}

export const Chibi = memo(ChibiView);

const styles = StyleSheet.create({
  layer: { position: 'absolute' },
});
