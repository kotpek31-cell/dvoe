// Реакции над головой: нарисованные значки в белом облачке (не эмодзи)
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import type { ReactionKind } from '../../lib/roomLink';
import { INK } from '../../lib/face';
import { nativeDriver, useReducedMotion } from '../../lib/motion';

const line = { stroke: INK, strokeWidth: 1.6, strokeLinejoin: 'round' as const };

export const REACTION_LABEL: Record<ReactionKind, string> = {
  heart: 'сердце',
  laugh: 'смех',
  wow: 'вау',
  fire: 'огонь',
  tear: 'слеза',
  star: 'звезда',
};

// Значок в координатах −12…12
export function ReactionGlyph({ kind }: { kind: ReactionKind }) {
  switch (kind) {
    case 'heart':
      return <Path d="M0 9 C-7 3.6 -10.4 0 -10.4 -4.4 C-10.4 -7.4 -8.2 -9.8 -5.2 -9.8 C-3 -9.8 -1.2 -8.6 0 -6.8 C1.2 -8.6 3 -9.8 5.2 -9.8 C8.2 -9.8 10.4 -7.4 10.4 -4.4 C10.4 0 7 3.6 0 9 Z" fill="#FF6B8A" {...line} />;
    case 'laugh':
      return (
        <G>
          <Circle r={10.5} fill="#FFD45E" {...line} />
          <Path d="M-6 -2.6 L-3.4 -4.4 L-6 -5.8 M6 -2.6 L3.4 -4.4 L6 -5.8" fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M-6 1 C-5 7 5 7 6 1 Z" fill="#FFFFFF" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
        </G>
      );
    case 'wow':
      return (
        <G>
          <Circle r={10.5} fill="#FFD45E" {...line} />
          <Circle cx={-3.6} cy={-2.6} r={1.8} fill={INK} />
          <Circle cx={3.6} cy={-2.6} r={1.8} fill={INK} />
          <Ellipse cx={0} cy={4.4} rx={2.6} ry={3.4} fill={INK} />
        </G>
      );
    case 'fire':
      return (
        <G>
          <Path d="M0 10.5 C-6 10.5 -8.6 6.4 -8.6 2.4 C-8.6 -2.4 -5 -5 -3.4 -9 C-2.4 -6.4 -1 -5 0.6 -4.6 C0.4 -7.6 1.6 -10.4 4.4 -12 C4.8 -7.6 8.6 -4 8.6 2 C8.6 6.6 5.4 10.5 0 10.5 Z" fill="#FF8A3D" {...line} />
          <Path d="M0 9 C-3 9 -4 6.6 -4 4.8 C-4 2.4 -2 1 -1 -1.4 C0 0.6 1 1.4 2.4 1.6 C3.4 3 4 4.4 4 5.6 C4 7.6 2.6 9 0 9 Z" fill="#FFE38A" />
        </G>
      );
    case 'tear':
      return (
        <G>
          <Path d="M0 -11 C4 -5 7.4 -0.6 7.4 3.4 C7.4 7.6 4 10.6 0 10.6 C-4 10.6 -7.4 7.6 -7.4 3.4 C-7.4 -0.6 -4 -5 0 -11 Z" fill="#7CC8FF" {...line} />
          <Ellipse cx={-2.6} cy={3} rx={1.8} ry={3} fill="#FFFFFF" opacity={0.7} />
        </G>
      );
    case 'star':
      return <Path d="M0 -11 L3.2 -3.6 L11 -3.2 L5 1.8 L7 9.6 L0 5.4 L-7 9.6 L-5 1.8 L-11 -3.2 L-3.2 -3.6 Z" fill="#FFD45E" {...line} />;
  }
}

// Значок без облачка (кнопки панели реакций)
export function ReactionIcon({ kind, size }: { kind: ReactionKind; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="-13 -13 26 26">
      <ReactionGlyph kind={kind} />
    </Svg>
  );
}

// Облачко над головой: выскакивает, висит, тает (всего 3 с)
export function ReactionBubble({ kind, nonce, size = 40 }: { kind: ReactionKind; nonce: number; size?: number }) {
  const reduce = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    t.setValue(0);
    const anim = Animated.timing(t, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: nativeDriver });
    anim.start();
    return () => anim.stop();
  }, [nonce, t]);
  const r = 19;
  const h = size * (r * 2 + 8) / (r * 2);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        width: size,
        height: h,
        opacity: t.interpolate({ inputRange: [0, 0.05, 0.85, 1], outputRange: [0, 1, 1, 0] }),
        transform: reduce
          ? []
          : [
              { translateY: t.interpolate({ inputRange: [0, 0.08, 1], outputRange: [10, 0, -8] }) },
              { scale: t.interpolate({ inputRange: [0, 0.06, 0.12, 1], outputRange: [0.4, 1.12, 1, 1] }) },
            ],
      }}
    >
      <Svg width={size} height={h} viewBox={`${-r - 2} ${-r - 2} ${r * 2 + 4} ${r * 2 + 10}`}>
        <Path d={`M-5 ${r - 1.6} L0 ${r + 6} L5 ${r - 1.6} Z`} fill="#FFFFFF" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
        <Circle r={r} fill="#FFFFFF" stroke={INK} strokeWidth={1.8} />
        <Path d={`M-4.2 ${r - 2.6} L0 ${r + 3.4} L4.2 ${r - 2.6} Z`} fill="#FFFFFF" />
        <G transform={`scale(${r / 14})`}>
          <ReactionGlyph kind={kind} />
        </G>
      </Svg>
    </Animated.View>
  );
}
