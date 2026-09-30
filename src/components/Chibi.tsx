// Чибик: слои SVG (волосы сзади, ноги, тело, руки, голова, лицо, чёлка).
// Ноги, руки и покачивание анимируются трансформациями слоёв на native driver —
// это дёшево даже на слабых телефонах. Лицо — тот же движок эмоций, что на ползунках.
import { memo, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { CHIBI, CHIBI_PARTS as P, darken } from '../lib/chibi';
import type { FaceKey } from '../lib/face';
import { useScreenFocused } from '../lib/focus';
import { nativeDriver, useReducedMotion } from '../lib/motion';
import type { ChibiKind } from '../types';
import { Face } from './Face';

export type ChibiPose = 'idle' | 'walk' | 'wave' | 'sleep';

const INK = '#2B2035';
const VB = '0 0 120 170';

type Props = {
  kind: ChibiKind;
  emotion: FaceKey;
  value: number;
  pose: ChibiPose;
  size: number; // ширина, высота = size × 170/120
  look?: number;
  flip?: boolean;
};

function Layer({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <Svg width={w} height={h} viewBox={VB} style={StyleSheet.absoluteFill}>
      {children}
    </Svg>
  );
}

function ChibiView({ kind, emotion, value, pose, size, look, flip = false }: Props) {
  const reduce = useReducedMotion();
  const visible = useScreenFocused();
  const def = CHIBI[kind] ?? CHIBI.nb;
  const w = size;
  const h = Math.round((size * 170) / 120);
  const k = size / 120;
  const sleep = pose === 'sleep';

  const walk = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    walk.setValue(0);
    breath.setValue(0);
    wave.setValue(0);
    if (reduce || !visible) return;
    const anims: Animated.CompositeAnimation[] = [];
    if (pose === 'walk') {
      anims.push(Animated.loop(Animated.timing(walk, { toValue: 1, duration: 560, easing: Easing.linear, useNativeDriver: nativeDriver })));
    } else {
      const half = pose === 'sleep' ? 2000 : 1600;
      anims.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(breath, { toValue: 1, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
            Animated.timing(breath, { toValue: 0, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
          ]),
        ),
      );
    }
    if (pose === 'wave') {
      anims.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(wave, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
            Animated.timing(wave, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
          ]),
        ),
      );
    }
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [pose, reduce, visible, walk, breath, wave]);

  const a = useMemo(
    () => ({
      stepL: walk.interpolate({ inputRange: [0, 0.25, 0.5, 1], outputRange: [0, -4 * k, 0, 0] }),
      stepR: walk.interpolate({ inputRange: [0, 0.5, 0.75, 1], outputRange: [0, 0, -4 * k, 0] }),
      swingL: walk.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['9deg', '-9deg', '9deg'] }),
      swingR: walk.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-9deg', '9deg', '-9deg'] }),
      bobY: Animated.add(
        walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -2.5 * k, 0, -2.5 * k, 0] }),
        breath.interpolate({ inputRange: [0, 1], outputRange: [0, -1.2 * k] }),
      ),
      bobRot: walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['0deg', '-2.5deg', '0deg', '2.5deg', '0deg'] }),
      waveRot: wave.interpolate({ inputRange: [0, 1], outputRange: ['-100deg', '-128deg'] }),
    }),
    [walk, breath, wave, k],
  );

  // Поворот слоя вокруг точки (px, py) рисунка: сдвиг к точке, поворот, сдвиг обратно
  const dxL = (P.shoulderL.x - 60) * k;
  const dxR = (P.shoulderR.x - 60) * k;
  const dy = (P.shoulderL.y - 85) * k;
  const feet = (P.shadow.cy - 85) * k;
  const pocket = darken(def.top, 0.14);

  return (
    <View
      pointerEvents="none"
      style={{ width: w, height: h, transform: [{ rotate: sleep ? '-90deg' : '0deg' }, { scaleX: flip ? -1 : 1 }] }}
    >
      {!sleep ? (
        <Layer w={w} h={h}>
          <Ellipse cx={P.shadow.cx} cy={P.shadow.cy} rx={P.shadow.rx} ry={P.shadow.ry} fill="#1B1426" opacity={0.22} />
        </Layer>
      ) : null}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateY: a.bobY }, { translateY: feet }, { rotate: a.bobRot }, { translateY: -feet }] },
        ]}
      >
        <Layer w={w} h={h}>
          {sleep ? <Rect x={6} y={20} width={108} height={74} rx={26} fill="#F3EEFF" stroke={INK} strokeWidth={2.2} /> : null}
          {def.back ? <Path d={def.back} fill={def.hair} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" /> : null}
        </Layer>
        {!sleep ? (
          <>
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: a.stepL }] }]}>
              <Layer w={w} h={h}>
                <Rect x={P.legL.x} y={P.legL.y} width={P.legL.w} height={P.legL.h} rx={5} fill={def.legs} stroke={INK} strokeWidth={2.2} />
                <Path d={P.shoeL} fill={def.shoes} stroke={INK} strokeWidth={2.2} />
              </Layer>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: a.stepR }] }]}>
              <Layer w={w} h={h}>
                <Rect x={P.legR.x} y={P.legR.y} width={P.legR.w} height={P.legR.h} rx={5} fill={def.legs} stroke={INK} strokeWidth={2.2} />
                <Path d={P.shoeR} fill={def.shoes} stroke={INK} strokeWidth={2.2} />
              </Layer>
            </Animated.View>
          </>
        ) : null}
        <Layer w={w} h={h}>
          <Path d={def.body} fill={def.top} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
          {def.hoodie ? (
            <G>
              <Path d={P.pocket} fill={pocket} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
              <Path d={P.strings} fill="none" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" opacity={0.9} />
            </G>
          ) : null}
          {def.dress ? (
            <G>
              <Path d={P.hem} fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" opacity={0.85} />
              <Path d={P.collar} fill="#FFFFFF" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
            </G>
          ) : null}
        </Layer>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateX: dxL }, { translateY: dy }, { rotate: a.swingL }, { translateX: -dxL }, { translateY: -dy }] },
          ]}
        >
          <Layer w={w} h={h}>
            <G transform="rotate(16 39 103)">
              <Rect x={33.5} y={100} width={11} height={24} rx={5.5} fill={def.top} stroke={INK} strokeWidth={2.2} />
              <Circle cx={39} cy={126} r={5.2} fill={def.skin} stroke={INK} strokeWidth={2} />
            </G>
          </Layer>
        </Animated.View>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                { translateX: dxR },
                { translateY: dy },
                { rotate: pose === 'wave' ? a.waveRot : a.swingR },
                { translateX: -dxR },
                { translateY: -dy },
              ],
            },
          ]}
        >
          <Layer w={w} h={h}>
            <G transform="rotate(-16 81 103)">
              <Rect x={75.5} y={100} width={11} height={24} rx={5.5} fill={def.top} stroke={INK} strokeWidth={2.2} />
              <Circle cx={81} cy={126} r={5.2} fill={def.skin} stroke={INK} strokeWidth={2} />
            </G>
          </Layer>
        </Animated.View>
        <Layer w={w} h={h}>
          <Circle cx={18} cy={70} r={6.5} fill={def.skin} stroke={INK} strokeWidth={2.2} />
          <Circle cx={102} cy={70} r={6.5} fill={def.skin} stroke={INK} strokeWidth={2.2} />
          <Ellipse cx={60} cy={64} rx={43} ry={40} fill={def.skin} stroke={INK} strokeWidth={2.2} />
        </Layer>
        <View style={{ position: 'absolute', left: 12.5 * k, top: 24.5 * k }}>
          <Face
            emotion={sleep ? 'sleep' : emotion}
            value={sleep ? 100 : value}
            size={95 * k}
            bare
            eyes={1.3}
            look={look ?? (pose === 'walk' ? 2.5 : 0)}
            blink={!sleep}
          />
        </View>
        <Layer w={w} h={h}>
          {sleep ? (
            <G>
              <Path d={P.blanket} fill="#8C7BF5" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
              <Path d={P.blanketFold} fill="#C3B9FF" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
              <Path d={P.blanketMarks} fill="none" stroke="#E6E0FF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </G>
          ) : null}
          <Path d={def.front} fill={def.hair} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
          {def.extra ? <Path d={def.extra} fill={def.hair} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" /> : null}
          {def.sideL ? <Path d={def.sideL} fill={def.hair} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" /> : null}
          {def.sideR ? <Path d={def.sideR} fill={def.hair} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" /> : null}
          <Path d={def.shine} fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" opacity={0.3} />
          {def.bow ? (
            <G transform="translate(87 23) rotate(18) scale(1.15)">
              <Path d={P.bowLoops} fill="#FF6B8A" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
              <Circle cx={0} cy={-0.5} r={3} fill="#FF8FA8" stroke={INK} strokeWidth={1.6} />
            </G>
          ) : null}
        </Layer>
      </Animated.View>
    </View>
  );
}

export const Chibi = memo(ChibiView);
