// Локация пары: луг (Meadow) или одна из нарисованных в src/lib/locations.ts.
// Статичный рисунок разбирается один раз на время суток; поверх — лёгкие живые детали на двух-трёх циклах:
// сияние переливается и падает снег, мерцает гирлянда, летают голуби и чайки, крутится луч маяка.
// 0.2.1: искры костра и светлячки, снегопад, пар от чашек, звёзды и падающая звезда, лепестки сакуры,
// дождь и круги на лужах, облака над горами, свечение кристаллов и капли в пещере.
import { memo, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { saw, tri } from '../../lib/anim';
import { artNodes, renderArt } from '../../lib/art';
import { CAFE_CUPS, CAMPFIRE, CRYSTALS, GARLAND, locationSvg, RAIN_PUDDLES, type LocationId } from '../../lib/locations';
import { nativeDriver, useReducedMotion } from '../../lib/motion';
import { sceneTransform, type DayTime } from '../../lib/scene';
import { Meadow } from './Meadow';

type Props = { id: LocationId; width: number; height: number; time: DayTime; active: boolean };

const PAINT = { c: '#888888', skin: '#FFDCC4', ids: 'loc' };
const BIRD = 'M0 0 q6 -6 12 0 q6 -6 12 0';
const CLOUD = 'M14 42 C3 42 1 29 12 27 C12 14 29 10 37 19 C41 6 64 4 70 17 C78 8 95 12 95 25 C108 23 116 34 107 42 Z';
// Детерминированная «случайность» для раскладки частиц
const rnd = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

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
  const flakes = id === 'aurora' || id === 'snow' ? Array.from({ length: id === 'snow' ? 18 : time === 'night' ? 14 : 9 }, (_, i) => ({ x: 14 + ((i * 83) % 362), off: (i * 0.137) % 1, r: i % 3 === 0 ? 2.6 : 1.8 })) : [];

  // Птицы: голуби на крыше днём, чайки на пляже днём
  const birds =
    time === 'day' && (id === 'roof' || id === 'beach' || id === 'mountains')
      ? [
          { y: id === 'roof' ? 300 : 230, off: 0, k: 1 },
          { y: id === 'roof' ? 330 : 260, off: 0.12, k: 0.8 },
          { y: id === 'roof' ? 210 : 190, off: 0.55, k: 0.9 },
        ]
      : [];

  const garland = id === 'roof' && time !== 'day';

  // Маленький живой элемент: рисунок w×h в точке сцены (x, y)
  const bit = (key: string, x: number, y: number, w: number, h: number, style: object, children: ReactNode) => (
    <Animated.View key={key} style={[{ position: 'absolute', left: tf.x(x), top: tf.y(y), width: w * s, height: h * s }, style]}>
      <Svg width={w * s} height={h * s} viewBox={`0 0 ${w} ${h}`}>
        {children}
      </Svg>
    </Animated.View>
  );
  const extra: ReactNode[] = [];
  if (id === 'forest') {
    const { x, y } = CAMPFIRE;
    extra.push(
      bit('flame', x - 14, y - 34, 28, 34, { opacity: live ? tri(blink, 0, 0.55, 0.95) : 0.8, transform: [{ scaleY: live ? tri(blink, 0.3, 0.85, 1.12) : 1 }] },
        <Path d="M6 34 C2 22 10 16 12 4 C18 14 24 20 22 34 Z" fill="#FFE38A" opacity={0.85} />),
    );
    for (let i = 0; i < 8; i++) {
      const off = rnd(i, 1);
      extra.push(
        bit(`sp${i}`, x - 3 + (rnd(i, 2) - 0.5) * 20, y - 40, 6, 6, {
          opacity: live ? saw(blink, off, 1, 0) : 0,
          transform: [{ translateY: live ? saw(blink, off, 0, -150 * s) : 0 }, { translateX: live ? tri(blink, off * 2, -10 * s, 10 * s) : 0 }],
        }, <Circle cx={3} cy={3} r={2} fill={i % 2 ? '#FFE38A' : '#FFB347'} />),
      );
    }
    if (time !== 'day')
      for (let i = 0; i < 9; i++)
        extra.push(
          bit(`ff${i}`, 20 + rnd(i, 3) * 350, 430 + rnd(i, 4) * 300, 10, 10, {
            opacity: live ? tri(blink, rnd(i, 5), 0.1, 1) : 0.6,
            transform: [{ translateX: live ? tri(slow, rnd(i, 6), -20 * s, 20 * s) : 0 }, { translateY: live ? tri(slow, rnd(i, 7) + 0.3, -14 * s, 14 * s) : 0 }],
          }, <><Circle cx={5} cy={5} r={5} fill="#E8FF8A" opacity={0.35} /><Circle cx={5} cy={5} r={2} fill="#F4FFB8" /></>),
        );
  }
  if (id === 'cafe')
    CAFE_CUPS.forEach((c, ci) =>
      [0, 0.5].forEach((o, j) =>
        extra.push(
          bit(`st${ci}${j}`, c.x - 6 + j * 4, c.y - 34, 12, 22, {
            opacity: live ? tri(blink, (o + ci * 0.25) % 1, 0, 0.75) : 0.5,
            transform: [{ translateY: live ? saw(blink, (o + ci * 0.25) % 1, 6 * s, -18 * s) : 0 }],
          }, <Path d="M6 21 C1 16 11 12 6 7 C3 4 7 2 6 0" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" />),
        ),
      ),
    );
  if (id === 'moon') {
    for (let i = 0; i < 10; i++)
      extra.push(
        bit(`tw${i}`, 10 + rnd(i, 8) * 370, 20 + rnd(i, 9) * 420, 10, 10, { opacity: live ? tri(blink, rnd(i, 10), 0.1, 1) : 0.7 },
          <Path d="M5 0 C5.5 3.5 6.5 4.5 10 5 C6.5 5.5 5.5 6.5 5 10 C4.5 6.5 3.5 5.5 0 5 C3.5 4.5 4.5 3.5 5 0 Z" fill="#FFFFFF" />),
      );
    extra.push(
      bit('shoot', 330, 40, 60, 20, {
        opacity: live ? spin.interpolate({ inputRange: [0, 0.03, 0.14, 0.18, 1], outputRange: [0, 1, 1, 0, 0] }) : 0,
        transform: [
          { translateX: live ? spin.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, -260 * s, -260 * s] }) : 0 },
          { translateY: live ? spin.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 130 * s, 130 * s] }) : 0 },
          { rotate: '-27deg' },
        ],
      }, <><Path d="M8 10 H58" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.5} /><Circle cx={8} cy={10} r={3} fill="#FFFFFF" /></>),
    );
  }
  if (id === 'sakura')
    for (let i = 0; i < 14; i++) {
      const off = rnd(i, 11);
      extra.push(
        bit(`pt${i}`, rnd(i, 12) * 390, 0, 10, 8, {
          top: 0,
          opacity: time === 'night' ? 0.7 : 0.95,
          transform: [
            { translateY: live ? saw(slow, off, tf.y(180), tf.y(860)) : tf.y(260 + rnd(i, 13) * 500) },
            { translateX: live ? tri(slow, off * 4, -26 * s, 26 * s) : 0 },
            { rotate: live ? tri(blink, off, -40, 40).interpolate({ inputRange: [-40, 40], outputRange: ['-40deg', '40deg'] }) : '20deg' },
          ],
        }, <Ellipse cx={5} cy={4} rx={4.6} ry={3} fill="#FFB8D2" stroke="#E07A9E" strokeWidth={0.8} />),
      );
    }
  if (id === 'rain') {
    for (let i = 0; i < 26; i++) {
      const off = rnd(i, 14);
      extra.push(
        bit(`rd${i}`, rnd(i, 15) * 400, 0, 6, 16, {
          top: 0,
          opacity: 0.55,
          transform: [{ translateY: live ? saw(blink, off, tf.y(-30), tf.y(860)) : tf.y(rnd(i, 16) * 800) }],
        }, <Path d="M5 1 L1 15" stroke="#DDE6F6" strokeWidth={1.6} strokeLinecap="round" />),
      );
    }
    RAIN_PUDDLES.forEach((q, i) =>
      extra.push(
        bit(`rp${i}`, q.x - q.rx * 0.6, q.y - q.rx * 0.15, q.rx * 1.2, q.rx * 0.3, {
          opacity: live ? saw(blink, i * 0.37, 0.9, 0) : 0,
          transform: [{ scale: live ? saw(blink, i * 0.37, 0.2, 1) : 1 }],
        }, <Ellipse cx={q.rx * 0.6} cy={q.rx * 0.15} rx={q.rx * 0.55} ry={q.rx * 0.12} fill="none" stroke="#FFFFFF" strokeWidth={1.4} />),
      ),
    );
  }
  if (id === 'mountains')
    [{ y: 230, w: 120, off: 0 }, { y: 300, w: 90, off: 0.45 }, { y: 180, w: 70, off: 0.75 }].forEach((c, i) =>
      extra.push(
        <Animated.View
          key={`cl${i}`}
          style={{
            position: 'absolute',
            left: 0,
            top: tf.y(c.y),
            opacity: time === 'day' ? 0.9 : time === 'evening' ? 0.6 : 0.3,
            transform: [{ translateX: live ? saw(slow, c.off, -c.w * s, width) : tf.x(40 + i * 120) }],
          }}
        >
          <Svg width={c.w * s} height={c.w * 0.4 * s} viewBox="0 0 110 44">
            <Path d={CLOUD} fill={time === 'evening' ? '#FFD3E2' : time === 'night' ? '#56608F' : '#FFFFFF'} />
          </Svg>
        </Animated.View>,
      ),
    );
  if (id === 'cave') {
    CRYSTALS.forEach((c, i) =>
      extra.push(
        bit(`cg${i}`, c.x - 40 * c.s, c.y - 70 * c.s, 80 * c.s, 80 * c.s, { opacity: live ? tri(blink, rnd(i, 17), 0.15, 0.7) : 0.4 },
          <>
            <Defs>
              <RadialGradient id={`cgl${i}`}>
                <Stop offset="0" stopColor={c.c} stopOpacity={0.6} />
                <Stop offset="1" stopColor={c.c} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={40 * c.s} cy={40 * c.s} r={40 * c.s} fill={`url(#cgl${i})`} />
          </>),
      ),
    );
    [[100, 230], [380, 276], [170, 168]].forEach(([x, y], i) =>
      extra.push(
        bit(`dr${i}`, x - 3, y, 6, 8, {
          opacity: live ? saw(spin, i * 0.33, 0.95, 0.2) : 0.9,
          transform: [{ translateY: live ? saw(spin, i * 0.33, 0, 260 * s) : 0 }],
        }, <Path d="M3 0 C4.6 3 6 4.4 6 5.6 C6 7 4.6 8 3 8 C1.4 8 0 7 0 5.6 C0 4.4 1.4 3 3 0 Z" fill="#9FE6FF" />),
      ),
    );
  }
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

      {extra}

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
