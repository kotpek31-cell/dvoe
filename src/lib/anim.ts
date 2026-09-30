// Помощники для анимаций: одна «часовая» величина 0→1 крутится по кругу,
// а разные объекты берут из неё свою фазу. Так десяток светлячков — это всего два цикла.
import type { Animated } from 'react-native';

const wrap = (x: number) => ((x % 1) + 1) % 1;

// Пила: (v + off) mod 1, переведённая в диапазон [a, b]
export function saw(v: Animated.Value, off: number, a: number, b: number) {
  const o = wrap(off);
  if (o === 0) return v.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
  const cut = 1 - o;
  return v.interpolate({
    inputRange: [0, cut, Math.min(1, cut + 0.0001), 1],
    outputRange: [a + (b - a) * o, b, a, a + (b - a) * o],
  });
}

// Треугольная волна 0→1→0 за один круг со сдвигом off, в диапазоне [a, b]
export function tri(v: Animated.Value, off: number, a: number, b: number) {
  const f = (p: number) => {
    const q = wrap(p);
    return q < 0.5 ? 2 * q : 2 - 2 * q;
  };
  const points = new Set<number>([0, 1, wrap(-off), wrap(0.5 - off)]);
  const input = [...points].sort((x, y) => x - y);
  return v.interpolate({ inputRange: input, outputRange: input.map((x) => a + (b - a) * f(x + off)) });
}
