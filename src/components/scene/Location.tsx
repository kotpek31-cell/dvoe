// Локация пары: одно из мест, нарисованных в src/lib/locations.ts (луг — тоже там).
// Статичный рисунок разбирается один раз на время суток; поверх — лёгкие живые детали на двух-трёх циклах:
// сияние переливается и падает снег, мерцает гирлянда, летают голуби и чайки, крутится луч маяка.
// 0.2.1: искры костра и светлячки, снегопад, пар от чашек, звёзды и падающая звезда, лепестки сакуры,
// дождь и круги на лужах, облака над горами, свечение кристаллов и капли в пещере.
// 0.2.2: ночью в пещере кристаллы по очереди вспыхивают цветами грибов — подсказка к порядку (приходит с сервера).
// 3.0: рисунок — в мягком стиле с объёмом (artStyle.ts); небо живое везде: ночью мерцают звёзды и изредка падает
// звезда, над лугом плывут облака; на лугу — бабочки, светлячки, пыльца в солнечном свете.
import { memo, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { saw, tri } from '../../lib/anim';
import { renderArt } from '../../lib/art';
import { styledNodes } from '../../lib/artStyle';
import { cafeCups, CAMPFIRE, crystalsOf, GARLAND, locationParts, locationSvg, rainPuddles, type LocationId, type Variant } from '../../lib/locations';
import { nativeDriver, useReducedMotion } from '../../lib/motion';
import { MUSH_HEX, useMushroomHint } from '../../lib/mushrooms';
import { sceneTransform, type DayTime } from '../../lib/scene';

// part: в комнате небо рисуется одно на экран ('sky'), а земля с живыми деталями — плитками по всей площадке ('land')
export type LocationPart = 'all' | 'sky' | 'land';
// variant — плитка комнаты (0 — главная; 1 — середина комнаты; 2, 3 — боковые плитки со своими вещами)
type Props = { id: LocationId; width: number; height: number; time: DayTime; active: boolean; part?: LocationPart; variant?: Variant };

const PAINT = { c: '#888888', skin: '#FFDCC4' };
const BIRD = 'M0 0 q6 -6 12 0 q6 -6 12 0';
const CLOUD = 'M14 42 C3 42 1 29 12 27 C12 14 29 10 37 19 C41 6 64 4 70 17 C78 8 95 12 95 25 C108 23 116 34 107 42 Z';
// Кристалл пещеры (как в locations.ts) — для подсказки грибов он вспыхивает цветом
const CRYSTAL_PATHS = ['M-14 0 L-18 -26 L-10 -40 L-4 -22 L-2 0 Z', 'M-4 0 L-6 -40 L2 -60 L10 -40 L8 0 Z', 'M8 0 L12 -22 L20 -30 L22 -14 L18 0 Z'];
const INK = '#2B2035';
// Детерминированная «случайность» для раскладки частиц
const rnd = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

// Огонёк (светлячок, пыльца, искра): мягкое свечение и яркая середина, в квадрате 16×16
function spot(color: string, core = 2.6, halo = 0.7) {
  const id = `sp${color.slice(1)}`;
  return (
    <>
      <Defs>
        <RadialGradient id={id}>
          <Stop offset="0" stopColor={color} stopOpacity={halo} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={8} cy={8} r={8} fill={`url(#${id})`} />
      <Circle cx={8} cy={8} r={core} fill={color} />
    </>
  );
}

// Яркие звёзды рисунка (locations.ts, BRIGHT) — над ними мерцает свечение
const TWINKLE = [[58, 96, 1], [334, 214, 0.8], [212, 58, 0.7], [118, 300, 0.6], [270, 330, 0.5], [30, 220, 0.5], [366, 60, 0.6]];
// Под открытым небом (в кафе и пещере неба нет, над городом под дождём — тучи, у Луны свои звёзды)
const OPEN_SKY = new Set<LocationId>(['meadow', 'aurora', 'roof', 'beach', 'forest', 'snow', 'sakura', 'mountains']);

// Живое небо: мерцание звёзд и падающая звезда ночью, облака над лугом
function SkyLife({ id, width, height, time, active, side }: { id: LocationId; width: number; height: number; time: DayTime; active: boolean; side: boolean }) {
  const reduce = useReducedMotion();
  const tf = useMemo(() => sceneTransform(width, height), [width, height]);
  const s = tf.s;
  const blink = useRef(new Animated.Value(0)).current; // 3,2 с: мерцание
  const shoot = useRef(new Animated.Value(0)).current; // 11 с: падающая звезда
  const clock = useRef(new Animated.Value(0)).current; // 100 с: облака
  const night = time === 'night' && OPEN_SKY.has(id);
  const clouds = id === 'meadow';
  const live = active && !reduce;

  useEffect(() => {
    if (!live || (!night && !clouds)) return;
    const loop = (v: Animated.Value, duration: number) => Animated.loop(Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: nativeDriver }));
    const loops = [...(night ? [loop(blink, 3200), loop(shoot, 11000)] : []), ...(clouds ? [loop(clock, 100000)] : [])];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [live, night, clouds, blink, shoot, clock]);

  const cloudFill = time === 'day' ? '#FFFFFF' : time === 'evening' ? '#FFC7D6' : '#56608F';
  const cloudOp = time === 'day' ? 0.95 : time === 'evening' ? 0.6 : 0.35;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {night
        ? TWINKLE.map(([x, y, k], i) => (
            <Animated.View
              key={`tw${i}`}
              style={{
                position: 'absolute',
                left: tf.x(x - 14 * k),
                top: tf.y(y - 14 * k),
                opacity: live ? tri(blink, (i * 0.31) % 1, 0.05, 0.95) : 0.5,
                transform: [{ scale: live ? tri(blink, (i * 0.31) % 1, 0.6, 1.15) : 1 }],
              }}
            >
              <Svg width={28 * k * s} height={28 * k * s} viewBox="-14 -14 28 28">
                <Defs>
                  <RadialGradient id={`twg${i}`}>
                    <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
                    <Stop offset="1" stopColor="#BFD0FF" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={0} cy={0} r={14} fill={`url(#twg${i})`} />
                <Path d="M0 -9 C0.6 -2 2 -0.6 9 0 C2 0.6 0.6 2 0 9 C-0.6 2 -2 0.6 -9 0 C-2 -0.6 -0.6 -2 0 -9 Z" fill="#FFFFFF" />
              </Svg>
            </Animated.View>
          ))
        : null}
      {night && live && !side ? (
        <Animated.View
          style={{
            position: 'absolute',
            left: tf.x(300),
            top: tf.y(70),
            opacity: shoot.interpolate({ inputRange: [0, 0.02, 0.09, 0.12, 1], outputRange: [0, 1, 1, 0, 0] }),
            transform: [
              { translateX: shoot.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, -230 * s, -230 * s] }) },
              { translateY: shoot.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 120 * s, 120 * s] }) },
              { rotate: '-27deg' },
            ],
          }}
        >
          <Svg width={64 * s} height={20 * s} viewBox="0 0 64 20">
            <Defs>
              <LinearGradient id="shootTail" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d="M8 8.6 L62 9.6 L62 10.4 L8 11.4 Z" fill="url(#shootTail)" />
            <Circle cx={8} cy={10} r={3} fill="#FFFFFF" />
          </Svg>
        </Animated.View>
      ) : null}
      {clouds
        ? [
            { y: 92, w: 124, offset: 0.1 },
            { y: 186, w: 88, offset: 0.55 },
            { y: 262, w: 150, offset: 0.8 },
          ].map((c, i) => (
            <Animated.View
              key={`mc${i}`}
              style={{ position: 'absolute', left: 0, top: tf.y(c.y), opacity: cloudOp, transform: [{ translateX: live ? saw(clock, c.offset, -170 * s, width + 40 * s) : tf.x(30 + i * 120) }] }}
            >
              <Svg width={c.w * s} height={(c.w * s * 50) / 124} viewBox="0 0 124 50">
                <Defs>
                  <LinearGradient id={`mcg${i}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={cloudFill} />
                    <Stop offset="1" stopColor={time === 'day' ? '#DCE9FA' : cloudFill} />
                  </LinearGradient>
                </Defs>
                <Path d={CLOUD} fill={cloudFill} opacity={0.5} transform="translate(34 -6) scale(0.62)" />
                <Path d={CLOUD} fill={`url(#mcg${i})`} />
              </Svg>
            </Animated.View>
          ))
        : null}
    </View>
  );
}

function DrawnLocation({ id, width, height, time, active, part = 'all', variant = 0 }: Props) {
  const art = useMemo(() => {
    const svg = part === 'all' ? locationSvg(id, time) : locationParts(id, time, variant)[part];
    // 3.0: мягкий контур и объём (artStyle.ts). id градиентов — свои у каждой локации, времени и плитки
    const key = `${id}${time}${part}${variant}`;
    return renderArt(styledNodes(svg, 'scene'), { ...PAINT, ids: key }, key);
  }, [id, time, part, variant]);
  if (part === 'sky') {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={width} height={height} viewBox="0 0 390 844" preserveAspectRatio="xMidYMax slice" style={StyleSheet.absoluteFill} pointerEvents="none">
          {art}
        </Svg>
        <SkyLife id={id} width={width} height={height} time={time} active={active} side={false} />
      </View>
    );
  }
  return <LiveLocation id={id} width={width} height={height} time={time} active={active} art={art} variant={variant} part={part} />;
}

function LiveLocation({ id, width, height, time, active, art, variant = 0, part = 'all' }: Props & { art: ReactNode }) {
  const v = variant;
  const side = v >= 2; // боковая плитка комнаты: своих костра, маяка, чашек нет; птицы и облака — только в середине
  const seed = side ? v * 17 : 0; // частицы на боковых плитках — по другой раскладке
  const reduce = useReducedMotion();
  const tf = useMemo(() => sceneTransform(width, height), [width, height]);
  const s = tf.s;

  const slow = useRef(new Animated.Value(0)).current; // 30 с: птицы, снег, сияние
  const blink = useRef(new Animated.Value(0)).current; // 2,4 с: мерцание
  const spin = useRef(new Animated.Value(0)).current; // 8 с: луч маяка
  const flap = useRef(new Animated.Value(0)).current; // 0,22 с: крылья бабочек (луг днём)

  const live = active && !reduce;

  // Подсказка в пещере: 5 вспышек за 4,4 с, пауза, снова (вспышки — не движение, идут и при «Уменьшить движение»)
  const hint = useMushroomHint(id === 'cave' && time === 'night' && active && !side);
  const showHint = Boolean(hint && id === 'cave' && time === 'night' && !side);
  const hintV = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!showHint || !active) return;
    hintV.setValue(0);
    const loop = Animated.loop(Animated.timing(hintV, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: nativeDriver }));
    loop.start();
    return () => loop.stop();
  }, [showHint, active, hintV]);

  useEffect(() => {
    if (!live) return;
    const loops = [
      Animated.loop(Animated.timing(slow, { toValue: 1, duration: 30000, easing: Easing.linear, useNativeDriver: nativeDriver })),
      Animated.loop(Animated.timing(blink, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: nativeDriver })),
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: nativeDriver })),
    ];
    if (id === 'meadow' && time === 'day')
      loops.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(flap, { toValue: 1, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
            Animated.timing(flap, { toValue: 0, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
          ]),
        ),
      );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [live, slow, blink, spin, flap, id, time]);

  const abs = (x: number, y: number) => ({ position: 'absolute' as const, left: tf.x(x), top: tf.y(y) });

  // Сияние: две полосы переливаются и чуть плывут
  const auroraBands =
    id === 'aurora' && time === 'night'
      ? side
        ? [
            { d: 'M-40 230 C60 200 110 150 190 210 C260 260 320 160 430 200 L430 270 C320 230 260 330 190 280 C110 220 60 270 -40 300 Z', op: [0.28, 0.56], off: 0.2 },
            { d: 'M-40 150 C40 110 130 160 200 120 C280 70 340 150 430 120 L430 160 C340 190 280 110 200 160 C130 200 40 150 -40 190 Z', op: [0.15, 0.4], off: 0.7 },
          ]
        : [
            { d: 'M-40 250 C40 170 120 260 200 190 C270 130 330 210 430 150 L430 230 C330 290 270 210 200 270 C120 340 40 250 -40 330 Z', op: [0.3, 0.6], off: 0 },
            { d: 'M-40 170 C60 120 140 190 220 130 C290 80 350 140 430 100 L430 140 C350 180 290 130 220 180 C140 240 60 170 -40 220 Z', op: [0.15, 0.42], off: 0.5 },
          ]
      : [];

  // Снег: днём и вечером реже, ночью гуще
  const flakes = id === 'aurora' || id === 'snow' ? Array.from({ length: id === 'snow' ? 18 : time === 'night' ? 14 : 9 }, (_, i) => ({ x: 14 + ((i * 83 + seed * 7) % 362), off: (i * 0.137 + seed * 0.019) % 1, r: i % 3 === 0 ? 2.6 : 1.8 })) : [];

  // Птицы: голуби на крыше днём, чайки на пляже днём
  const birds =
    time === 'day' && !side && (id === 'roof' || id === 'beach' || id === 'mountains')
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
  if (id === 'meadow') {
    // фонарик у пледа дышит светом
    if (time !== 'day' && !side)
      extra.push(
        bit('lamp', 166, 580, 82, 82, { opacity: live ? tri(blink, 0, 0.35, 0.9) : 0.7 },
          <>
            <Defs>
              <RadialGradient id="mlamp">
                <Stop offset="0" stopColor="#FFE7A3" stopOpacity={0.55} />
                <Stop offset="1" stopColor="#FFD680" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={41} cy={41} r={41} fill="url(#mlamp)" />
          </>),
      );
    // бабочки днём
    if (time === 'day' && !side)
      [
        { xs: [30, 150, 250, 120, 30], ys: [430, 380, 450, 500, 430], c1: '#FFD166', c2: '#FFB347', off: 0 },
        { xs: [330, 220, 300, 330, 330], ys: [560, 600, 520, 560, 560], c1: '#FF9EBB', c2: '#FF7FA6', off: 0.4 },
      ].forEach((b, i) => {
        const t = saw(slow, b.off, 0, 1);
        extra.push(
          <Animated.View
            key={`bf${i}`}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: live
                ? [
                    { translateX: t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: b.xs.map(tf.x) }) },
                    { translateY: t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: b.ys.map(tf.y) }) },
                  ]
                : [{ translateX: tf.x(b.xs[1]) }, { translateY: tf.y(b.ys[1]) }],
            }}
          >
            <Animated.View style={{ transform: [{ scaleX: live ? flap.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) : 1 }] }}>
              <Svg width={26 * s} height={22 * s} viewBox="0 0 26 22">
                <Path d="M13 11 C8 1 1 2 2 8 C3 13 8 13 13 11 Z M13 11 C9 16 4 20 4 16 C4 13 8 12 13 11 Z" fill={b.c1} stroke="#B56A3A" strokeWidth={0.9} />
                <Path d="M13 11 C18 1 25 2 24 8 C23 13 18 13 13 11 Z M13 11 C17 16 22 20 22 16 C22 13 18 12 13 11 Z" fill={b.c2} stroke="#B56A3A" strokeWidth={0.9} />
                <Path d="M13 6 V17" stroke="#473A5C" strokeWidth={1.6} strokeLinecap="round" />
              </Svg>
            </Animated.View>
          </Animated.View>,
        );
      });
    // пыльца в солнечном свете днём, светлячки вечером и ночью
    const n = time === 'night' ? 10 : 7;
    for (let i = 0; i < n; i++) {
      const fx = 20 + ((i * 97 + v * 53) % 350);
      const fy = time === 'night' ? 470 + ((i * 61 + v * 29) % 250) : 520 + ((i * 53 + v * 31) % 220);
      const off = i / n;
      const color = time === 'night' ? '#FFF2A6' : time === 'evening' ? '#FFE0EC' : '#FFFFFF';
      extra.push(
        bit(`mf${i}`, fx - 8, fy - 8, 16, 16, {
          opacity: live ? tri(blink, (i * 0.37) % 1, time === 'day' ? 0.05 : 0.15, time === 'day' ? 0.55 : 1) : 0.6,
          transform: [
            { translateX: live ? tri(slow, off, -12 * s, 16 * s) : 0 },
            { translateY: live ? (time === 'night' ? tri(slow, off + 0.3, 0, -24 * s) : saw(slow, off, 0, -170 * s)) : 0 },
          ],
        },
          spot(color, time === 'day' ? 1.3 : 2.6, time === 'day' ? 0.35 : 0.7)),
      );
    }
  }
  if (id === 'forest' && !side) {
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
  }
  if (id === 'forest' && time !== 'day')
    for (let i = 0; i < 9; i++)
      extra.push(
        bit(`ff${i}`, 20 + rnd(i + seed, 3) * 350, 430 + rnd(i + seed, 4) * 300, 16, 16, {
          opacity: live ? tri(blink, rnd(i + seed, 5), 0.1, 1) : 0.6,
          transform: [{ translateX: live ? tri(slow, rnd(i + seed, 6), -20 * s, 20 * s) : 0 }, { translateY: live ? tri(slow, rnd(i + seed, 7) + 0.3, -14 * s, 14 * s) : 0 }],
        }, spot('#E8FF8A', 2.4)),
      );
  if (id === 'cafe')
    cafeCups(v).forEach((c, ci) =>
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
        bit(`tw${i}`, 10 + rnd(i + seed, 8) * 370, 20 + rnd(i + seed, 9) * 420, 10, 10, { opacity: live ? tri(blink, rnd(i + seed, 10), 0.1, 1) : 0.7 },
          <Path d="M5 0 C5.5 3.5 6.5 4.5 10 5 C6.5 5.5 5.5 6.5 5 10 C4.5 6.5 3.5 5.5 0 5 C3.5 4.5 4.5 3.5 5 0 Z" fill="#FFFFFF" />),
      );
    if (!side) extra.push(
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
      const off = rnd(i + seed, 11);
      extra.push(
        bit(`pt${i}`, rnd(i + seed, 12) * 390, 0, 10, 8, {
          top: 0,
          opacity: time === 'night' ? 0.7 : 0.95,
          transform: [
            { translateY: live ? saw(slow, off, tf.y(180), tf.y(860)) : tf.y(260 + rnd(i + seed, 13) * 500) },
            { translateX: live ? tri(slow, off * 4, -26 * s, 26 * s) : 0 },
            { rotate: live ? tri(blink, off, -40, 40).interpolate({ inputRange: [-40, 40], outputRange: ['-40deg', '40deg'] }) : '20deg' },
          ],
        }, <Ellipse cx={5} cy={4} rx={4.6} ry={3} fill="#FFB8D2" stroke="#E07A9E" strokeWidth={0.8} />),
      );
    }
  if (id === 'rain') {
    for (let i = 0; i < 26; i++) {
      const off = rnd(i + seed, 14);
      extra.push(
        bit(`rd${i}`, rnd(i + seed, 15) * 400, 0, 6, 16, {
          top: 0,
          opacity: 0.55,
          transform: [{ translateY: live ? saw(blink, off, tf.y(-30), tf.y(860)) : tf.y(rnd(i + seed, 16) * 800) }],
        }, <Path d="M5 1 L1 15" stroke="#DDE6F6" strokeWidth={1.6} strokeLinecap="round" />),
      );
    }
    rainPuddles(v).forEach((q, i) =>
      extra.push(
        bit(`rp${i}`, q.x - q.rx * 0.6, q.y - q.rx * 0.15, q.rx * 1.2, q.rx * 0.3, {
          opacity: live ? saw(blink, i * 0.37, 0.9, 0) : 0,
          transform: [{ scale: live ? saw(blink, i * 0.37, 0.2, 1) : 1 }],
        }, <Ellipse cx={q.rx * 0.6} cy={q.rx * 0.15} rx={q.rx * 0.55} ry={q.rx * 0.12} fill="none" stroke="#FFFFFF" strokeWidth={1.4} />),
      ),
    );
  }
  if (id === 'mountains' && !side)
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
    const crystals = crystalsOf(v);
    crystals.forEach((c, i) =>
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
    if (showHint && hint)
      // слева направо — и по времени, и по месту порядок один
      [0, 1, 6, 2, 3].forEach((ci, i) => {
        const c = crystals[ci];
        const col = MUSH_HEX[hint[i]];
        const st = 0.04 + i * 0.11;
        const d = 170 * c.s;
        // свечение + сам кристалл перекрашивается в цвет гриба
        extra.push(
          bit(`hint${i}`, c.x - d / 2, c.y - 30 * c.s - d / 2, d, d, { opacity: hintV.interpolate({ inputRange: [0, st, st + 0.02, st + 0.07, st + 0.09, 1], outputRange: [0, 0, 1, 1, 0, 0] }) },
            <>
              <Defs>
                <RadialGradient id={`hg${i}`}>
                  <Stop offset="0" stopColor={col} stopOpacity={1} />
                  <Stop offset="0.3" stopColor={col} stopOpacity={0.75} />
                  <Stop offset="1" stopColor={col} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={d / 2} cy={d / 2} r={d / 2} fill={`url(#hg${i})`} />
              <G transform={`translate(${d / 2} ${d / 2 + 30 * c.s}) scale(${c.s})`}>
                {CRYSTAL_PATHS.map((cp, k) => (
                  <Path key={k} d={cp} fill={col} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
                ))}
                <Path d="M2 -60 L0 -10 L-6 -40 Z M-10 -40 L-12 -12 L-18 -26 Z" fill="#FFFFFF" opacity={0.55} />
              </G>
            </>),
        );
      });
    [[100, 230], [380, 276], [170, 168]].forEach(([x, y], i) =>
      extra.push(
        bit(`dr${i}`, x - 3, y, 6, 8, {
          opacity: live ? saw(spin, i * 0.33, 0.95, 0.2) : 0.9,
          transform: [{ translateY: live ? saw(spin, i * 0.33, 0, 260 * s) : 0 }],
        }, <Path d="M3 0 C4.6 3 6 4.4 6 5.6 C6 7 4.6 8 3 8 C1.4 8 0 7 0 5.6 C0 4.4 1.4 3 3 0 Z" fill="#9FE6FF" />),
      ),
    );
  }
  const beam = id === 'beach' && time !== 'day' && !side;
  const moonPath = id === 'beach' && time === 'night' && !side;
  const beamX = v === 1 ? 314 : 350; // в середине комнаты маяк чуть левее — не режется швом

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height} viewBox="0 0 390 844" preserveAspectRatio="xMidYMax slice" style={StyleSheet.absoluteFill}>
        {art}
      </Svg>
      {part === 'all' ? <SkyLife id={id} width={width} height={height} time={time} active={active} side={side} /> : null}

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
            ...abs(beamX - 150, 322 - 150),
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

export const Location = memo(DrawnLocation);
