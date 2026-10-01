// Микровзаимодействия: разлёт сердечек, конфетти и всплывающая плашка-тост
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { saw } from '../lib/anim';
import { nativeDriver, useReducedMotion } from '../lib/motion';
import { C, F } from '../theme';
import { Icon, type IconName } from './Icon';

// [dx, dy, поворот, масштаб, задержка 0…0.2]
const HEARTS: [number, number, number, number, number][] = [
  [-64, -128, -18, 1.15, 0],
  [52, -140, 16, 1, 0.05],
  [-20, -172, -6, 1.3, 0.1],
  [84, -96, 24, 0.9, 0.15],
  [-92, -84, -28, 0.85, 0],
  [18, -122, 8, 1.1, 0.05],
  [-40, -152, -12, 0.95, 0.1],
  [70, -162, 20, 1.2, 0.15],
  [-72, -40, -30, 0.8, 0.05],
  [96, -48, 30, 0.8, 0.1],
];

const CONFETTI: [number, number, number, number][] = [
  [-110, -150, 320, 0],
  [90, -170, -280, 0.04],
  [-40, -200, 200, 0.08],
  [140, -110, 360, 0.02],
  [-150, -90, -240, 0.06],
  [30, -190, 180, 0.1],
];

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

function HeartBurst({ x, y, scale }: { x: number; y: number; scale: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 1700, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
  }, [v]);
  return (
    <View pointerEvents="none" style={[styles.origin, { left: x - 12, top: y - 12 }]}>
      {HEARTS.map(([dx, dy, rot, sc, d], i) => {
        const range = [d, 1];
        return (
          <Animated.View
            key={i}
            style={[
              styles.abs,
              {
                opacity: v.interpolate({ inputRange: [d, d + 0.08, 0.72, 1], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }),
                transform: [
                  { translateX: v.interpolate({ inputRange: range, outputRange: [0, dx * scale], extrapolate: 'clamp' }) },
                  { translateY: v.interpolate({ inputRange: range, outputRange: [0, dy * scale], extrapolate: 'clamp' }) },
                  { rotate: v.interpolate({ inputRange: range, outputRange: ['0deg', `${rot}deg`], extrapolate: 'clamp' }) },
                  { scale: v.interpolate({ inputRange: range, outputRange: [0.3, sc], extrapolate: 'clamp' }) },
                ],
              },
            ]}
          >
            <Icon name="heart" size={24} color="#FFFFFF" fill="#FF4D7A" strokeWidth={1.6} />
          </Animated.View>
        );
      })}
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

function ConfettiBurst({ colors, width }: { colors: string[]; width: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }).start();
  }, [v]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 18 }, (_, i) => {
        const [dx, dy, rot, d] = CONFETTI[i % CONFETTI.length];
        const left = 30 + ((i * 53) % Math.max(60, width - 60));
        const round = i % 3 === 0;
        return (
          <Animated.View
            key={i}
            style={[
              styles.piece,
              {
                left,
                width: round ? 7 : 8,
                height: round ? 7 : 12,
                borderRadius: round ? 4 : 2,
                backgroundColor: colors[i % colors.length],
                opacity: v.interpolate({ inputRange: [d, d + 0.05, 0.75, 1], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }),
                transform: [
                  { translateX: v.interpolate({ inputRange: [d, 1], outputRange: [0, dx * (0.6 + (i % 4) * 0.15)], extrapolate: 'clamp' }) },
                  { translateY: v.interpolate({ inputRange: [d, 1], outputRange: [0, dy * (0.7 + (i % 3) * 0.15)], extrapolate: 'clamp' }) },
                  { rotate: v.interpolate({ inputRange: [d, 1], outputRange: ['0deg', `${rot}deg`], extrapolate: 'clamp' }) },
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
  const bursts = useBursts(reduce ? 0 : trigger, 1500);
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
        <Icon name={icon} size={20} color={C.accent} fill={icon === 'heart' ? C.accent : 'none'} />
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
    paddingVertical: 11,
    paddingLeft: 12,
    paddingRight: 18,
    borderRadius: 22,
    backgroundColor: 'rgba(24,18,40,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  toastText: { color: C.text, fontFamily: F.heavy, fontSize: 14, flexShrink: 1 },
});

// Искорки «дай пять»: короткая вспышка из трёх звёздочек в точке встречи ладошек
const SPARKS: [number, number, number][] = [
  [0, -26, 1.2],
  [-22, -8, 0.8],
  [22, -10, 0.9],
];

function SparkBurst({ x, y, scale }: { x: number; y: number; scale: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
  }, [v]);
  return (
    <View pointerEvents="none" style={[styles.origin, { left: x - 12, top: y - 12 }]}>
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
                { scale: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.2, sc * 1.2, sc] }) },
              ],
            },
          ]}
        >
          <Icon name="sparkle" size={24} color={C.ink} fill="#FFE89A" strokeWidth={1.4} />
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
