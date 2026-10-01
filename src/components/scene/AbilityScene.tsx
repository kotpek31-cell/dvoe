// Сцены способностей на главной. Один таймлайн t (мс от начала) двигает всё: native driver, без перерисовок;
// позы и лица меняются несколько раз за сцену по таймерам.
// «Мог» (7 с): подбегает → темнеет, полосы кино, приближение → черепа, скулы, «МОГ» и звук → удар: вспышка,
// тряска, звёздочки → партнёр лежит → встаёт, свет возвращается.
// «Объятия» (4 с): бегут навстречу, обнимаются, сердечки, розовое свечение, перезвон, лицо «любовь».
// «Уменьшить движение»: без бега, приближения, тряски и вспышки — короткое затемнение и итог.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import type { Scene } from '../../context/AbilityProvider';
import type { Look } from '../../lib/chibi';
import { INK, type FaceKey } from '../../lib/face';
import { haptic, nativeDriver } from '../../lib/motion';
import { playSound, stopSounds } from '../../lib/sound';
import { F } from '../../theme';
import { Chibi, type ChibiPose } from '../Chibi';
import { HeartsBurst } from '../Effects';
import { Icon } from '../Icon';

export type SceneKind = 'mog' | 'hug';
export const sceneKind = (ability: string): SceneKind => (ability === 'ability.mog' ? 'mog' : 'hug');

export function sceneLength(kind: SceneKind, reduce: boolean): number {
  if (kind === 'mog') return reduce ? 3000 : 7000;
  return reduce ? 2400 : 4000;
}

const clamp = { extrapolate: 'clamp' as const };

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

function Skull({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="-17 -17 34 34">
      <Path d={SKULL} fill="#F4F0FF" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <Circle cx={-5.5} cy={0} r={4} fill={INK} />
      <Circle cx={5.5} cy={0} r={4} fill={INK} />
      <Path d="M0 5 L-1.8 8 H1.8 Z" fill={INK} />
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
type Phase = { caster: ChibiPose; casterFace: [FaceKey, number]; mog: boolean; target: ChibiPose; targetFace: [FaceKey, number]; closed: boolean };

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
  const total = sceneLength(kind, reduce);
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
      at(hit, () => {
        playSound('hit');
        haptic.warning();
        set({ target: 'fallen', targetFace: ['sadness', 30], closed: true, casterFace: ['calm', 70] });
      });
      at(reduce ? 2600 : 6200, () => set({ target: 'idle', targetFace: ['calm', 40], closed: false }));
    } else {
      const meet = reduce ? 0 : 900;
      at(meet, () => {
        set({ caster: 'hug', target: 'hug', casterFace: ['love', 80], targetFace: ['love', 80] });
        playSound('chime', 0.8);
        haptic.success();
        setHearts((n) => n + 1);
      });
    }
    at(total, () => done.current());
    return () => {
      anim.stop();
      timers.forEach(clearTimeout);
      stopSounds();
    };
  }, [kind, reduce, total, t]);

  // ---------- где стоят ----------
  const pos = useMemo(() => {
    if (kind === 'mog') {
      const T = Math.min(width - size * 1.5, width * 0.5); // упавший занимает ~1,4 ширины вправо
      const C1 = T - size * 0.92;
      const C0 = Math.max(-size * 0.3, C1 - width * 0.42);
      return { c0: reduce ? C1 : C0, c1: C1, t0: T, t1: T };
    }
    const cx = width / 2;
    const CL = cx - size * 0.74;
    const TR = cx - size * 0.26;
    return reduce
      ? { c0: CL, c1: CL, t0: TR, t1: TR }
      : { c0: Math.max(-size * 0.2, CL - width * 0.3), c1: CL, t0: Math.min(width - size * 0.8, TR + width * 0.3), t1: TR };
  }, [kind, reduce, width, size]);

  const anim = useMemo(() => {
    const runTo = kind === 'mog' ? 1000 : 900;
    const casterX = t.interpolate({ inputRange: [0, runTo], outputRange: [pos.c0, pos.c1], ...clamp });
    let targetX = t.interpolate({ inputRange: [0, runTo], outputRange: [pos.t0, pos.t1], ...clamp });
    if (kind === 'mog' && !reduce) {
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
          : t.interpolate({ inputRange: [1600, 1900, 3800, 4050], outputRange: [0, 1, 1, 0], ...clamp })
        : t.interpolate({ inputRange: reduce ? [0, 300, 1900, 2300] : [700, 1100, 3300, 3900], outputRange: [0, 1, 1, 0], ...clamp });
    const word = reduce
      ? { opacity: t.interpolate({ inputRange: [0, 200, 1400, 1600], outputRange: [0, 1, 1, 0], ...clamp }), scale: 1 }
      : {
          opacity: t.interpolate({ inputRange: [1600, 1750, 3850, 4000], outputRange: [0, 1, 1, 0], ...clamp }),
          scale: t.interpolate({ inputRange: [1600, 1800, 2200, 2400, 2800, 3000, 3400, 3600], outputRange: [1.7, 1, 1.07, 1, 1.07, 1, 1.07, 1], ...clamp }),
        };
    const bars = reduce || kind !== 'mog' ? null : t.interpolate({ inputRange: [1000, 1600, 6400, 7000], outputRange: [0, 1, 1, 0], ...clamp });
    const flash = reduce || kind !== 'mog' ? null : t.interpolate({ inputRange: [3980, 4020, 4320], outputRange: [0, 0.9, 0], ...clamp });
    const burst =
      reduce || kind !== 'mog'
        ? null
        : {
            opacity: t.interpolate({ inputRange: [3960, 4000, 4350, 4550], outputRange: [0, 1, 1, 0], ...clamp }),
            scale: t.interpolate({ inputRange: [3960, 4060, 4550], outputRange: [0.2, 1.15, 1.3], ...clamp }),
          };
    const dust = kind === 'mog' && !reduce ? t.interpolate({ inputRange: [0, 120, 850, 1150], outputRange: [0, 0.8, 0.8, 0], ...clamp }) : null;
    const hitAt = reduce ? 1500 : 4000;
    const standAt = reduce ? 2600 : 6200;
    const stars = kind === 'mog' ? t.interpolate({ inputRange: [hitAt + 150, hitAt + 400, standAt - 200, standAt], outputRange: [0, 1, 1, 0], ...clamp }) : null;
    return { casterX, targetX, fadeOut, dark, aura, word, bars, flash, burst, dust, stars };
  }, [kind, reduce, total, t, pos, size]);

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
    const to = reduce ? 1600 : 4050;
    return base.map((a0, i) => {
      const angle = (x: number) => a0 + (reduce ? 0 : ((x - from) / 1000) * 0.9);
      const s = 40 * sizes[i] * Math.max(0.8, k);
      return {
        s,
        op: [0.92, 0.8, 0.6, 0.75, 0.5][i],
        x: sample(t, from, to, reduce ? 1 : 24, (x) => cx + Math.cos(angle(x)) * rx - s / 2),
        y: sample(t, from, to, reduce ? 1 : 24, (x) => cy + Math.sin(angle(x)) * ry - s / 2 + Math.sin(x / 180 + i) * 4),
        rot: `${[-12, 14, 8, -6, 4][i]}deg`,
      };
    });
  }, [kind, reduce, t, pos, size, ground, chibiH, width, k]);

  // Звёздочки над головой упавшего: голова лежащего (перевёрнут, смотрит влево) — у правого края рамки
  const starRing = useMemo(() => {
    if (kind !== 'mog') return [];
    const hx = size - 15 * k;
    const hy = 70 * k;
    const from = reduce ? 1500 : 4000;
    const to = reduce ? 2600 : 6200;
    return [0, 2.1, 4.2].map((a0) => ({
      x: sample(t, from, to, reduce ? 1 : 22, (x) => hx + Math.cos(a0 + (reduce ? 0 : (x - from) / 260)) * 26 * k - 10),
      y: sample(t, from, to, reduce ? 1 : 22, (x) => hy + Math.sin(a0 + (reduce ? 0 : (x - from) / 260)) * 7 * k - 10),
    }));
  }, [kind, reduce, t, size, k]);

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
        {skulls.map((s, i) => (
          <Animated.View
            key={i}
            style={{ position: 'absolute', left: 0, top: 0, opacity: Animated.multiply(anim.aura, s.op), transform: [{ translateX: s.x }, { translateY: s.y }, { rotate: s.rot }] }}
          >
            <Skull size={s.s} />
          </Animated.View>
        ))}

        {/* тот, к кому применили */}
        <Animated.View style={[styles.actor, { top: ground, width: size, height: chibiH, transform: [{ translateX: anim.targetX }] }]}>
          <Chibi
            look={target.look}
            emotion={phase.targetFace[0]}
            value={phase.targetFace[1]}
            pose={phase.target}
            size={size}
            flip
            eyesClosed={phase.closed}
          />
          {anim.stars
            ? starRing.map((s, i) => (
                <Animated.View key={i} style={{ position: 'absolute', left: 0, top: 0, opacity: anim.stars!, transform: [{ translateX: s.x }, { translateY: s.y }] }}>
                  <Icon name="star" size={20} color={INK} fill="#FFD966" strokeWidth={1.4} />
                </Animated.View>
              ))
            : null}
        </Animated.View>

        {/* тот, кто применил */}
        <Animated.View style={[styles.actor, { top: ground, width: size, height: chibiH, transform: [{ translateX: anim.casterX }] }]}>
          {anim.dust ? (
            <Animated.View style={{ position: 'absolute', left: -size * 0.25, top: chibiH * 0.82, opacity: anim.dust }}>
              <Svg width={size * 0.5} height={size * 0.2} viewBox="0 0 50 20">
                <Circle cx={38} cy={12} r={7} fill="#FFFFFF" opacity={0.75} />
                <Circle cx={24} cy={9} r={5} fill="#FFFFFF" opacity={0.6} />
                <Circle cx={12} cy={13} r={3.5} fill="#FFFFFF" opacity={0.5} />
              </Svg>
            </Animated.View>
          ) : null}
          <Chibi look={caster.look} emotion={phase.casterFace[0]} value={phase.casterFace[1]} pose={phase.caster} size={size} mog={phase.mog} />
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
              <Path d={BURST} fill="#FFF6C2" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
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
      {anim.flash ? <Animated.View style={[StyleSheet.absoluteFill, styles.flash, { opacity: anim.flash }]} /> : null}
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
});
