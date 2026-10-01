// Локация пары: луг (Meadow) или одна из нарисованных в src/lib/locations.ts.
// Статичный рисунок разбирается один раз на время суток; поверх — лёгкие живые детали на двух-трёх циклах:
// сияние переливается и падает снег, мерцает гирлянда, летают голуби и чайки, крутится луч маяка.
import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { saw, tri } from '../../lib/anim';
import { artNodes, renderArt } from '../../lib/art';
import { GARLAND, locationSvg, type LocationId } from '../../lib/locations';
import { nativeDriver, useReducedMotion } from '../../lib/motion';
import { sceneTransform, type DayTime } from '../../lib/scene';
import { Meadow } from './Meadow';

type Props = { id: LocationId; width: number; height: number; time: DayTime; active: boolean };

const PAINT = { c: '#888888', skin: '#FFDCC4', ids: 'loc' };
const BIRD = 'M0 0 q6 -6 12 0 q6 -6 12 0';

function DrawnLocation({ id, width, height, time, active }: Props & { id: Exclude<LocationId, 'meadow'> }) {
  const reduce = useReducedMotion();
  const tf = useMemo(() => sceneTransform(width, height), [width, height]);
  const s = tf.s;
  const art = useMemo(() => renderArt(artNodes(locationSvg(id, time)), PAINT, `${id}${time}`), [id, time]);

  const slow = useRef(new Animated.Value(0)).current; // 30 с: птицы, снег, сияние
  const blink = useRef(new Animated.Value(0)).current; // 2,4 с: мерцание
  const spin = useRef(new Animated.Value(0)).current; // 8 с: луч маяка

  const live = active && !reduce;
  useEffect(() => {
    if (!live) return;
    const loops = [
      Animated.loop(Animated.timing(slow, { toValue: 1, duration: 30000, easing: Easing.linear, useNativeDriver: nativeDriver })),
      Animated.loop(Animated.timing(blink, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: nativeDriver })),
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: nativeDriver })),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [live, slow, blink, spin]);

  const abs = (x: number, y: number) => ({ position: 'absolute' as const, left: tf.x(x), top: tf.y(y) });

  // Сияние: две полосы переливаются и чуть плывут
  const auroraBands =
    id === 'aurora' && time === 'night'
      ? [
          { d: 'M-40 250 C40 170 120 260 200 190 C270 130 330 210 430 150 L430 230 C330 290 270 210 200 270 C120 340 40 250 -40 330 Z', op: [0.3, 0.6], off: 0 },
          { d: 'M-40 170 C60 120 140 190 220 130 C290 80 350 140 430 100 L430 140 C350 180 290 130 220 180 C140 240 60 170 -40 220 Z', op: [0.15, 0.42], off: 0.5 },
        ]
      : [];

  // Снег: днём и вечером реже, ночью гуще
  const flakes = id === 'aurora' ? Array.from({ length: time === 'night' ? 14 : 9 }, (_, i) => ({ x: 14 + ((i * 83) % 362), off: (i * 0.137) % 1, r: i % 3 === 0 ? 2.6 : 1.8 })) : [];

  // Птицы: голуби на крыше днём, чайки на пляже днём
  const birds =
    time === 'day' && (id === 'roof' || id === 'beach')
      ? [
          { y: id === 'roof' ? 300 : 230, off: 0, k: 1 },
          { y: id === 'roof' ? 330 : 260, off: 0.12, k: 0.8 },
          { y: id === 'roof' ? 210 : 190, off: 0.55, k: 0.9 },
        ]
      : [];

  const garland = id === 'roof' && time !== 'day';
  const beam = id === 'beach' && time !== 'day';
  const moonPath = id === 'beach' && time === 'night';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height} viewBox="0 0 390 844" preserveAspectRatio="xMidYMax slice" style={StyleSheet.absoluteFill}>
        {art}
      </Svg>

      {auroraBands.map((b, i) => (
        <Animated.View
          key={`a${i}`}
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: live ? tri(slow, b.off, b.op[0], b.op[1]) : b.op[1],
              transform: [{ translateX: live ? tri(slow, b.off + 0.25, -14 * s, 14 * s) : 0 }],
            },
          ]}
        >
          <Svg width={width} height={height} viewBox="0 0 390 844" preserveAspectRatio="xMidYMax slice">
            <Defs>
              <LinearGradient id={`aur${i}`} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#5EF2C0" />
                <Stop offset="0.5" stopColor="#7FD8FF" />
                <Stop offset="1" stopColor="#C59BFF" />
              </LinearGradient>
            </Defs>
            <Path d={b.d} fill={`url(#aur${i})`} />
            <Path d={b.d} fill="none" stroke="#C8FFF0" strokeWidth={1.4} opacity={0.35} />
          </Svg>
        </Animated.View>
      ))}

      {flakes.map((f, i) => (
        <Animated.View
          key={`s${i}`}
          style={{
            ...abs(f.x, 0),
            top: 0,
            opacity: time === 'day' ? 0.95 : 0.8,
            transform: [
              { translateY: live ? saw(slow, f.off, tf.y(-20), tf.y(860)) : tf.y(120 + ((i * 131) % 600)) },
              { translateX: live ? tri(slow, f.off * 3, -8 * s, 8 * s) : 0 },
            ],
          }}
        >
          <Svg width={f.r * 2 * s + 2} height={f.r * 2 * s + 2}>
            <Circle cx={f.r * s + 1} cy={f.r * s + 1} r={f.r * s} fill="#FFFFFF" />
          </Svg>
        </Animated.View>
      ))}

      {birds.map((b, i) => (
        <Animated.View
          key={`b${i}`}
          style={{
            position: 'absolute',
            left: 0,
            top: tf.y(b.y),
            transform: [
              { translateX: live ? saw(slow, b.off, -40 * s, width + 20 * s) : tf.x(60 + i * 110) },
              { translateY: live ? tri(blink, b.off, -3 * s, 3 * s) : 0 },
              { scaleY: live ? tri(blink, b.off * 2, 0.7, 1.15) : 1 },
            ],
          }}
        >
          <Svg width={26 * s * b.k} height={10 * s * b.k} viewBox="-1 -7 26 10">
            <Path d={BIRD} fill="none" stroke="#2B2035" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      ))}

      {garland
        ? GARLAND.map((bulb, i) => (
            <Animated.View
              key={`g${i}`}
              style={{
                ...abs(bulb.x - 11, bulb.y - 11),
                width: 22 * s,
                height: 22 * s,
                opacity: live ? tri(blink, (i * 0.29) % 1, 0.25, 0.9) : 0.6,
              }}
            >
              <Svg width={22 * s} height={22 * s} viewBox="0 0 22 22">
                <Circle cx={11} cy={11} r={11} fill={bulb.color} opacity={0.45} />
                <Circle cx={11} cy={11} r={6} fill={bulb.color} opacity={0.6} />
              </Svg>
            </Animated.View>
          ))
        : null}

      {beam ? (
        <Animated.View
          style={{
            ...abs(350 - 150, 322 - 150),
            width: 300 * s,
            height: 300 * s,
            opacity: time === 'night' ? 0.55 : 0.32,
            transform: [{ rotate: live ? spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) : '200deg' }],
          }}
        >
          <Svg width={300 * s} height={300 * s} viewBox="0 0 300 300">
            <Defs>
              <LinearGradient id="beam" x1="0.5" y1="0.5" x2="0" y2="0.5">
                <Stop offset="0" stopColor="#FFF4C2" stopOpacity={0.9} />
                <Stop offset="1" stopColor="#FFF4C2" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d="M150 150 L0 128 L0 172 Z" fill="url(#beam)" />
          </Svg>
        </Animated.View>
      ) : null}

      {moonPath
        ? [0, 1, 2, 3, 4].map((i) => (
            <Animated.View
              key={`m${i}`}
              style={{ ...abs(70 - i * 3, 446 + i * 18), opacity: live ? tri(blink, i * 0.2, 0.25, 0.85) : 0.6 }}
            >
              <Svg width={(44 + i * 6) * s} height={4 * s} viewBox={`0 0 ${44 + i * 6} 4`}>
                <Path d={`M2 2 H${42 + i * 6}`} stroke="#F6F1D8" strokeWidth={2.4} strokeLinecap="round" />
              </Svg>
            </Animated.View>
          ))
        : null}
    </View>
  );
}

function LocationView(props: Props) {
  if (props.id === 'meadow') return <Meadow width={props.width} height={props.height} time={props.time} active={props.active} />;
  return <DrawnLocation {...props} id={props.id} />;
}

export const Location = memo(LocationView);
