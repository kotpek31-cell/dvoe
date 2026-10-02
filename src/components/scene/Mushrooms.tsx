// Грибы в лесу (0.2.2): гриб на земле, корзинка сверху и гриб, который летит в корзинку.
// Гриб: ночью светится, сорванный вырастает снова через 2 с, при неверном порядке вянет и встаёт обратно.
import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { INK } from '../../lib/face';
import { haptic, nativeDriver, useReducedMotion } from '../../lib/motion';
import { emptyBasket, MUSH_HEX, MUSH_NAME, MUSH_REGROW_MS, useHunt, type MushColor } from '../../lib/mushrooms';
import { Txt } from '../ui';

// Рисунок гриба: viewBox -22 -40 44 46, низ ножки — в (0, 2)
export function MushroomArt({ color, size, glow = 0 }: { color: MushColor; size: number; glow?: number }) {
  const hex = MUSH_HEX[color];
  const white = color === 'white';
  const gid = `mg${color}`;
  return (
    <Svg width={size} height={(size * 46) / 44} viewBox="-22 -40 44 46">
      {glow > 0 ? (
        <>
          <Defs>
            <RadialGradient id={gid} cx="0" cy="-14" r="22" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={hex} stopOpacity={glow} />
              <Stop offset="1" stopColor={hex} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={0} cy={-14} r={22} fill={`url(#${gid})`} />
        </>
      ) : null}
      <Ellipse cx={0} cy={2} rx={12} ry={3.4} fill="#000000" opacity={0.22} />
      <Path d="M-5 2 C-6 -6 -5 -12 -4 -15 L4 -15 C5 -12 6 -6 5 2 Z" fill="#FFF6E6" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      <G>
        <Path d="M-17 -13 C-17 -32 17 -32 17 -13 C10 -10 -10 -10 -17 -13 Z" fill={hex} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
        {white ? (
          <>
            <Circle cx={-6} cy={-20} r={2.4} fill="#D9D4E8" />
            <Circle cx={6} cy={-23} r={2} fill="#D9D4E8" />
          </>
        ) : (
          <>
            <Circle cx={-7} cy={-21} r={2.6} fill="#FFFFFF" opacity={0.95} />
            <Circle cx={5} cy={-24} r={2} fill="#FFFFFF" opacity={0.95} />
            <Circle cx={9} cy={-16} r={1.6} fill="#FFFFFF" opacity={0.95} />
          </>
        )}
        <Path d="M-11 -20 C-9 -25 -5 -27 -1 -28" fill="none" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" opacity={0.35} />
      </G>
    </Svg>
  );
}

type PatchProps = {
  color: MushColor;
  x: number; // низ ножки, пиксели родителя
  y: number;
  size: number; // ширина рисунка
  night: boolean;
  goneAt: number; // когда сорвали (0 — растёт)
  shake: number; // неверный порядок — вянет
  zIndex?: number;
  disabled?: boolean;
  onPress: () => void;
};

// Гриб на земле. Нажатие — чибик идёт срывать. Рисунок стоит по глубине среди чибиков, а зона нажатия — поверх всех:
// гриб за чибиком всё равно можно сорвать.
const HIT_Z = 4000;
export const MushroomPatch = memo(function MushroomPatch({ color, x, y, size, night, goneAt, shake, zIndex, disabled, onPress }: PatchProps) {
  const reduce = useReducedMotion();
  const grow = useRef(new Animated.Value(goneAt ? 0 : 1)).current;
  const wilt = useRef(new Animated.Value(0)).current;
  const first = useRef(shake);

  // Сорвали — пропал; через 2 с вырастает (ножка растёт из земли)
  useEffect(() => {
    if (!goneAt) {
      grow.setValue(1);
      return;
    }
    grow.setValue(0);
    const left = Math.max(0, goneAt + MUSH_REGROW_MS - Date.now());
    const anim = Animated.sequence([
      Animated.delay(left),
      Animated.timing(grow, { toValue: 1, duration: reduce ? 1 : 520, easing: Easing.out(Easing.back(2)), useNativeDriver: nativeDriver }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [goneAt, grow, reduce]);

  // Не тот порядок: все грибы вянут и встают обратно
  useEffect(() => {
    if (shake === first.current) return;
    wilt.setValue(0);
    if (reduce) return;
    Animated.sequence([
      Animated.timing(wilt, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }),
      Animated.delay(700),
      Animated.timing(wilt, { toValue: 0, duration: 520, easing: Easing.out(Easing.back(1.6)), useNativeDriver: nativeDriver }),
    ]).start();
  }, [shake, wilt, reduce]);

  const h = (size * 46) / 44;
  const side = color === 'blue' || color === 'white' ? -1 : 1;
  const hit = size * 1.3;
  return (
    <>
    <Animated.View
      pointerEvents="none"
      style={[
        styles.patch,
        {
          left: x - size / 2,
          top: y - (h * 42) / 46,
          width: size,
          height: h,
          zIndex,
          opacity: grow.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] }),
          transform: [
            { translateY: h * 0.45 },
            { scale: grow },
            { rotate: wilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${side * 26}deg`] }) },
            { translateY: wilt.interpolate({ inputRange: [0, 1], outputRange: [-h * 0.45, -h * 0.4] }) },
          ],
        },
      ]}
    >
      <MushroomArt color={color} size={size} glow={night ? 0.5 : 0} />
    </Animated.View>
    {goneAt || disabled ? null : (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Гриб, ${MUSH_NAME[color]}. Нажми — сорвать`}
        style={[styles.patch, { left: x - hit / 2, top: y - hit * 0.85, width: hit, height: hit, zIndex: HIT_Z }]}
      />
    )}
    </>
  );
});

// ---------- корзинка ----------
export const BASKET_W = 220;
export const BASKET_H = 54;
export const basketSlot = (i: number) => ({ x: 60 + i * 34, y: BASKET_H / 2 }); // от левого верхнего угла корзинки

export function Basket({ top, width }: { top: number; width: number }) {
  const { basket, shake, pop, checking } = useHunt();
  const reduce = useReducedMotion();
  const jolt = useRef(new Animated.Value(0)).current;
  const bump = useRef(new Animated.Value(0)).current;
  const firstShake = useRef(shake);
  const firstPop = useRef(pop);

  useEffect(() => {
    if (shake === firstShake.current || reduce) return;
    jolt.setValue(0);
    Animated.timing(jolt, { toValue: 1, duration: 620, easing: Easing.linear, useNativeDriver: nativeDriver }).start();
    haptic.warning();
  }, [shake, jolt, reduce]);

  useEffect(() => {
    if (pop === firstPop.current || reduce) return;
    bump.setValue(0);
    Animated.timing(bump, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }).start();
  }, [pop, bump, reduce]);

  const left = (width - BASKET_W) / 2;
  return (
    <Animated.View
      style={[
        styles.basketWrap,
        {
          left,
          top,
          transform: [
            { translateX: jolt.interpolate({ inputRange: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1], outputRange: [0, -9, 8, -6, 5, -2, 0] }) },
            { rotate: jolt.interpolate({ inputRange: [0, 0.15, 0.3, 0.45, 0.6, 1], outputRange: ['0deg', '-3deg', '3deg', '-2deg', '1deg', '0deg'] }) },
            { scale: bump.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 1.06, 1] }) },
          ],
        },
      ]}
    >
      <Pressable
        onPress={() => {
          if (!basket.length || checking) return;
          haptic.light();
          emptyBasket();
        }}
        accessibilityRole="button"
        accessibilityLabel={basket.length ? `Корзинка: ${basket.map((c) => MUSH_NAME[c]).join(', ')}. Нажми — высыпать` : 'Корзинка для грибов: пока пусто'}
        style={styles.basket}
      >
        <Svg width={34} height={30} viewBox="0 0 34 30" style={styles.handle}>
          <Path d="M5 22 C5 8 27 6 29 20" fill="none" stroke="#C98A4B" strokeWidth={3} strokeLinecap="round" />
          <Path d="M2 18 H32 L28 29 H6 Z" fill="#C98A4B" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M6 23 H28" stroke="#8E5A30" strokeWidth={1.4} />
        </Svg>
        {[0, 1, 2, 3, 4].map((i) => {
          const c = basket[i];
          const s = basketSlot(i);
          return (
            <View key={i} style={[styles.slot, { left: s.x - 14, top: s.y - 14 }, c ? styles.slotFull : null]}>
              {c ? <MushroomArt color={c} size={22} /> : null}
            </View>
          );
        })}
      </Pressable>
    </Animated.View>
  );
}

// Гриб летит от земли в ячейку корзинки (дугой), потом исчезает — в ячейке он уже лежит
export function FlyingShroom({ from, to, color, nonce, size }: { from: { x: number; y: number }; to: { x: number; y: number }; color: MushColor; nonce: number; size: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const reduce = useReducedMotion();
  useEffect(() => {
    t.setValue(0);
    if (reduce) return;
    Animated.timing(t, { toValue: 1, duration: 560, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }).start();
  }, [nonce, t, reduce]);
  if (reduce) return null;
  const peak = Math.min(from.y, to.y) - 60;
  const steps = [0, 0.25, 0.5, 0.75, 1];
  // квадратичная кривая Безье через вершину
  const bez = (a: number, m: number, b: number, p: number) => (1 - p) * (1 - p) * a + 2 * (1 - p) * p * m + p * p * b;
  const mx = (from.x + to.x) / 2;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -size / 2,
        top: -size / 2,
        zIndex: 6000,
        opacity: t.interpolate({ inputRange: [0, 0.05, 0.92, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateX: t.interpolate({ inputRange: steps, outputRange: steps.map((p) => bez(from.x, mx, to.x, p)) }) },
          { translateY: t.interpolate({ inputRange: steps, outputRange: steps.map((p) => bez(from.y, peak, to.y, p)) }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '320deg'] }) },
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.62] }) },
        ],
      }}
    >
      <MushroomArt color={color} size={size} />
    </Animated.View>
  );
}

// «Чпок» над чибиком
export function PluckWord({ x, y, nonce }: { x: number; y: number; nonce: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, { toValue: 1, duration: 760, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }).start();
  }, [nonce, t]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - 50,
        top: y - 20,
        width: 100,
        alignItems: 'center',
        zIndex: 6000,
        opacity: t.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -26] }) }, { scale: t.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.6, 1.12, 1] }) }],
      }}
    >
      <Txt weight="display" size={16} color="#FFF4C2" style={styles.word}>
        чпок
      </Txt>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  patch: { position: 'absolute' },
  basketWrap: { position: 'absolute', width: BASKET_W, height: BASKET_H, zIndex: 40 },
  basket: {
    width: BASKET_W,
    height: BASKET_H,
    borderRadius: BASKET_H / 2,
    backgroundColor: 'rgba(24,18,40,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  handle: { position: 'absolute', left: 9, top: 10 },
  slot: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  slotFull: { borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' },
  word: { textShadowColor: INK, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
});
