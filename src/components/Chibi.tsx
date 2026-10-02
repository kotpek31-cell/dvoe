// Чибик 2.0: основа (кожа, руки, ноги, голова) + надетые вещи из каталога, слоями SVG.
// Сзади вперёд: спина, волосы сзади, ноги, тело, руки с предметом, голова, лицо, волосы спереди, шляпа, нимб.
// Анимируется не больше 9 слоёв трансформациями на native driver — дёшево даже на слабых телефонах.
// Стоящий чибик раз в 8–15 с сам что-то делает: оглядывается, потягивается или подпрыгивает.
// 0.2.2: шляпа может покачиваться (meta.anim = 'sway' у шляпы), ночью от неё летят споры (meta.spores).
import { memo, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { saw, tri } from '../lib/anim';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { renderLayer, type Paint } from '../lib/art';
import { useCatalog } from '../lib/catalog';
import { dress, type Look, type WearCat, type Worn } from '../lib/chibi';
import { INK, mixColor, type FaceKey } from '../lib/face';
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
};

// Холст слоя чуть больше рамки 120×170; у крыльев, нимба и предметов в руках — большой,
// чтобы ничего не обрезалось. Большой холст дороже по памяти, поэтому только там, где нужен.
const CANVAS = {
  small: { x: -12, y: -14, w: 144, h: 188 },
  big: { x: -30, y: -40, w: 200, h: 224 },
};
const SW = 2.2;

// Порядок вещей внутри одного слоя рисунка
const ORDER: WearCat[] = ['back', 'hair', 'hat', 'face', 'top', 'bottom', 'shoes', 'hand'];
const EYE_STYLES = new Set<EyeStyle>(['classic', 'lashes', 'sparkle', 'sleepy', 'azure', ...NEW_EYES]);

const PARTS = {
  legL: { x: 47, y: 124 },
  legR: { x: 62, y: 124 },
  shoulderL: { x: 39, y: 103 },
  shoulderR: { x: 81, y: 103 },
  pillow: { x: 6, y: 20, w: 108, h: 74 },
  blanket: 'M10 102 C10 97 22 95 60 95 C98 95 110 97 110 102 L113 154 C113 163 107 167 99 167 L21 167 C13 167 7 163 7 154 Z',
  blanketFold: 'M10 102 C10 97 22 95 60 95 C98 95 110 97 110 102 L110.5 113 C98 109.5 22 109.5 9.5 113 Z',
  blanketMarks: 'M30 128 l3 3 l3 -3 M60 140 l3 3 l3 -3 M84 124 l3 3 l3 -3 M44 152 l3 3 l3 -3 M88 150 l3 3 l3 -3',
  mogJaw: 'M21 76 C28 93 43 101 60 103.4 C77 101 92 93 99 76 C93 90 79 98.5 60 100 C41 98.5 27 90 21 76 Z',
  mogCheeks: 'M25 68 C29 77 35 82 43 84 C35 80 30 75 27 67 Z M95 68 C91 77 85 82 77 84 C85 80 90 75 93 67 Z',
} as const;

function Layer({ k, big = false, children }: { k: number; big?: boolean; children: ReactNode }) {
  const c = big ? CANVAS.big : CANVAS.small;
  return (
    <Svg width={c.w * k} height={c.h * k} viewBox={`${c.x} ${c.y} ${c.w} ${c.h}`} style={[styles.layer, { left: c.x * k, top: c.y * k }]}>
      {children}
    </Svg>
  );
}

// Слой, который поворачивается или сдвигается целиком
function Moving({ transform, children }: { transform: object[]; children: ReactNode }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: transform as any }]}>{children}</Animated.View>;
}

const deg = (n: Animated.AnimatedInterpolation<number> | Animated.AnimatedAddition<number> | Animated.Value) =>
  n.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });

function ChibiView({ look, emotion, value, pose, size, gaze, flip = false, mog = false, eyesClosed = false, still = false }: Props) {
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
    const paint = (it: Worn): Paint => ({ c: it.color, skin, ids: `${uid}${it.item.id.replace('.', '')}${it.color.slice(1)}` });
    const layer = (name: string) => items.flatMap((it) => renderLayer(it.item.art.layers?.[name], paint(it), `${it.item.id}.${name}`));
    const has = (name: string) => items.some((it) => it.item.art.layers?.[name]);

    const leg = (side: 'L' | 'R') => {
      const L = side === 'L' ? PARTS.legL : PARTS.legR;
      return (
        <>
          {has(`leg${side}`) ? layer(`leg${side}`) : <Rect x={L.x} y={L.y} width={11} height={24} rx={5} fill={skin} stroke={INK} strokeWidth={SW} />}
          {layer(`shoe${side}`)}
        </>
      );
    };

    const sleeveKey = top?.item.meta.sleeveColor;
    const sleeveCol = sleeveKey && CLOTH[sleeveKey] ? CLOTH[sleeveKey][1] : top?.color ?? skin;
    const short = top?.item.meta.sleeve === 'short';
    const cuff = typeof top?.item.meta.cuff === 'string' ? top.item.meta.cuff : null;
    const arm = (side: 'L' | 'R') => {
      const x = side === 'L' ? 33.5 : 75.5;
      const hx = side === 'L' ? 39 : 81;
      return (
        <G transform={side === 'L' ? 'rotate(16 39 103)' : 'rotate(-16 81 103)'}>
          <Rect x={x} y={100} width={11} height={24} rx={5.5} fill={skin} stroke={INK} strokeWidth={SW} />
          {short ? (
            <Rect x={x} y={100} width={11} height={11.5} rx={5} fill={sleeveCol} stroke={INK} strokeWidth={SW} />
          ) : (
            <Rect x={x} y={100} width={11} height={24} rx={5.5} fill={sleeveCol} stroke={INK} strokeWidth={SW} />
          )}
          {cuff && !short ? <Rect x={x - 0.4} y={117.5} width={11.8} height={5.5} rx={2.6} fill={cuff} stroke={INK} strokeWidth={1.6} /> : null}
          {layer(side === 'L' ? 'handL' : 'handR')}
          <Circle cx={hx} cy={126} r={5.2} fill={skin} stroke={INK} strokeWidth={2} />
        </G>
      );
    };

    const head = (
      <>
        <Circle cx={18} cy={70} r={6.5} fill={skin} stroke={INK} strokeWidth={SW} />
        <Circle cx={102} cy={70} r={6.5} fill={skin} stroke={INK} strokeWidth={SW} />
        <Path d="M15.6 70.5 a2.6 2.6 0 0 1 3.4 -2.6 M104.4 70.5 a2.6 2.6 0 0 0 -3.4 -2.6" fill="none" stroke={mixColor(skin, INK, 0.2)} strokeWidth={1.4} strokeLinecap="round" />
        <Ellipse cx={60} cy={64} rx={43} ry={40} fill={skin} stroke={INK} strokeWidth={SW} />
      </>
    );

    // Живые слои 0.2.1: спина одной вещи качается, слои *Fx мерцают
    const swayer = items.find((it) => it.item.meta.anim === 'sway' && it.item.art.layers?.back);
    const still = items.filter((it) => it !== swayer);
    const stillBack = still.some((it) => it.item.art.layers?.back) ? still.flatMap((it) => renderLayer(it.item.art.layers?.back, paint(it), `${it.item.id}.back`)) : null;
    const pv = swayer?.item.meta.pivot;
    return {
      handL: has('handL'),
      handR: has('handR'),
      back: stillBack,
      sway: swayer ? renderLayer(swayer.item.art.layers?.back, paint(swayer), `${swayer.item.id}.sway`) : null,
      pivot: (Array.isArray(pv) && pv.length === 2 ? pv : [60, 100]) as [number, number],
      backFx: has('backFx') ? layer('backFx') : null,
      handFx: has('handFx') ? <G transform="rotate(-16 81 103)">{layer('handFx')}</G> : null,
      fxKind: items.find((it) => it.item.art.layers?.backFx || it.item.art.layers?.handFx)?.item.meta.anim === 'pulse' ? 'pulse' : 'flicker',
      hairBack: has('hairBack') ? layer('hairBack') : null,
      legL: leg('L'),
      legR: leg('R'),
      body: (
        <>
          {layer('under')}
          {layer('body')}
          {layer('front')}
          {/* тень под головой */}
          <Ellipse cx={60} cy={104.5} rx={21} ry={4.2} fill={INK} opacity={0.16} />
        </>
      ),
      armL: arm('L'),
      armR: arm('R'),
      head,
      front: (
        <>
          {layer('mask')}
          {mog ? (
            <>
              <Path d={PARTS.mogJaw} fill={INK} opacity={0.28} />
              <Path d={PARTS.mogCheeks} fill={INK} opacity={0.38} />
              <Path d="M30 88 L43 98 M90 88 L77 98" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" opacity={0.55} />
            </>
          ) : null}
          {layer('hairFront')}
          {sleep || hatSway ? null : layer('hat')}
        </>
      ),
      hat: hatSway ? (
        <>
          {layer('hat')}
          {layer('over')}
        </>
      ) : null,
      hatPivot: (Array.isArray(worn.hat?.item.meta.pivot) ? worn.hat!.item.meta.pivot : [60, 40]) as [number, number],
      over: has('over') && !hatSway ? layer('over') : null,
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
    if (moving) loops.push(Animated.loop(timing(cycle, 1, pose === 'run' ? 380 : 560)));
    else loops.push(swing(breath, sleep ? 2000 : 1600, Easing.inOut(Easing.sin)));
    if (pose === 'wave') loops.push(swing(wave, 420, Easing.inOut(Easing.quad)));
    // объятия — руки чуть сжимают и отпускают; тянется — руки подрагивают навстречу
    if (pose === 'hug') loops.push(swing(wave, 620, Easing.inOut(Easing.sin)));
    if (pose === 'reach') loops.push(swing(wave, 260, Easing.inOut(Easing.sin)));
    if (pose === 'jump') {
      loops.push(
        Animated.loop(
          Animated.sequence([timing(hop, 1, 260, Easing.out(Easing.quad)), timing(hop, 0, 300, Easing.in(Easing.quad)), Animated.delay(320)]),
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
        Animated.sequence([t(hop, 1, 220, Easing.out(Easing.quad)), t(hop, 0, 260, Easing.in(Easing.quad))]).start(done);
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
    const add = (...xs: (Animated.Value | Animated.AnimatedInterpolation<number> | Animated.AnimatedAddition<number>)[]) =>
      xs.reduce((a, b) => Animated.add(a, b) as Animated.AnimatedAddition<number>);
    // поворот слоя вокруг точки рисунка (px, py): центр слоя — точка (60, 85)
    const around = (px: number, py: number, rest: object[]) => [
      { translateX: (px - 60) * k },
      { translateY: (py - 85) * k },
      ...rest,
      { translateX: -(px - 60) * k },
      { translateY: -(py - 85) * k },
    ];

    // корпус: покачивание при ходьбе, дыхание, прыжок, парение
    const bob = moving
      ? cycle.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -(run ? 3.5 : 2.5) * k, 0, -(run ? 3.5 : 2.5) * k, 0] })
      : breath.interpolate({ inputRange: [0, 1], outputRange: [0, -1.2 * k] });
    const lift = hover ? flap.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-9 * k, -11.5 * k, -9 * k] }) : c(0);
    const rootY = add(bob, hop.interpolate({ inputRange: [0, 1], outputRange: [0, -14 * k] }), lift);
    const sway = moving
      ? cycle.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: run ? ['8deg', '6deg', '8deg', '10deg', '8deg'] : ['0deg', '-2.5deg', '0deg', '2.5deg', '0deg'],
        })
      : '0deg';
    const tall = stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
    // сидит (в комнате — кто закрыл приложение): корпус ниже, ноги поджаты
    const sit = pose === 'sit';
    const root = fallen
      ? [{ translateX: 47 * k }, { translateY: -40 * k }, ...around(60, 156, [{ rotate: '-90deg' }])]
      : [{ translateY: sit ? add(rootY, c(17 * k)) : rootY }, ...around(60, 150, [{ rotate: sway }, { scaleY: tall }])];

    // ноги
    const step = (phase: 0 | 0.5) =>
      moving
        ? cycle.interpolate({
            inputRange: phase === 0 ? [0, 0.25, 0.5, 1] : [0, 0.5, 0.75, 1],
            outputRange: phase === 0 ? [0, -(run ? 6 : 4) * k, 0, 0] : [0, 0, -(run ? 6 : 4) * k, 0],
          })
        : c(0);

    // руки: поза + размах при ходьбе + взмах + потягивание + прыжок
    // reach — тянется к тому, кто справа (у отражённого — слева): ближняя рука вперёд, дальняя чуть вверх
    const baseL = pose === 'hug' ? 70 : pose === 'reach' ? 28 : pose === 'cheer' ? 140 : 0;
    const baseR = pose === 'hug' ? -70 : pose === 'reach' ? -92 : pose === 'cheer' ? -140 : pose === 'wave' && !animate ? -114 : 0;
    const amp = run ? 32 : 9;
    const swingL = moving ? cycle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [amp, -amp, amp] }) : c(0);
    const swingR = moving ? cycle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-amp, amp, -amp] }) : c(0);
    const waveR =
      pose === 'wave' && animate
        ? wave.interpolate({ inputRange: [0, 1], outputRange: [-100, -128] })
        : (pose === 'hug' || pose === 'reach') && animate
          ? wave.interpolate({ inputRange: [0, 1], outputRange: pose === 'hug' ? [0, -14] : [0, -9] })
          : c(0);
    const hugL = (pose === 'hug' || pose === 'reach') && animate ? wave.interpolate({ inputRange: [0, 1], outputRange: pose === 'hug' ? [0, 14] : [0, 6] }) : c(0);
    const armL = add(c(baseL), swingL, hugL, stretch.interpolate({ inputRange: [0, 1], outputRange: [0, 150] }), hop.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }));
    const armR = add(c(baseR), swingR, waveR, stretch.interpolate({ inputRange: [0, 1], outputRange: [0, -150] }), hop.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }));

    // волосы сзади слегка качаются
    const hair = moving
      ? cycle.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: run ? ['0deg', '2.6deg', '0deg', '-2.6deg', '0deg'] : ['0deg', '1.8deg', '0deg', '-1.8deg', '0deg'] })
      : breath.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '0.8deg'] });

    // тень: уменьшается, когда чибик в воздухе
    const shadow = Animated.multiply(
      hop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }),
      hover ? flap.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.9, 1] }) : c(1),
    );

    return {
      root,
      legL: sit ? around(60, 124, [{ scaleY: 0.42 }]) : [{ translateY: step(0) }],
      legR: sit ? around(60, 124, [{ scaleY: 0.42 }]) : [{ translateY: step(0.5) }],
      armL: around(PARTS.shoulderL.x, PARTS.shoulderL.y, [{ rotate: deg(armL) }]),
      armR: around(PARTS.shoulderR.x, PARTS.shoulderR.y, [{ rotate: deg(armR) }]),
      hair: around(60, 40, [{ rotate: hair }]),
      sway: around(art.pivot[0], art.pivot[1], [{ rotate: swayV.interpolate({ inputRange: [-1, 1], outputRange: moving ? ['-6deg', '6deg'] : ['-3deg', '3deg'] }) }]),
      hat: around(art.hatPivot[0], art.hatPivot[1], [{ rotate: swayV.interpolate({ inputRange: [-1, 1], outputRange: moving ? ['-4deg', '4deg'] : ['-2.2deg', '2.2deg'] }) }]),
      wings: around(60, 104, [{ scaleX: flap.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 0.86, 1, 0.86, 1] }) }]),
      halo: [
        { translateY: flap.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -1.8 * k, 0] }) },
        ...around(60, 0, [{ rotate: flap.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['0deg', '3deg', '0deg', '-3deg', '0deg'] }) }]),
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
              left: (22 + i * 19) * k,
              top: (4 + (i % 2) * 8) * k,
              r: (i % 2 ? 2.2 : 2.8) * k,
              color: ['#C9FFB0', '#FFF4C2', '#D9C4FF'][i % 3],
              opacity: p.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 0.95, 0.6, 0] }),
              transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, -46 * k] }) }, { translateX: tri(spore, off * 2, -5 * k, 5 * k) }],
            };
          })
        : [],
    [spores, spore, k],
  );

  const face = (
    <View style={{ position: 'absolute', left: 12.5 * k, top: 24.5 * k }}>
      <Face
        emotion={sleep ? 'sleep' : emotion}
        value={sleep ? 100 : value}
        size={95 * k}
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
          <Layer k={k}>
            <Rect x={PARTS.pillow.x} y={PARTS.pillow.y} width={PARTS.pillow.w} height={PARTS.pillow.h} rx={26} fill="#F3EEFF" stroke={INK} strokeWidth={SW} />
            {art.hairBack}
            {art.head}
          </Layer>
          {face}
          <Layer k={k}>
            <Path d={PARTS.blanket} fill="#8C7BF5" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
            <Path d={PARTS.blanketFold} fill="#C3B9FF" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
            <Path d={PARTS.blanketMarks} fill="none" stroke="#E6E0FF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            {art.front}
            {art.over}
          </Layer>
        </Moving>
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={{ width: w, height: h, transform: [{ scaleX: flip ? -1 : 1 }] }}>
      <Moving transform={t.shadow}>
        <Layer k={k}>
          {/* тень — прямо под подошвами (низ обуви — 156,5), а не ниже: иначе чибик будто висит над ней */}
          <Ellipse cx={60} cy={hover ? 160 : 156.5} rx={hover ? 20 : 26} ry={hover ? 3.6 : 5} fill="#1B1426" opacity={hover ? 0.16 : 0.26} />
          {hover ? null : <Ellipse cx={60} cy={156.5} rx={17} ry={3} fill="#1B1426" opacity={0.14} />}
        </Layer>
      </Moving>
      <Moving transform={t.root}>
        {art.sway ? (
          <Moving transform={t.sway}>
            <Layer k={k} big>
              {art.sway}
            </Layer>
          </Moving>
        ) : null}
        {art.back ? (
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
        {art.backFx ? (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: fx }]}>
            <Layer k={k} big>
              {art.backFx}
            </Layer>
          </Animated.View>
        ) : null}
        {art.hairBack ? (
          <Moving transform={t.hair}>
            <Layer k={k}>{art.hairBack}</Layer>
          </Moving>
        ) : null}
        <Moving transform={t.legL}>
          <Layer k={k}>{art.legL}</Layer>
        </Moving>
        <Moving transform={t.legR}>
          <Layer k={k}>{art.legR}</Layer>
        </Moving>
        <Layer k={k}>{art.body}</Layer>
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
        <Layer k={k}>{art.head}</Layer>
        {face}
        <Layer k={k}>{art.front}</Layer>
        {art.hat ? (
          <Moving transform={t.hat}>
            <Layer k={k} big>
              {art.hat}
            </Layer>
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
            <Layer k={k} big>
              {art.over}
            </Layer>
          </Moving>
        ) : null}
      </Moving>
    </View>
  );
}

export const Chibi = memo(ChibiView);

const styles = StyleSheet.create({
  layer: { position: 'absolute' },
});
