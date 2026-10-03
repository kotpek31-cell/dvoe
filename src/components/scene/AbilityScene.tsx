// Сцены способностей на главной. Один таймлайн t (мс от начала) двигает всё: native driver, без перерисовок;
// позы и лица меняются несколько раз за сцену по таймерам.
// «Мог» (7 с): подбегает → темнеет, полосы кино, приближение → черепа, скулы, «МОГ» и звук → удар: вспышка,
// тряска, звёздочки → партнёр лежит → встаёт, свет возвращается.
// «Объятия» (4 с): бегут навстречу, обнимаются, сердечки, розовое свечение, перезвон, лицо «любовь».
// «Уменьшить движение»: без бега, приближения, тряски и вспышки — короткое затемнение и итог.
// 3.0: объятия — лучи света за парой и искорки по кругу; «Мог» — молнии в темноте, череп с объёмом, ударная волна.
// 0.2.2: «Мог» в шляпу грибника (scene.blocked) — до удара как обычно; в момент удара шляпа светится, вырастает
// купол из спор, черепа отскакивают, применивший чихает и падает сам, цель радуется. Плашка «Шляпа грибника отразила «Мог»».
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import type { Scene } from '../../context/AbilityProvider';
import type { Look } from '../../lib/chibi';
import { INK, type FaceKey } from '../../lib/face';
import { haptic, nativeDriver } from '../../lib/motion';
import { playSound, stopSounds } from '../../lib/sound';
import { HAT_ID } from '../../lib/mushrooms';
import { C, F } from '../../theme';
import { Chibi, type ChibiPose } from '../Chibi';
import { HeartsBurst } from '../Effects';
import { Icon } from '../Icon';

export type SceneKind = 'mog' | 'hug';
export const sceneKind = (ability: string): SceneKind => (ability === 'ability.mog' ? 'mog' : 'hug');

export function sceneLength(kind: SceneKind, reduce: boolean): number {
  if (kind === 'mog') return reduce ? 3000 : 7000;
  return reduce ? 2400 : 4600;
}

const clamp = { extrapolate: 'clamp' as const };
// Таймлайн объятий (мс): тянут руки, встретились, второе облачко сердец, отпустили
const HUG = { reach: 620, meet: 1050, second: 2350, release: 3400 };

// Приближение и тряска всей картинки (луг тоже) — их же применяет главная к фону
export function worldTransform(t: Animated.Value, kind: SceneKind, reduce: boolean) {
  if (kind !== 'mog' || reduce) return [];
  return [
    { scale: t.interpolate({ inputRange: [0, 1000, 1600, 6400, 7000], outputRange: [1, 1, 1.08, 1.08, 1], ...clamp }) },
    { translateX: t.interpolate({ inputRange: [4000, 4060, 4120, 4180, 4240, 4300, 4400], outputRange: [0, -10, 9, -7, 5, -3, 0], ...clamp }) },
    { translateY: t.interpolate({ inputRange: [4000, 4050, 4110, 4170, 4250], outputRange: [0, 6, -5, 3, 0], ...clamp }) },
  ];
}

// Значения функции на отрезке — для кругового движения (interpolate умеет только ломаные)
function sample(t: Animated.Value, from: number, to: number, steps: number, fn: (x: number) => number) {
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = from + ((to - from) * i) / steps;
    inputRange.push(x);
    outputRange.push(fn(x));
  }
  return t.interpolate({ inputRange, outputRange, ...clamp });
}

const SKULL = 'M0 -14 C-9 -14 -15 -8 -15 0 C-15 5 -12 8.5 -9 10 V15 H-4.5 V12 H-1.5 V15 H1.5 V12 H4.5 V15 H9 V10 C12 8.5 15 5 15 0 C15 -8 9 -14 0 -14 Z';
const BURST = 'M0 -60 L14 -18 L58 -30 L24 2 L54 36 L10 22 L0 66 L-10 22 L-54 36 L-24 2 L-58 -30 L-14 -18 Z';

const LIGHTNING = 'M8 0 L0 22 H7 L2 44 L18 16 H10 L16 0 Z';
const SPARKLE = 'M0 -10 C0.8 -2.4 2.4 -0.8 10 0 C2.4 0.8 0.8 2.4 0 10 C-0.8 2.4 -2.4 0.8 -10 0 C-2.4 -0.8 -0.8 -2.4 0 -10 Z';

function Skull({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="-17 -17 34 34">
      <Defs>
        <RadialGradient id="skullG" cx="-4" cy="-7" r="24" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.6" stopColor="#EDE6FF" />
          <Stop offset="1" stopColor="#B9A8E6" />
        </RadialGradient>
      </Defs>
      <Path d={SKULL} fill="url(#skullG)" stroke="#5B4A8E" strokeWidth={1.3} strokeLinejoin="round" />
      <Circle cx={-5.5} cy={0} r={4} fill={INK} />
      <Circle cx={5.5} cy={0} r={4} fill={INK} />
      <Circle cx={-6.4} cy={-1} r={1.1} fill="#B39DFF" />
      <Circle cx={4.6} cy={-1} r={1.1} fill="#B39DFF" />
      <Path d="M0 5 L-1.8 8 H1.8 Z" fill={INK} />
    </Svg>
  );
}

// Лучи света за обнимающейся парой: веер из двенадцати лучей, мягко гаснущих к краю
function Rays({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="-100 -100 200 200">
      <Defs>
        <RadialGradient id="raysG" cx="0" cy="0" r="100" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={color} stopOpacity={0.55} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {Array.from({ length: 12 }, (_, i) => (
        <Path key={i} d="M0 0 L-9 -100 L9 -100 Z" fill="url(#raysG)" transform={`rotate(${i * 30})`} />
      ))}
    </Svg>
  );
}

function Sparkle({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="-12 -12 24 24">
      <Path d={SPARKLE} fill={color} />
      <Circle cx={0} cy={0} r={2.2} fill="#FFFFFF" />
    </Svg>
  );
}

// Молния: светящийся контур и белая сердцевина
function Bolt({ w, h }: { w: number; h: number }) {
  return (
    <Svg width={w} height={h} viewBox="-4 -2 26 48">
      <Defs>
        <LinearGradient id="boltG" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#C9B6FF" />
        </LinearGradient>
      </Defs>
      <Path d={LIGHTNING} fill="#9B6BFF" opacity={0.45} stroke="#9B6BFF" strokeWidth={4} strokeLinejoin="round" />
      <Path d={LIGHTNING} fill="url(#boltG)" />
    </Svg>
  );
}

function Glow({ size, color, opacity }: { size: number; color: string; opacity: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={`glow${color.slice(1)}`} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={50} cy={50} r={50} fill={`url(#glow${color.slice(1)})`} />
    </Svg>
  );
}

type Actor = { look: Look; emotion: FaceKey; value: number };
type Phase = {
  caster: ChibiPose;
  casterFace: [FaceKey, number];
  mog: boolean;
  target: ChibiPose;
  targetFace: [FaceKey, number];
  closed: boolean;
  casterClosed?: boolean;
  sneeze?: boolean;
};

// Купол из спор вокруг того, на ком шляпа
function Dome({ w, h }: { w: number; h: number }) {
  const dots = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return { x: 50 + Math.cos(a) * 46, y: 50 + Math.sin(a) * 46, r: 1.6 + (i % 3) * 0.7, c: ['#C9FFB0', '#FFF4C2', '#D9C4FF'][i % 3] };
  });
  return (
    <Svg width={w} height={h} viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id="dome" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
          <Stop offset="0.55" stopColor="#C9FFB0" stopOpacity={0.04} />
          <Stop offset="1" stopColor="#C9FFB0" stopOpacity={0.32} />
        </RadialGradient>
      </Defs>
      <Circle cx={50} cy={50} r={48} fill="url(#dome)" stroke="#C9FFB0" strokeWidth={1.2} strokeDasharray="1.5 4" />
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.c} opacity={0.9} />
      ))}
    </Svg>
  );
}

type Props = {
  scene: Scene;
  t: Animated.Value;
  reduce: boolean;
  caster: Actor;
  target: Actor;
  width: number;
  height: number;
  size: number;
  ground: number; // top чибиков
  onDone: () => void;
};

export function AbilityScene({ scene, t, reduce, caster, target, width, height, size, ground, onDone }: Props) {
  const kind = sceneKind(scene.ability);
  const blocked = kind === 'mog' && scene.blocked === true;
  const total = sceneLength(kind, reduce);
  // отражают шляпой — значит, она на голове (даже если профиль ещё не обновился)
  const targetLook = blocked && target.look.hat?.id !== HAT_ID ? { ...target.look, hat: { id: HAT_ID } } : target.look;
  const k = size / 120;
  const chibiH = Math.round((size * 170) / 120);
  const [hearts, setHearts] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;

  const start: Phase =
    kind === 'mog'
      ? {
          caster: reduce ? 'idle' : 'run',
          casterFace: ['passion', reduce ? 90 : 60],
          mog: reduce,
          target: 'idle',
          targetFace: ['anxiety', reduce ? 90 : 40],
          closed: false,
        }
      : {
          caster: reduce ? 'hug' : 'run',
          casterFace: reduce ? ['love', 80] : [caster.emotion, caster.value],
          mog: false,
          target: reduce ? 'hug' : 'run',
          targetFace: reduce ? ['love', 80] : [target.emotion, target.value],
          closed: false,
        };
  const [phase, setPhase] = useState<Phase>(start);

  // Таймлайн: анимация + смена поз и звуки по таймерам
  useEffect(() => {
    t.setValue(0);
    const anim = Animated.timing(t, { toValue: total, duration: total, easing: Easing.linear, useNativeDriver: nativeDriver });
    anim.start();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const set = (p: Partial<Phase>) => setPhase((x) => ({ ...x, ...p }));
    if (kind === 'mog') {
      const hit = reduce ? 1500 : 4000;
      if (reduce) {
        at(0, () => {
          playSound('mog');
          playSound('tension', 0.7);
        });
      } else {
        at(1000, () => set({ caster: 'idle', casterFace: ['passion', 80] }));
        at(1600, () => {
          set({ mog: true, casterFace: ['passion', 95], targetFace: ['anxiety', 90] });
          playSound('mog');
          playSound('tension', 0.7);
        });
      }
      if (blocked) {
        // шляпа отражает: купол, черепа отскакивают, применивший чихает и падает
        if (!reduce) at(3400, () => set({ targetFace: ['calm', 75] }));
        at(hit, () => {
          playSound('chime', 0.8);
          playSound('hit', 0.35);
          haptic.warning();
          set({ casterFace: ['anxiety', 85], mog: false, targetFace: ['joy', 70] });
        });
        at(hit + (reduce ? 200 : 350), () => {
          playSound('sneeze');
          set({ caster: 'fallen', casterFace: ['tiredness', 70], casterClosed: true, sneeze: true, target: 'cheer', targetFace: ['joy', 95] });
        });
        at(hit + (reduce ? 900 : 1500), () => set({ sneeze: false }));
        at(reduce ? 2600 : 6200, () => set({ caster: 'idle', casterFace: ['tiredness', 45], casterClosed: false, target: 'idle', targetFace: ['joy', 70] }));
      } else {
        at(hit, () => {
          playSound('hit');
          haptic.warning();
          set({ target: 'fallen', targetFace: ['sadness', 30], closed: true, casterFace: ['calm', 70] });
        });
        at(reduce ? 2600 : 6200, () => set({ target: 'idle', targetFace: ['calm', 40], closed: false }));
      }
    } else if (reduce) {
      at(0, () => {
        set({ caster: 'hug', target: 'hug', casterFace: ['love', 80], targetFace: ['love', 80] });
        playSound('chime', 0.8);
        haptic.success();
        setHearts((n) => n + 1);
      });
    } else {
      // подбегают → тянут руки → обнимаются и покачиваются (глаза закрыты от счастья) → отпускают и машут
      at(HUG.reach, () => set({ caster: 'reach', target: 'reach', casterFace: ['joy', 85], targetFace: ['joy', 85] }));
      at(HUG.meet, () => {
        set({ caster: 'hug', target: 'hug', casterFace: ['love', 85], targetFace: ['love', 85] });
        playSound('chime', 0.8);
        haptic.success();
        setHearts((n) => n + 1);
      });
      at(HUG.meet + 320, () => set({ closed: true, casterClosed: true }));
      at(HUG.second, () => {
        setHearts((n) => n + 1);
        playSound('pop', 0.45);
        haptic.light();
      });
      at(HUG.release, () => set({ caster: 'idle', target: 'idle', closed: false, casterClosed: false, casterFace: ['joy', 90], targetFace: ['joy', 90] }));
      at(HUG.release + 260, () => set({ caster: 'wave', target: 'wave' }));
    }
    at(total, () => done.current());
    return () => {
      anim.stop();
      timers.forEach(clearTimeout);
      stopSounds();
    };
  }, [kind, blocked, reduce, total, t]);

  // ---------- где стоят ----------
  const pos = useMemo(() => {
    if (kind === 'mog') {
      const T = Math.min(width - size * 1.5, width * 0.5); // упавший занимает ~1,4 ширины вправо
      const C1 = T - size * 0.92;
      const C0 = Math.max(-size * 0.3, C1 - width * 0.42);
      return { c0: reduce ? C1 : C0, c1: C1, t0: T, t1: T };
    }
    const cx = width / 2;
    // 3.0: тела стройнее — встают ближе, чтобы объятия были объятиями
    const CL = cx - size * 0.7;
    const TR = cx - size * 0.3;
    return reduce
      ? { c0: CL, c1: CL, t0: TR, t1: TR }
      : { c0: Math.max(-size * 0.2, CL - width * 0.3), c1: CL, t0: Math.min(width - size * 0.8, TR + width * 0.3), t1: TR };
  }, [kind, reduce, width, size]);

  const anim = useMemo(() => {
    const runTo = kind === 'mog' ? 1000 : 900;
    const hitAt = reduce ? 1500 : 4000;
    const fallAt = blocked ? hitAt + (reduce ? 200 : 350) : hitAt;
    let casterX = t.interpolate({ inputRange: [0, runTo], outputRange: [pos.c0, pos.c1], ...clamp });
    let targetX = t.interpolate({ inputRange: [0, runTo], outputRange: [pos.t0, pos.t1], ...clamp });
    // объятия: бегом почти до конца, последний шажок — с протянутыми руками; после — отходят на полшага
    let hugLean: { caster: Animated.AnimatedInterpolation<string>; target: Animated.AnimatedInterpolation<string>; hop: Animated.AnimatedInterpolation<number> } | null = null;
    if (kind === 'hug' && !reduce) {
      const near = size * 0.2;
      const back = size * 0.12;
      casterX = t.interpolate({ inputRange: [0, HUG.reach, HUG.meet, HUG.release, HUG.release + 400], outputRange: [pos.c0, pos.c1 - near, pos.c1, pos.c1, pos.c1 - back], ...clamp });
      targetX = t.interpolate({ inputRange: [0, HUG.reach, HUG.meet, HUG.release, HUG.release + 400], outputRange: [pos.t0, pos.t1 + near, pos.t1, pos.t1, pos.t1 + back], ...clamp });
      // покачиваются вместе, наклонившись друг к другу (поворот вокруг ног)
      const swayIn = [HUG.meet, HUG.meet + 300, HUG.meet + 750, HUG.meet + 1200, HUG.meet + 1650, HUG.meet + 2100, HUG.release];
      const lean = [0, 6, 1, 6, 1, 5, 0];
      hugLean = {
        caster: t.interpolate({ inputRange: swayIn, outputRange: lean.map((d) => `${d}deg`), ...clamp }),
        target: t.interpolate({ inputRange: swayIn, outputRange: lean.map((d) => `${-d}deg`), ...clamp }),
        hop: t.interpolate({ inputRange: [HUG.meet - 120, HUG.meet + 40, HUG.meet + 220], outputRange: [0, -7 * (size / 120), 0], ...clamp }),
      };
    }
    if (blocked) {
      // отбросило назад от купола
      casterX = reduce
        ? t.interpolate({ inputRange: [fallAt, fallAt + 1], outputRange: [pos.c1, pos.c1 - size * 0.3], ...clamp })
        : t.interpolate({ inputRange: [0, runTo, hitAt, fallAt + 150], outputRange: [pos.c0, pos.c1, pos.c1, pos.c1 - size * 0.3], ...clamp });
    } else if (kind === 'mog' && !reduce) {
      targetX = t.interpolate({ inputRange: [3990, 4250], outputRange: [pos.t1, pos.t1 + size * 0.22], ...clamp });
    }
    const fadeOut = kind === 'hug' ? t.interpolate({ inputRange: [total - 380, total], outputRange: [1, 0], ...clamp }) : null;
    const dark =
      kind === 'mog'
        ? reduce
          ? t.interpolate({ inputRange: [0, 300, 2500, 3000], outputRange: [0, 0.7, 0.7, 0], ...clamp })
          : t.interpolate({ inputRange: [1000, 1600, 4000, 4300, 6400, 7000], outputRange: [0, 0.8, 0.8, 0.5, 0.4, 0], ...clamp })
        : null;
    const aura =
      kind === 'mog'
        ? reduce
          ? t.interpolate({ inputRange: [0, 300, 1400, 1600], outputRange: [0, 1, 1, 0], ...clamp })
          : blocked
            ? t.interpolate({ inputRange: [1600, 1900, 4000, 4600], outputRange: [0, 1, 1, 0], ...clamp })
            : t.interpolate({ inputRange: [1600, 1900, 3800, 4050], outputRange: [0, 1, 1, 0], ...clamp })
        : t.interpolate({ inputRange: reduce ? [0, 300, 1900, 2300] : [HUG.reach, HUG.meet, HUG.release, HUG.release + 700], outputRange: [0, 1, 1, 0], ...clamp });
    const word = reduce
      ? { opacity: t.interpolate({ inputRange: [0, 200, 1400, 1600], outputRange: [0, 1, 1, 0], ...clamp }), scale: 1 }
      : {
          opacity: t.interpolate({ inputRange: [1600, 1750, 3850, 4000], outputRange: [0, 1, 1, 0], ...clamp }),
          scale: t.interpolate({ inputRange: [1600, 1800, 2200, 2400, 2800, 3000, 3400, 3600], outputRange: [1.7, 1, 1.07, 1, 1.07, 1, 1.07, 1], ...clamp }),
        };
    const bars = reduce || kind !== 'mog' ? null : t.interpolate({ inputRange: [1000, 1600, 6400, 7000], outputRange: [0, 1, 1, 0], ...clamp });
    const flash = reduce || kind !== 'mog' ? null : t.interpolate({ inputRange: [3980, 4020, 4320], outputRange: [0, blocked ? 0.5 : 0.9, 0], ...clamp });
    const burst =
      reduce || kind !== 'mog' || blocked
        ? null
        : {
            opacity: t.interpolate({ inputRange: [3960, 4000, 4350, 4550], outputRange: [0, 1, 1, 0], ...clamp }),
            scale: t.interpolate({ inputRange: [3960, 4060, 4550], outputRange: [0.2, 1.15, 1.3], ...clamp }),
          };
    const dust = kind === 'mog' && !reduce ? t.interpolate({ inputRange: [0, 120, 850, 1150], outputRange: [0, 0.8, 0.8, 0], ...clamp }) : null;
    const standAt = reduce ? 2600 : 6200;
    const stars = kind === 'mog' ? t.interpolate({ inputRange: [fallAt + 150, fallAt + 400, standAt - 200, standAt], outputRange: [0, 1, 1, 0], ...clamp }) : null;
    const shield = blocked
      ? {
          hat: t.interpolate({ inputRange: reduce ? [hitAt - 300, hitAt, hitAt + 700, hitAt + 1000] : [3300, 3700, 4400, 5000], outputRange: [0, 1, 1, 0], ...clamp }),
          dome: t.interpolate({ inputRange: reduce ? [hitAt - 200, hitAt, 2300, 2600] : [3500, 3950, 5400, 6200], outputRange: [0, 1, 1, 0], ...clamp }),
          domeScale: reduce ? 1 : t.interpolate({ inputRange: [3500, 4000, 4120, 4320], outputRange: [0.3, 1.08, 0.95, 1], ...clamp }),
          puff: t.interpolate({ inputRange: [fallAt - 50, fallAt + 100, fallAt + 900, fallAt + 1300], outputRange: [0, 1, 0.7, 0], ...clamp }),
          puffScale: reduce ? 1 : t.interpolate({ inputRange: [fallAt - 50, fallAt + 900], outputRange: [0.4, 1.4], ...clamp }),
          pill: t.interpolate({ inputRange: [fallAt + 100, fallAt + 400], outputRange: [0, 1], ...clamp }),
        }
      : null;
    return { casterX, targetX, hugLean, fadeOut, dark, aura, word, bars, flash, burst, dust, stars, shield };
  }, [kind, blocked, reduce, total, t, pos, size]);

  // Черепа кружат вокруг пары (1,6–4 с)
  const skulls = useMemo(() => {
    if (kind !== 'mog') return [];
    const cx = (pos.c1 + pos.t1 + size) / 2;
    const cy = ground + chibiH * 0.42;
    const rx = Math.min(width * 0.44, size * 1.9);
    const ry = chibiH * 0.62;
    const base = [0, 1.25, 2.5, 3.75, 5.0];
    const sizes = [1.4, 1.1, 0.9, 1.2, 0.8];
    const from = reduce ? 0 : 1600;
    const to = reduce ? 1600 : blocked ? 4600 : 4050;
    // в шляпу: с удара черепа отлетают наружу
    const out = (x: number) => (blocked && !reduce && x > 4000 ? 1 + ((x - 4000) / 600) * 1.6 : 1);
    return base.map((a0, i) => {
      const angle = (x: number) => a0 + (reduce ? 0 : ((Math.min(x, 4000) - from) / 1000) * 0.9);
      const s = 40 * sizes[i] * Math.max(0.8, k);
      return {
        s,
        op: [0.92, 0.8, 0.6, 0.75, 0.5][i],
        x: sample(t, from, to, reduce ? 1 : 30, (x) => cx + Math.cos(angle(x)) * rx * out(x) - s / 2),
        y: sample(t, from, to, reduce ? 1 : 30, (x) => cy + Math.sin(angle(x)) * ry * out(x) - s / 2 + Math.sin(x / 180 + i) * 4),
        rot: `${[-12, 14, 8, -6, 4][i]}deg`,
      };
    });
  }, [kind, blocked, reduce, t, pos, size, ground, chibiH, width, k]);

  // Звёздочки над головой упавшего: голова лежащего (перевёрнут, смотрит влево) — у правого края рамки
  const starRing = useMemo(() => {
    if (kind !== 'mog') return [];
    // упавший смотрит влево (перевёрнут) — голова у правого края; применивший падает навзничь — у левого
    // 3.0: голова меньше, лежащий длиннее — она у самого края рамки
    const hx = blocked ? 2 * k : size - 2 * k;
    const hy = 86 * k;
    const from = (reduce ? 1500 : 4000) + (blocked ? (reduce ? 200 : 350) : 0);
    const to = reduce ? 2600 : 6200;
    return [0, 2.1, 4.2].map((a0) => ({
      x: sample(t, from, to, reduce ? 1 : 22, (x) => hx + Math.cos(a0 + (reduce ? 0 : (x - from) / 260)) * 26 * k - 10),
      y: sample(t, from, to, reduce ? 1 : 22, (x) => hy + Math.sin(a0 + (reduce ? 0 : (x - from) / 260)) * 7 * k - 10),
    }));
  }, [kind, blocked, reduce, t, size, k]);

  // Объятия: искорки кружат вокруг пары, пока она обнимается
  const twinkles = useMemo(() => {
    if (kind !== 'hug' || reduce) return [];
    const cx = width / 2;
    const cy = ground + chibiH * 0.46;
    const rx = Math.min(width * 0.42, size * 1.35);
    const ry = chibiH * 0.5;
    return [0, 0.9, 1.8, 2.7, 3.6, 4.5, 5.4].map((a0, i) => {
      const s = (14 + (i % 3) * 6) * Math.max(0.9, k);
      const angle = (x: number) => a0 + ((x - HUG.reach) / 1000) * 1.5;
      return {
        s,
        color: ['#FFFFFF', '#FFD3E2', '#FFE9B8'][i % 3],
        x: sample(t, HUG.reach, HUG.release + 700, 34, (x) => cx + Math.cos(angle(x)) * rx - s / 2),
        y: sample(t, HUG.reach, HUG.release + 700, 34, (x) => cy + Math.sin(angle(x)) * ry * (0.7 + (i % 2) * 0.3) - s / 2),
      };
    });
  }, [kind, reduce, t, width, ground, chibiH, size, k]);

  const stars = anim.stars
    ? starRing.map((s, i) => (
        <Animated.View key={i} style={{ position: 'absolute', left: 0, top: 0, opacity: anim.stars!, transform: [{ translateX: s.x }, { translateY: s.y }] }}>
          <Icon name="star" size={20} color={INK} fill="#FFD966" strokeWidth={1.4} />
        </Animated.View>
      ))
    : null;

  const world = worldTransform(t, kind, reduce);
  const auraColor = kind === 'mog' ? '#B39DFF' : '#FF8FB3';
  const auraSize = kind === 'mog' ? size * 2.6 : size * 3.4;
  const auraX = kind === 'mog' ? pos.c1 + size / 2 : width / 2;
  const barH = Math.round(height * 0.09);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: world, opacity: anim.fadeOut ?? 1 }]}>
        {anim.dark ? <Animated.View style={[StyleSheet.absoluteFill, styles.dark, { opacity: anim.dark }]} /> : null}
        <Animated.View style={{ position: 'absolute', left: auraX - auraSize / 2, top: ground + chibiH * 0.5 - auraSize / 2, opacity: anim.aura }}>
          <Glow size={auraSize} color={auraColor} opacity={kind === 'mog' ? 0.6 : 0.85} />
        </Animated.View>
        {kind === 'hug' && !reduce ? (
          <>
            {/* лучи медленно поворачиваются за парой, пятно света на земле под ногами */}
            <Animated.View
              style={{
                position: 'absolute',
                left: auraX - auraSize * 0.6,
                top: ground + chibiH * 0.45 - auraSize * 0.6,
                opacity: Animated.multiply(anim.aura, 0.55),
                transform: [{ rotate: t.interpolate({ inputRange: [0, total], outputRange: ['0deg', '70deg'] }) }],
              }}
            >
              <Rays size={auraSize * 1.2} color="#FFD3E2" />
            </Animated.View>
            <Animated.View style={{ position: 'absolute', left: auraX - size * 1.1, top: ground + chibiH * 0.9 - size * 0.2, opacity: anim.aura }}>
              <Svg width={size * 2.2} height={size * 0.4} viewBox="0 0 220 40">
                <Defs>
                  <RadialGradient id="hugFloor" cx="110" cy="20" r="110" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 16.4) scale(1 0.18)">
                    <Stop offset="0" stopColor="#FF8FB3" stopOpacity={0.7} />
                    <Stop offset="1" stopColor="#FF8FB3" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Ellipse cx={110} cy={20} rx={110} ry={20} fill="url(#hugFloor)" />
              </Svg>
            </Animated.View>
            {twinkles.map((tw, i) => (
              <Animated.View key={`tw${i}`} style={{ position: 'absolute', left: 0, top: 0, opacity: anim.aura, transform: [{ translateX: tw.x }, { translateY: tw.y }] }}>
                <Sparkle size={tw.s} color={tw.color} />
              </Animated.View>
            ))}
          </>
        ) : null}
        {kind === 'mog' && !reduce
          ? [
              { x: 0.16, y: 0.16, w: 44, at: 1700, rot: '-14deg' },
              { x: 0.74, y: 0.2, w: 36, at: 2300, rot: '12deg' },
              { x: 0.44, y: 0.1, w: 52, at: 2950, rot: '4deg' },
              { x: 0.84, y: 0.34, w: 30, at: 3500, rot: '-8deg' },
            ].map((b, i) => (
              <Animated.View
                key={`bolt${i}`}
                style={{
                  position: 'absolute',
                  left: width * b.x,
                  top: height * b.y,
                  opacity: t.interpolate({ inputRange: [b.at, b.at + 40, b.at + 110, b.at + 150, b.at + 260], outputRange: [0, 1, 0.25, 0.9, 0], ...clamp }),
                  transform: [{ rotate: b.rot }],
                }}
              >
                <Bolt w={b.w * Math.max(1, k)} h={b.w * 1.9 * Math.max(1, k)} />
              </Animated.View>
            ))
          : null}
        {skulls.map((s, i) => (
          <Animated.View
            key={i}
            style={{ position: 'absolute', left: 0, top: 0, opacity: Animated.multiply(anim.aura, s.op), transform: [{ translateX: s.x }, { translateY: s.y }, { rotate: s.rot }] }}
          >
            <Skull size={s.s} />
          </Animated.View>
        ))}

        {anim.shield ? (
          <Animated.View
            style={{
              position: 'absolute',
              left: pos.t1 + size / 2 - size * 0.95,
              top: ground + chibiH * 0.52 - chibiH * 0.68,
              opacity: anim.shield.dome,
              transform: [{ scale: anim.shield.domeScale }],
            }}
          >
            <Dome w={size * 1.9} h={chibiH * 1.36} />
          </Animated.View>
        ) : null}

        {/* тот, к кому применили */}
        <Animated.View
          style={[
            styles.actor,
            {
              top: ground,
              width: size,
              height: chibiH,
              transform: anim.hugLean
                ? [{ translateX: anim.targetX }, { translateY: anim.hugLean.hop }, { translateY: chibiH / 2 }, { rotate: anim.hugLean.target }, { translateY: -chibiH / 2 }]
                : [{ translateX: anim.targetX }],
            },
          ]}
        >
          {anim.shield ? (
            <Animated.View style={{ position: 'absolute', left: size / 2 - size * 0.7, top: -size * 0.45, opacity: anim.shield.hat }}>
              <Glow size={size * 1.4} color="#C9FFB0" opacity={0.9} />
            </Animated.View>
          ) : null}
          <Chibi
            look={targetLook}
            emotion={phase.targetFace[0]}
            value={phase.targetFace[1]}
            pose={phase.target}
            size={size}
            flip
            eyesClosed={phase.closed}
          />
          {blocked ? null : stars}
        </Animated.View>

        {/* тот, кто применил */}
        <Animated.View
          style={[
            styles.actor,
            {
              top: ground,
              width: size,
              height: chibiH,
              transform: anim.hugLean
                ? [{ translateX: anim.casterX }, { translateY: anim.hugLean.hop }, { translateY: chibiH / 2 }, { rotate: anim.hugLean.caster }, { translateY: -chibiH / 2 }]
                : [{ translateX: anim.casterX }],
            },
          ]}
        >
          {anim.dust ? (
            <Animated.View style={{ position: 'absolute', left: -size * 0.25, top: chibiH * 0.82, opacity: anim.dust }}>
              <Svg width={size * 0.5} height={size * 0.2} viewBox="0 0 50 20">
                <Circle cx={38} cy={12} r={7} fill="#FFFFFF" opacity={0.75} />
                <Circle cx={24} cy={9} r={5} fill="#FFFFFF" opacity={0.6} />
                <Circle cx={12} cy={13} r={3.5} fill="#FFFFFF" opacity={0.5} />
              </Svg>
            </Animated.View>
          ) : null}
          <Chibi look={caster.look} emotion={phase.casterFace[0]} value={phase.casterFace[1]} pose={phase.caster} size={size} mog={phase.mog} eyesClosed={phase.casterClosed} />
          {blocked ? stars : null}
          {anim.shield ? (
            <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -size * 0.25, top: chibiH * 0.45, opacity: anim.shield.puff, transform: [{ scale: anim.shield.puffScale }] }}>
              <Svg width={size * 0.9} height={size * 0.6} viewBox="0 0 90 60">
                {[[16, 30, 4], [30, 16, 3], [46, 26, 5], [60, 12, 3], [70, 34, 4], [36, 44, 3], [52, 48, 2.5], [22, 50, 2.5]].map(([x, y, r], i) => (
                  <Circle key={i} cx={x} cy={y} r={r} fill={['#C9FFB0', '#FFF4C2', '#D9C4FF'][i % 3]} opacity={0.9} />
                ))}
              </Svg>
            </Animated.View>
          ) : null}
          {phase.sneeze ? (
            <View pointerEvents="none" style={[styles.sneeze, { left: size * 0.5 - 60, top: chibiH * 0.08 }]}>
              <View style={styles.sneezeBubble}>
                <Text style={styles.sneezeText}>Апчхи!</Text>
              </View>
              <View style={styles.sneezeTail} />
            </View>
          ) : null}
        </Animated.View>

        {kind === 'hug' ? <HeartsBurst trigger={hearts} x={width / 2} y={ground + chibiH * 0.35} scale={Math.max(1, k)} /> : null}

        {anim.burst ? (
          <Animated.View
            style={{
              position: 'absolute',
              left: pos.t1 + size * 0.45 - 70 * k,
              top: ground + chibiH * 0.45 - 70 * k,
              opacity: anim.burst.opacity,
              transform: [{ scale: anim.burst.scale }],
            }}
          >
            <Svg width={140 * k} height={140 * k} viewBox="-70 -70 140 140">
              <Defs>
                <RadialGradient id="burstG" cx="0" cy="0" r="66" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor="#FFFFFF" />
                  <Stop offset="0.5" stopColor="#FFF2A8" />
                  <Stop offset="1" stopColor="#FFB84D" />
                </RadialGradient>
              </Defs>
              <Circle cx={0} cy={0} r={64} fill="none" stroke="#FFE9B8" strokeWidth={3} opacity={0.7} />
              <Path d={BURST} fill="url(#burstG)" stroke="#C97A2E" strokeWidth={1.8} strokeLinejoin="round" />
            </Svg>
          </Animated.View>
        ) : null}
      </Animated.View>

      {/* поверх картинки: полосы кино, слово, вспышка */}
      {anim.bars ? (
        <>
          <Animated.View style={[styles.bar, { top: 0, height: barH, transform: [{ translateY: anim.bars.interpolate({ inputRange: [0, 1], outputRange: [-barH, 0] }) }] }]} />
          <Animated.View style={[styles.bar, { bottom: 0, height: barH, transform: [{ translateY: anim.bars.interpolate({ inputRange: [0, 1], outputRange: [barH, 0] }) }] }]} />
        </>
      ) : null}
      {kind === 'mog' ? (
        <Animated.View style={[styles.wordWrap, { top: height * 0.26, opacity: anim.word.opacity, transform: [{ scale: anim.word.scale }] }]}>
          <Animated.Text style={styles.word} accessibilityElementsHidden>
            МОГ
          </Animated.Text>
        </Animated.View>
      ) : null}
      {anim.shield ? (
        <Animated.View style={[styles.pillWrap, { top: height * 0.2, opacity: anim.shield.pill }]}>
          <View style={styles.pill}>
            <Text style={styles.pillText} numberOfLines={1}>
              Шляпа грибника отразила «Мог»
            </Text>
          </View>
        </Animated.View>
      ) : null}
      {anim.flash ? <Animated.View style={[StyleSheet.absoluteFill, blocked ? styles.flashGreen : styles.flash, { opacity: anim.flash }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dark: { backgroundColor: '#07040F' },
  actor: { position: 'absolute', left: 0 },
  bar: { position: 'absolute', left: 0, right: 0, backgroundColor: '#000000' },
  wordWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  word: {
    fontFamily: F.display,
    fontSize: 76,
    lineHeight: 92,
    letterSpacing: 8,
    color: '#F6F3FF',
    textShadowColor: '#9B6BFF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
  },
  flash: { backgroundColor: '#FFFFFF' },
  flashGreen: { backgroundColor: '#ECFFE0' },
  sneeze: { position: 'absolute', width: 120, alignItems: 'center' },
  sneezeBubble: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: INK },
  sneezeTail: { width: 12, height: 12, marginTop: -7, backgroundColor: '#FFFFFF', borderRightWidth: 2, borderBottomWidth: 2, borderColor: INK, transform: [{ rotate: '45deg' }] },
  sneezeText: { fontFamily: F.display, fontSize: 16, color: INK },
  pillWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(24,40,32,0.86)', borderWidth: 1, borderColor: C.good },
  pillText: { fontFamily: F.heavy, fontSize: 13.5, color: C.good },
});
