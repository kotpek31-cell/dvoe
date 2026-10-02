// Локация «Луг у озера»: небо по времени суток, холмы, озеро, деревья, плед.
// Живые детали (облака, бабочки, светлячки, фонарик) — лёгкие анимации (на телефоне — native driver).
import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { saw, tri } from '../../lib/anim';
import { nativeDriver, useReducedMotion } from '../../lib/motion';
import { FLOWERS, PALETTES, sceneTransform, STARS, type DayTime } from '../../lib/scene';

const CLOUD = 'M14 42 C3 42 1 29 12 27 C12 14 29 10 37 19 C41 6 64 4 70 17 C78 8 95 12 95 25 C108 23 116 34 107 42 Z';

type Props = { width: number; height: number; time: DayTime; active: boolean; part?: 'all' | 'sky' | 'land' };

function MeadowView({ width, height, time, active, part = 'all' }: Props) {
  const sky = part !== 'land'; // небо, солнце, луна, облака
  const land = part !== 'sky'; // холмы, озеро, деревья и всё живое на земле
  const p = PALETTES[time];
  const reduce = useReducedMotion();
  const tf = useMemo(() => sceneTransform(width, height), [width, height]);
  const s = tf.s;

  const clock = useRef(new Animated.Value(0)).current; // медленный: облака (100 с)
  const drift = useRef(new Animated.Value(0)).current; // бабочки и светлячки (22 с)
  const blink = useRef(new Animated.Value(0)).current; // мерцание (2.4 с)
  const flap = useRef(new Animated.Value(0)).current; // крылья (0.22 с)

  useEffect(() => {
    if (reduce || !active) return;
    const loops = [
      Animated.loop(Animated.timing(clock, { toValue: 1, duration: 100000, easing: Easing.linear, useNativeDriver: nativeDriver })),
      Animated.loop(Animated.timing(drift, { toValue: 1, duration: 22000, easing: Easing.linear, useNativeDriver: nativeDriver })),
      Animated.loop(Animated.timing(blink, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: nativeDriver })),
      Animated.loop(
        Animated.sequence([
          Animated.timing(flap, { toValue: 1, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
          Animated.timing(flap, { toValue: 0, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
        ]),
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduce, active, clock, drift, blink, flap]);

  const clouds = [
    { y: 92, w: 124, offset: 0.1 },
    { y: 186, w: 88, offset: 0.55 },
    { y: 262, w: 150, offset: 0.8 },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height} viewBox="0 0 390 844" preserveAspectRatio="xMidYMax slice" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="meadow-sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={p.sky[0]} />
            <Stop offset="0.34" stopColor={p.sky[1]} />
            <Stop offset="0.57" stopColor={p.sky[2]} />
          </LinearGradient>
        </Defs>
        {sky ? (
          <>
        <Rect x={-400} y={-400} width={1190} height={1300} fill="url(#meadow-sky)" />
        {p.starsOp > 0 ? (
          <G opacity={p.starsOp}>
            {STARS.map((st, i) => (
              <Circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#FFFFFF" />
            ))}
          </G>
        ) : null}
        {p.sun.op > 0 ? (
          <G>
            <Circle cx={p.sun.x} cy={p.sun.y} r={p.sun.glowR} fill={p.sun.glow} opacity={0.35} />
            <Circle cx={p.sun.x} cy={p.sun.y} r={p.sun.r} fill={p.sun.color} />
          </G>
        ) : null}
        {p.moonOp > 0 ? (
          <G>
            <Circle cx={300} cy={136} r={64} fill="#DCE3FF" opacity={0.12} />
            <Circle cx={300} cy={136} r={30} fill="#F6F1D8" />
            <Circle cx={290} cy={128} r={6} fill="#E6DFC2" />
            <Circle cx={309} cy={146} r={4.2} fill="#E6DFC2" />
            <Circle cx={307} cy={123} r={2.6} fill="#E6DFC2" />
          </G>
        ) : null}
          </>
        ) : null}
        {land ? (
          <>
        <Path d="M-60 446 C40 412 92 400 140 424 C176 396 236 376 290 402 C330 384 364 390 450 404 L450 520 L-60 520 Z" fill={p.hill1} />
        <Path d="M-60 474 C60 448 120 446 180 466 C240 442 320 440 450 462 L450 520 L-60 520 Z" fill={p.hill2} />
        <G>
          <Rect x={54} y={466} width={8} height={28} rx={3} fill={p.trunk} />
          <Circle cx={58} cy={450} r={22} fill={p.leaf1} />
          <Circle cx={44} cy={463} r={14} fill={p.leaf3} />
          <Circle cx={72} cy={462} r={15} fill={p.leaf1} />
          <Circle cx={51} cy={440} r={8} fill={p.leaf2} opacity={0.7} />
        </G>
        <Path d="M-60 490 C70 480 150 478 230 484 C300 488 350 484 450 492 L450 544 C330 552 250 550 170 548 C90 546 30 550 -60 552 Z" fill={p.lake} />
        <Path d="M-60 490 C70 480 150 478 230 484 C300 488 350 484 450 492 L450 498 C340 492 290 496 230 492 C150 486 70 488 -60 498 Z" fill={p.lakeEdge} />
        <Path d="M52 512 h26 M146 524 h40 M254 508 h22 M300 530 h30 M100 536 h18" fill="none" stroke={p.shimmer} strokeWidth={2.4} strokeLinecap="round" opacity={0.6} />
        <Ellipse cx={p.refl.x} cy={514} rx={p.refl.rx} ry={4} fill={p.refl.color} opacity={p.refl.op} />
        <Path d="M-60 540 C80 528 160 526 240 532 C300 537 350 534 450 528 L450 900 L-60 900 Z" fill={p.meadow} />
        <Path d="M-60 612 C100 590 260 594 450 614 L450 900 L-60 900 Z" fill={p.meadow2} />
        <Path
          d="M188 540 C176 562 206 580 196 606 C184 636 150 652 160 700 C168 740 140 790 150 900 L236 900 C222 790 246 744 232 702 C222 664 256 640 262 608 C268 580 232 562 226 540 Z"
          fill={p.trail}
          opacity={0.85}
        />
        <G>
          <Rect x={340} y={540} width={12} height={58} rx={5} fill={p.trunk} />
          <Circle cx={346} cy={512} r={38} fill={p.leaf1} />
          <Circle cx={318} cy={536} r={25} fill={p.leaf3} />
          <Circle cx={374} cy={534} r={24} fill={p.leaf1} />
          <Circle cx={334} cy={496} r={14} fill={p.leaf2} opacity={0.7} />
          <Circle cx={360} cy={520} r={7} fill={p.leaf2} opacity={0.55} />
        </G>
        <Circle cx={18} cy={602} r={17} fill={p.bush} />
        <Circle cx={42} cy={608} r={14} fill={p.leaf3} />
        <Circle cx={12} cy={594} r={7} fill={p.leaf2} opacity={0.6} />
        <Path d="M214 626 L360 618 L378 690 L200 700 Z" fill={p.blanket} />
        <Path
          d="M250 624 L240 698 M288 622 L284 696 M326 620 L330 693 M209 650 L366 641 M204 675 L372 666"
          fill="none"
          stroke={p.blanketLine}
          strokeWidth={6}
          opacity={0.5}
        />
        <G opacity={p.flowerOp}>
          {FLOWERS.map(([x, y, color, size], i) => (
            <G key={i} transform={`translate(${x} ${y}) scale(${size / 20})`}>
              <Circle cx={10} cy={4.6} r={3.6} fill={color} />
              <Circle cx={15.2} cy={8.4} r={3.6} fill={color} />
              <Circle cx={13.2} cy={14.4} r={3.6} fill={color} />
              <Circle cx={6.8} cy={14.4} r={3.6} fill={color} />
              <Circle cx={4.8} cy={8.4} r={3.6} fill={color} />
              <Circle cx={10} cy={10} r={2.9} fill="#FFB347" />
            </G>
          ))}
        </G>
        {p.lanternOp > 0 ? (
          <G opacity={p.lanternOp}>
            <Rect x={199} y={612} width={15} height={19} rx={4} fill="#FFE7A3" stroke="#2B2035" strokeWidth={1.6} />
            <Path d="M202 612 Q206.5 603 211 612" fill="none" stroke="#2B2035" strokeWidth={1.6} />
          </G>
        ) : null}
        <Path d="M-60 748 C90 736 220 738 450 752 L450 900 L-60 900 Z" fill={p.near} />
        <Path
          d="M18 750 l3 -13 l3 11 l4 -15 l3 17 M120 742 l3 -11 l3 9 l4 -13 l3 15 M292 746 l3 -12 l3 10 l4 -14 l3 16 M366 752 l3 -11 l3 9 l4 -12 l3 14"
          fill="none"
          stroke={p.leaf3}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
          </>
        ) : null}
      </Svg>

      {(sky ? clouds : []).map((c, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            top: tf.y(c.y),
            opacity: p.cloudOp,
            transform: [
              {
                translateX: saw(clock, c.offset, -170 * s, width + 40 * s),
              },
            ],
          }}
        >
          <Svg width={c.w * s} height={(c.w * s * 50) / 124} viewBox="0 0 124 50">
            <Path d={CLOUD} fill={p.cloud} />
          </Svg>
        </Animated.View>
      ))}

      {land && p.lanternOp > 0 ? (
        <Animated.View
          style={{
            position: 'absolute',
            left: tf.x(166),
            top: tf.y(580),
            width: 82 * s,
            height: 82 * s,
            opacity: tri(blink, 0, 0.55 * p.lanternOp, p.lanternOp),
          }}
        >
          <Svg width={82 * s} height={82 * s} viewBox="0 0 82 82">
            <Circle cx={41} cy={41} r={41} fill="#FFD680" opacity={0.18} />
            <Circle cx={41} cy={41} r={26} fill="#FFD680" opacity={0.2} />
            <Circle cx={41} cy={41} r={13} fill="#FFE7A3" opacity={0.3} />
          </Svg>
        </Animated.View>
      ) : null}

      {land && time === 'day'
        ? [
            { xs: [30, 150, 250, 120, 30], ys: [430, 380, 450, 500, 430], c1: '#FFD166', c2: '#FFB347', off: 0 },
            { xs: [330, 220, 300, 330, 330], ys: [560, 600, 520, 560, 560], c1: '#FF9EBB', c2: '#FF7FA6', off: 0.4 },
          ].map((b, i) => {
            const t = saw(drift, b.off, 0, 1);
            return (
              <Animated.View
                key={`b${i}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  transform: [
                    { translateX: t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: b.xs.map(tf.x) }) },
                    { translateY: t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: b.ys.map(tf.y) }) },
                  ],
                }}
              >
                <Animated.View style={{ transform: [{ scaleX: flap.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) }] }}>
                  <Svg width={26 * s} height={22 * s} viewBox="0 0 26 22">
                    <Path d="M13 11 C8 1 1 2 2 8 C3 13 8 13 13 11 Z M13 11 C9 16 4 20 4 16 C4 13 8 12 13 11 Z" fill={b.c1} stroke="#2B2035" strokeWidth={1.2} />
                    <Path d="M13 11 C18 1 25 2 24 8 C23 13 18 13 13 11 Z M13 11 C17 16 22 20 22 16 C22 13 18 12 13 11 Z" fill={b.c2} stroke="#2B2035" strokeWidth={1.2} />
                    <Path d="M13 6 V17" stroke="#2B2035" strokeWidth={1.8} strokeLinecap="round" />
                  </Svg>
                </Animated.View>
              </Animated.View>
            );
          })
        : null}

      {land && time !== 'day'
        ? Array.from({ length: time === 'night' ? 9 : 6 }, (_, i) => {
            const x = 20 + ((i * 97) % 350);
            const y = time === 'night' ? 470 + ((i * 61) % 250) : 540 + ((i * 53) % 200);
            const off = i / 9;
            const color = time === 'night' ? '#FFF2A6' : '#FFE0EC';
            return (
              <Animated.View
                key={`f${i}`}
                style={{
                  position: 'absolute',
                  left: tf.x(x),
                  top: tf.y(y),
                  width: 16,
                  height: 16,
                  opacity: time === 'night' ? tri(blink, (i * 0.37) % 1, 0.15, 1) : 0.8,
                  transform: [
                    { translateX: tri(drift, off, -10 * s, 14 * s) },
                    { translateY: time === 'night' ? tri(drift, off, 0, -22 * s) : saw(drift, off, 0, -160 * s) },
                  ],
                }}
              >
                <Svg width={16} height={16} viewBox="0 0 16 16">
                  <Circle cx={8} cy={8} r={8} fill={color} opacity={0.25} />
                  <Circle cx={8} cy={8} r={3} fill={color} />
                </Svg>
              </Animated.View>
            );
          })
        : null}
    </View>
  );
}

export const Meadow = memo(MeadowView);
