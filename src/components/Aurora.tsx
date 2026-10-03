// Фон-аврора: мягкие цветные пятна медленно плывут. Анимация на native driver
// (не нагружает JS), останавливается при «уменьшить движение» и когда фон не виден.
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { nativeDriver, useReducedMotion } from '../lib/motion';
import { C } from '../theme';

type Blob = { color: string; opacity: number; size: number; x: number; y: number; dx: number; dy: number; scale: number };

// x, y, size — доли ширины экрана
const BLOBS: Blob[] = [
  { color: '#FF6B8A', opacity: 0.42, size: 1.1, x: -0.33, y: -0.23, dx: 0.15, dy: 0.1, scale: 1.12 },
  { color: '#7B61FF', opacity: 0.45, size: 1.18, x: 0.36, y: -0.1, dx: -0.18, dy: 0.13, scale: 1.1 },
  { color: '#2EC4B6', opacity: 0.26, size: 1.23, x: -0.44, y: 1.3, dx: 0.12, dy: -0.1, scale: 1.08 },
  { color: '#4D7CFE', opacity: 0.3, size: 1.2, x: 0.38, y: 2.1, dx: -0.14, dy: -0.12, scale: 1.1 },
];

// Звёздная пыль поверх пятен (3.0): неподвижные точки, место — доли ширины и высоты экрана.
// Числа посчитаны один раз (без случайности), чтобы на каждом экране небо было одно и то же.
const DUST = Array.from({ length: 34 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233 + 4.1) * 24634.6345;
  const c = Math.sin(i * 39.425 + 1.7) * 13758.137;
  const f = (n: number) => n - Math.floor(n);
  return { x: f(a), y: f(b), r: 0.5 + f(c) * 0.9, o: 0.1 + f(a + b) * 0.3 };
});

export function Aurora({ paused = false }: { paused?: boolean }) {
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce || paused) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 16000, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
        Animated.timing(t, { toValue: 0, duration: 16000, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, paused, t]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.base]}>
      {BLOBS.map((b, i) => {
        const size = b.size * width;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: b.x * width,
              top: b.y * width,
              width: size,
              height: size,
              transform: [
                { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, b.dx * width] }) },
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, b.dy * width] }) },
                { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, b.scale] }) },
              ],
            }}
          >
            <Svg width={size} height={size}>
              <Defs>
                <RadialGradient id={`aurora-${i}`} cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={b.color} stopOpacity={b.opacity} />
                  <Stop offset="0.68" stopColor={b.color} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#aurora-${i})`} />
            </Svg>
          </Animated.View>
        );
      })}
      {/* точки — обычными View: Svg на весь экран занял бы на Android лишнюю картинку размером с экран */}
      {DUST.map((d, i) => (
        <View
          key={`d${i}`}
          style={{ position: 'absolute', left: d.x * width - d.r, top: d.y * height - d.r, width: d.r * 2, height: d.r * 2, borderRadius: d.r, backgroundColor: '#FFFFFF', opacity: d.o }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: C.bg, overflow: 'hidden' },
});
