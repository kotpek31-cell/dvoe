// Микровзаимодействия: разлёт сердечек, конфетти, искры, круг от касания и всплывающая плашка-тост.
// 3.0: сердечки с объёмом и вспышкой света, конфетти разной формы летит по дуге и падает,
// «дай пять» — с ударной волной, касание земли оставляет круг (Ripple).
// Всё — трансформации и прозрачность на native driver: одна анимация на разлёт, без перерисовок.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { saw } from '../lib/anim';
import { nativeDriver, useReducedMotion } from '../lib/motion';
import { C, F } from '../theme';
import { Icon, type IconName } from './Icon';

const clamp = { extrapolate: 'clamp' as const };

// [dx, dy, поворот, масштаб, задержка 0…0.2, оттенок]
const HEARTS: [number, number, number, number, number, 0 | 1][] = [
  [-64, -128, -18, 1.15, 0, 0],
  [52, -140, 16, 1, 0.05, 1],
  [-20, -172, -6, 1.3, 0.1, 0],
  [84, -96, 24, 0.9, 0.15, 0],
  [-92, -84, -28, 0.85, 0, 1],
  [18, -122, 8, 1.1, 0.05, 0],
  [-40, -152, -12, 0.95, 0.1, 1],
  [70, -162, 20, 1.2, 0.15, 0],
  [-72, -40, -30, 0.8, 0.05, 0],
  [96, -48, 30, 0.8, 0.1, 1],
  [-6, -84, 4, 0.7, 0.02, 1],
  [36, -64, 14, 0.65, 0.12, 0],
];
// Искорки между сердечками: [dx, dy, масштаб, задержка]
const GLINTS: [number, number, number, number][] = [
  [-44, -104, 0.9, 0.04],
  [30, -150, 1.1, 0.1],
  [78, -128, 0.7, 0.02],
  [-86, -124, 0.8, 0.12],
  [0, -196, 0.9, 0.16],
  [-28, -56, 0.6, 0.08],
];
const HEART_D = 'M12 21C12 21 3 15.5 3 9.2C3 6.3 5.2 4 8 4c1.7 0 3.2.9 4 2.3C12.8 4.9 14.3 4 16 4c2.8 0 5 2.3 5 5.2C21 15.5 12 21 12 21z';
const SPARK_D = 'M12 2 C12.9 8.6 15.4 11.1 22 12 C15.4 12.9 12.9 15.4 12 22 C11.1 15.4 8.6 12.9 2 12 C8.6 11.1 11.1 8.6 12 2 Z';
const HEART_TONES = [
  ['#FF9CB6', '#FF4D7A'],
  ['#FFC2D6', '#FF7FA6'],
] as const;

// Сердечко с объёмом: градиент, белая кайма и блик
function HeartArt({ size, tone }: { size: number; tone: 0 | 1 }) {
  const [a, b] = HEART_TONES[tone];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id={`hbg${tone}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={a} />
          <Stop offset="1" stopColor={b} />
        </LinearGradient>
      </Defs>
      <Path d={HEART_D} fill={`url(#hbg${tone})`} stroke="#FFFFFF" strokeWidth={1.5} strokeLinejoin="round" />
      <Ellipse cx={8.2} cy={8.2} rx={2.6} ry={1.6} fill="#FFFFFF" opacity={0.6} transform="rotate(-32 8.2 8.2)" />
    </Svg>
  );
}

// Мягкое круглое свечение (радиальный градиент к прозрачному краю)
function Halo({ size, color, id, opacity = 0.9 }: { size: number; color: string; id: string; opacity?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={id} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="0.5" stopColor={color} stopOpacity={opacity * 0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={50} cy={50} r={50} fill={`url(#${id})`} />
    </Svg>
  );
}

// Расходящееся кольцо
function Ring({ size, color, width = 3 }: { size: number; color: string; width?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={46} fill="none" stroke={color} strokeWidth={(width * 100) / size} />
    </Svg>
  );
}

// Каждый новый trigger (число > 0) запускает новый разлёт
function useBursts(trigger: number, lifetime: number) {
  const [bursts, setBursts] = useState<number[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    if (!trigger) return;
    setBursts((b) => [...b.slice(-2), trigger]);
    timers.current.push(setTimeout(() => setBursts((b) => b.filter((id) => id !== trigger)), lifetime));
  }, [trigger, lifetime]);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );
  return bursts;
}

function useRun(duration: number, easing: (t: number) => number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: nativeDriver }).start();
  }, [v, duration, easing]);
  return v;
}

const OUT_CUBIC = Easing.out(Easing.cubic);
const OUT_QUAD = Easing.out(Easing.quad);
const LINEAR = Easing.linear;

function HeartBurst({ x, y, scale }: { x: number; y: number; scale: number }) {
  const v = useRun(1700, OUT_CUBIC);
  const glow = 150 * scale;
  return (
    <View pointerEvents="none" style={[styles.origin, { left: x - 12, top: y - 12 }]}>
      {/* вспышка света и кольцо в точке касания */}
      <Animated.View
        style={[
          styles.abs,
          {
            left: 12 - glow / 2,
            top: 12 - glow / 2,
            opacity: v.interpolate({ inputRange: [0, 0.12, 0.6], outputRange: [0, 0.9, 0], ...clamp }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 0.6], outputRange: [0.3, 1.25], ...clamp }) }],
          },
        ]}
      >
        <Halo size={glow} color="#FF8FB3" id="hbHalo" />
      </Animated.View>
      <Animated.View
        style={[
          styles.abs,
          {
            left: 12 - glow * 0.35,
            top: 12 - glow * 0.35,
            opacity: v.interpolate({ inputRange: [0, 0.08, 0.45], outputRange: [0, 0.9, 0], ...clamp }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 0.45], outputRange: [0.2, 1.5], ...clamp }) }],
          },
        ]}
      >
        <Ring size={glow * 0.7} color="#FFD3E2" width={2.5} />
      </Animated.View>
      {HEARTS.map(([dx, dy, rot, sc, d, tone], i) => {
        const range = [d, 1];
        return (
          <Animated.View
            key={i}
            style={[
              styles.abs,
              {
                opacity: v.interpolate({ inputRange: [d, d + 0.08, 0.72, 1], outputRange: [0, 1, 1, 0], ...clamp }),
                transform: [
                  { translateX: v.interpolate({ inputRange: range, outputRange: [0, dx * scale], ...clamp }) },
                  { translateY: v.interpolate({ inputRange: range, outputRange: [0, dy * scale], ...clamp }) },
                  { rotate: v.interpolate({ inputRange: range, outputRange: ['0deg', `${rot}deg`], ...clamp }) },
                  { scale: v.interpolate({ inputRange: [d, d + 0.12, 1], outputRange: [0.2, sc * 1.25, sc], ...clamp }) },
                ],
              },
            ]}
          >
            <HeartArt size={24} tone={tone} />
          </Animated.View>
        );
      })}
      {GLINTS.map(([dx, dy, sc, d], i) => (
        <Animated.View
          key={`g${i}`}
          style={[
            styles.abs,
            {
              left: 4,
              top: 4,
              opacity: v.interpolate({ inputRange: [d, d + 0.1, 0.5, 0.8], outputRange: [0, 1, 0.9, 0], ...clamp }),
              transform: [
                { translateX: v.interpolate({ inputRange: [d, 1], outputRange: [0, dx * scale], ...clamp }) },
                { translateY: v.interpolate({ inputRange: [d, 1], outputRange: [0, dy * scale], ...clamp }) },
                { scale: v.interpolate({ inputRange: [d, d + 0.15, 0.8], outputRange: [0.2, sc * 1.2, sc * 0.5], ...clamp }) },
              ],
            },
          ]}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Path d={SPARK_D} fill="#FFFFFF" />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

export function HeartsBurst({ trigger, x, y, scale = 1 }: { trigger: number; x: number; y: number; scale?: number }) {
  const reduce = useReducedMotion();
  const bursts = useBursts(reduce ? 0 : trigger, 1900);
  return (
    <>
      {bursts.map((id) => (
        <HeartBurst key={id} x={x} y={y} scale={scale} />
      ))}
    </>
  );
}

// [dx, пик dy, поворот, задержка]
const CONFETTI: [number, number, number, number][] = [
  [-110, -150, 320, 0],
  [90, -170, -280, 0.04],
  [-40, -200, 200, 0.08],
  [140, -110, 360, 0.02],
  [-150, -90, -240, 0.06],
  [30, -190, 180, 0.1],
  [-80, -180, 260, 0.03],
  [60, -130, -200, 0.07],
];
const PIECES = 28;

function ConfettiBurst({ colors, width }: { colors: string[]; width: number }) {
  const v = useRun(1600, LINEAR);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: PIECES }, (_, i) => {
        const [dx, dy, rot, d] = CONFETTI[i % CONFETTI.length];
        const left = 30 + ((i * 53) % Math.max(60, width - 60));
        const kind = i % 4; // 0 — кружок, 1 и 2 — бумажка, 3 — ленточка
        const kx = 0.6 + (i % 4) * 0.15;
        const ky = 0.7 + (i % 3) * 0.15;
        // по дуге: быстро вверх, зависает, падает
        const up = d + (1 - d) * 0.36;
        return (
          <Animated.View
            key={i}
            style={[
              styles.piece,
              {
                left,
                width: kind === 0 ? 7 : kind === 3 ? 4 : 8,
                height: kind === 0 ? 7 : kind === 3 ? 16 : 12,
                borderRadius: kind === 0 ? 4 : 2,
                backgroundColor: colors[i % colors.length],
                opacity: v.interpolate({ inputRange: [d, d + 0.05, 0.8, 1], outputRange: [0, 1, 1, 0], ...clamp }),
                transform: [
                  { translateX: v.interpolate({ inputRange: [d, up, 1], outputRange: [0, dx * kx * 0.8, dx * kx * 1.05], ...clamp }) },
                  { translateY: v.interpolate({ inputRange: [d, up, d + (1 - d) * 0.5, 1], outputRange: [0, dy * ky, dy * ky * 0.96, dy * ky * 0.3 + 30], ...clamp }) },
                  { rotate: v.interpolate({ inputRange: [d, 1], outputRange: ['0deg', `${rot * 1.6}deg`], ...clamp }) },
                  { scaleX: v.interpolate({ inputRange: [d, d + 0.2, d + 0.4, d + 0.6, 1], outputRange: [1, 0.35, 1, 0.35, 1], ...clamp }) },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export function Confetti({ trigger, colors, width }: { trigger: number; colors: string[]; width: number }) {
  const reduce = useReducedMotion();
  const bursts = useBursts(reduce ? 0 : trigger, 1800);
  return (
    <>
      {bursts.map((id) => (
        <ConfettiBurst key={id} colors={colors.length ? colors : [C.accent]} width={width} />
      ))}
    </>
  );
}

// Плашка сверху: появляется с отскоком, исчезает плавно
export function Toast({ text, icon = 'heart', top }: { text: string | null; icon?: IconName; top: number }) {
  const [shown, setShown] = useState<string | null>(text);
  const v = useRef(new Animated.Value(text ? 1 : 0)).current;
  useEffect(() => {
    if (text) {
      setShown(text);
      v.setValue(0);
      Animated.spring(v, { toValue: 1, useNativeDriver: nativeDriver, speed: 14, bounciness: 10 }).start();
    } else {
      Animated.timing(v, { toValue: 0, duration: 220, useNativeDriver: nativeDriver }).start(({ finished }) => {
        if (finished) setShown(null);
      });
    }
  }, [text, v]);
  if (!shown) return null;
  return (
    <View pointerEvents="none" style={[styles.toastWrap, { top }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          {
            opacity: v,
            transform: [
              { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
              { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
            ],
          },
        ]}
      >
        <View style={styles.toastIcon}>
          <Icon name={icon} size={18} color={C.accent} fill={icon === 'heart' ? C.accent : 'none'} />
        </View>
        <Animated.Text style={styles.toastText} numberOfLines={2}>
          {shown}
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

// «Zzz» над спящим чибиком
export function Snore({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const reduce = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: nativeDriver }));
    loop.start();
    return () => loop.stop();
  }, [reduce, v]);
  return (
    <View pointerEvents="none" style={[styles.origin, { left: x, top: y }]}>
      {[0, 1, 2].map((i) => {
        const t = saw(v, i / 3, 0, 1);
        return (
          <Animated.Text
            key={i}
            style={[
              styles.snore,
              {
                fontSize: (13 + i * 4) * scale,
                opacity: t.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 0] }),
                transform: [
                  { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, 18 * scale] }) },
                  { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -46 * scale] }) },
                ],
              },
            ]}
          >
            z
          </Animated.Text>
        );
      })}
    </View>
  );
}

// Искорки «дай пять»: вспышка, ударная волна и звёздочки из точки встречи ладошек
const SPARKS: [number, number, number][] = [
  [0, -30, 1.2],
  [-26, -10, 0.8],
  [26, -12, 0.9],
  [-16, -28, 0.6],
  [18, -30, 0.65],
  [-30, 10, 0.5],
  [30, 8, 0.5],
];

function SparkBurst({ x, y, scale }: { x: number; y: number; scale: number }) {
  const v = useRun(900, OUT_CUBIC);
  const d = 84 * scale;
  return (
    <View pointerEvents="none" style={[styles.origin, { left: x - 12, top: y - 12 }]}>
      <Animated.View
        style={[
          styles.abs,
          {
            left: 12 - d / 2,
            top: 12 - d / 2,
            opacity: v.interpolate({ inputRange: [0, 0.1, 0.5], outputRange: [0, 1, 0], ...clamp }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 0.5], outputRange: [0.3, 1.2], ...clamp }) }],
          },
        ]}
      >
        <Halo size={d} color="#FFE89A" id="spHalo" />
      </Animated.View>
      <Animated.View
        style={[
          styles.abs,
          {
            left: 12 - d / 2,
            top: 12 - d / 2,
            opacity: v.interpolate({ inputRange: [0, 0.06, 0.55], outputRange: [0, 1, 0], ...clamp }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 0.55], outputRange: [0.15, 1.3], ...clamp }) }],
          },
        ]}
      >
        <Ring size={d} color="#FFF6CF" width={3} />
      </Animated.View>
      {SPARKS.map(([dx, dy, sc], i) => (
        <Animated.View
          key={i}
          style={[
            styles.abs,
            {
              opacity: v.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, dx * scale] }) },
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, dy * scale] }) },
                { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${i % 2 ? 40 : -40}deg`] }) },
                { scale: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.2, sc * 1.2, sc] }) },
              ],
            },
          ]}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24">
            <Path d={SPARK_D} fill="#FFE89A" stroke="#FFFFFF" strokeWidth={1.2} strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

export function SparkPop({ trigger, x, y, scale = 1 }: { trigger: number; x: number; y: number; scale?: number }) {
  const reduce = useReducedMotion();
  const bursts = useBursts(reduce ? 0 : trigger, 1000);
  return (
    <>
      {bursts.map((id) => (
        <SparkBurst key={id} x={x} y={y} scale={scale} />
      ))}
    </>
  );
}

// Круг на земле в точке касания: туда пойдёт чибик. Два кольца (приплюснутые — земля в перспективе) и пылинки.
function RippleBurst({ x, y, scale, color }: { x: number; y: number; scale: number; color: string }) {
  const v = useRun(700, OUT_QUAD);
  const d = 72 * scale;
  return (
    <View pointerEvents="none" style={[styles.origin, { left: x - 12, top: y - 12 }]}>
      {[0, 0.18].map((delay, i) => (
        <Animated.View
          key={i}
          style={[
            styles.abs,
            {
              left: 12 - d / 2,
              top: 12 - d / 2,
              opacity: v.interpolate({ inputRange: [delay, delay + 0.1, 1], outputRange: [0, 0.85 - i * 0.3, 0], ...clamp }),
              transform: [{ scaleY: 0.42 }, { scale: v.interpolate({ inputRange: [delay, 1], outputRange: [0.15, 1], ...clamp }) }],
            },
          ]}
        >
          <Ring size={d} color={color} width={2.6} />
        </Animated.View>
      ))}
      {[-1, 1].map((dir) => (
        <Animated.View
          key={dir}
          style={[
            styles.abs,
            {
              left: 9,
              top: 9,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: color,
              opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.8, 0], ...clamp }),
              transform: [
                { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, dir * 22 * scale] }) },
                { translateY: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -12 * scale, -4 * scale] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

export function Ripple({ trigger, x, y, scale = 1, color = '#FFFFFF' }: { trigger: number; x: number; y: number; scale?: number; color?: string }) {
  const reduce = useReducedMotion();
  const bursts = useBursts(reduce ? 0 : trigger, 800);
  return (
    <>
      {bursts.map((id) => (
        <RippleBurst key={id} x={x} y={y} scale={scale} color={color} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  snore: { position: 'absolute', left: 0, top: 0, fontFamily: F.display, color: '#E6E0FF' },
  origin: { position: 'absolute', width: 24, height: 24 },
  abs: { position: 'absolute', left: 0, top: 0 },
  piece: { position: 'absolute', top: 18 },
  toastWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 420,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(24,18,40,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    boxShadow: '0px 10px 28px rgba(8,4,24,0.35)',
  },
  toastIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,107,138,0.2)' },
  toastText: { color: C.text, fontFamily: F.heavy, fontSize: 14, flexShrink: 1 },
});
