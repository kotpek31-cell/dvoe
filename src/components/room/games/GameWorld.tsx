// Игры на площадке (внутри камеры, в пикселях мира): падающие звёзды с тенями, полёт тыквы, взрыв.
// Тени — под чибиками (zIndex 1), звёзды и тыква — над ними.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { GameSnap } from '../../../lib/games/host';
import { starSchedule, STARS, type PumpkinPub, type Star, type StarsPub } from '../../../lib/games/rules';
import { gameSpot } from '../../../lib/games/useRoomGame';
import type { LocationId } from '../../../lib/locations';
import { nativeDriver } from '../../../lib/motion';
import { pxX, pxY, scaleAt, type Geo, type Mover } from '../../../lib/roomWorld';
import { F } from '../../../theme';
import { CloudArt, Pumpkin, Shadow, StarArt } from './art';

type Props = {
  snap: GameSnap;
  toLocal: (t: number) => number;
  geo: Geo;
  loc: LocationId;
  movers: Map<string, Mover>;
  colorOf: (m: string) => string;
  reduce: boolean;
};

export function GameWorld(p: Props) {
  const st = p.snap.st;
  if (!st || (p.snap.phase !== 'play' && p.snap.phase !== 'end')) return null;
  if (st.g === 'stars') return <StarsWorld {...p} st={st} />;
  if (st.g === 'pumpkin') return <PumpkinWorld {...p} st={st} />;
  return null;
}

// Голова чибика в мире (над плашкой с именем)
export function headAt(g: Geo, mv: Mover | undefined) {
  if (!mv) return null;
  const p = mv.now();
  const k = scaleAt(g, p.y);
  const h = (g.base * 170) / 120;
  return { x: pxX(g, p.x), y: pxY(g, p.y) - h * k * 0.94 - 34 };
}

// ---------- Звездопад ----------
function StarsWorld({ snap, st, toLocal, geo, loc, colorOf, reduce }: Props & { st: StarsPub }) {
  const sched = useMemo(() => starSchedule(snap.seed), [snap.seed]);
  const start = toLocal(st.start);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);
  const visible = sched.filter((x) => now >= start + x.at - 120 && now < start + x.at + STARS.FALL + 900);
  return (
    <>
      {visible.map((x) => {
        const spot = gameSpot(geo, loc, snap, x);
        const by = st.taken[x.i];
        return (
          <FallingStar
            key={`${snap.id}-${x.i}`}
            star={x}
            spawn={start + x.at}
            px={pxX(geo, spot.x)}
            py={pxY(geo, spot.y)}
            k={scaleAt(geo, spot.y) * geo.s}
            by={by ? colorOf(by) : null}
            zapped={(st.zaps[x.i] ?? []).length > 0}
            reduce={reduce}
          />
        );
      })}
    </>
  );
}

const FallingStar = memo(function FallingStar({ star, spawn, px, py, k, by, zapped, reduce }: { star: Star; spawn: number; px: number; py: number; k: number; by: string | null; zapped: boolean; reduce: boolean }) {
  const fall = useRef(new Animated.Value(0)).current;
  const after = useRef(new Animated.Value(0)).current;
  const [landed, setLanded] = useState(false);
  const cloud = star.kind === 'cloud';
  useEffect(() => {
    const now = Date.now();
    const p0 = Math.min(1, Math.max(0, (now - spawn) / STARS.FALL));
    fall.setValue(p0);
    const rest = spawn + STARS.FALL - now;
    if (rest > 0) Animated.timing(fall, { toValue: 1, duration: rest, easing: cloud ? Easing.out(Easing.quad) : Easing.in(Easing.quad), useNativeDriver: nativeDriver }).start();
    const t = setTimeout(
      () => {
        setLanded(true);
        Animated.timing(after, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
      },
      Math.max(0, rest),
    );
    return () => {
      clearTimeout(t);
      fall.stopAnimation();
      after.stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const size = Math.round((star.kind === 'gold' ? 46 : 36) * Math.max(0.8, k));
  const cloudW = Math.round(92 * Math.max(0.8, k));
  const shadowW = Math.round((cloud ? 70 : 54) * Math.max(0.75, k));
  const shadowColor = cloud ? '#B7A8FF' : star.kind === 'gold' ? '#FFB800' : '#FFD45E';
  const skyY = -60;
  const hover = py - 150 * k; // где висит тучка
  const fade = after.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.6, 0] });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          {
            zIndex: 1,
            left: px - shadowW / 2,
            top: py - shadowW * 0.2,
            opacity: landed ? fade : fall.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
            transform: [{ scale: fall.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) }],
          },
        ]}
      >
        <Shadow w={shadowW} color={shadowColor} />
      </Animated.View>
      {cloud ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.abs,
            {
              zIndex: 5000,
              left: px - cloudW / 2,
              top: 0,
              opacity: landed ? fade : 1,
              transform: [{ translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [skyY, hover - cloudW * 0.32] }) }],
            },
          ]}
        >
          <CloudArt size={cloudW} bolt={landed} />
          {landed && !reduce ? <Flash w={cloudW} h={py - hover + 10} on={zapped} /> : null}
        </Animated.View>
      ) : (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.abs,
            {
              zIndex: 5000,
              left: px - size / 2,
              top: 0,
              opacity: landed ? (by ? after.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.9, 0] }) : fade) : 1,
              transform: [
                { translateX: fall.interpolate({ inputRange: [0, 1], outputRange: [-40 * k, 0] }) },
                { translateY: landed ? after.interpolate({ inputRange: [0, 1], outputRange: [py - size * 0.7, py - size * (by ? 2.2 : 0.6)] }) : fall.interpolate({ inputRange: [0, 1], outputRange: [skyY, py - size * 0.7] }) },
                { scale: landed ? after.interpolate({ inputRange: [0, 1], outputRange: [1, by ? 1.5 : 0.4] }) : 1 },
                { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['-40deg', '0deg'] }) },
              ],
            },
          ]}
        >
          <StarArt size={size} gold={star.kind === 'gold'} />
        </Animated.View>
      )}
      {landed && by && !cloud ? (
        <Animated.Text
          pointerEvents="none"
          style={[
            styles.plus,
            {
              zIndex: 5001,
              left: px - 40,
              top: py - size * 2.4,
              color: by,
              opacity: after.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] }),
              transform: [{ translateY: after.interpolate({ inputRange: [0, 1], outputRange: [0, -30] }) }],
            },
          ]}
        >
          {star.kind === 'gold' ? `+${STARS.GOLD}` : '+1'}
        </Animated.Text>
      ) : null}
    </>
  );
});

function Flash({ w, h, on }: { w: number; h: number; on: boolean }) {
  return <View pointerEvents="none" style={[styles.flash, { left: w / 2 - 3, top: w * 0.55, height: Math.max(0, h - w * 0.4), opacity: on ? 0.9 : 0.45 }]} />;
}

// ---------- Горячая тыква: полёт к новому держателю и взрыв ----------
function PumpkinWorld({ st, toLocal, geo, movers, reduce }: Props & { st: PumpkinPub }) {
  const passLocal = toLocal(st.passAt);
  const boomLocal = toLocal(st.boomAt);
  return (
    <>
      {st.from && st.holder && !reduce && Date.now() - passLocal < 450 ? (
        <Flight key={`f${st.passAt}`} from={headAt(geo, movers.get(st.from))} to={headAt(geo, movers.get(st.holder))} size={Math.round(46 * Math.max(0.9, geo.s))} />
      ) : null}
      {st.boomed && Date.now() - boomLocal < 1500 ? <Boom key={`b${st.boomAt}`} at={headAt(geo, movers.get(st.boomed))} s={geo.s} reduce={reduce} /> : null}
    </>
  );
}

export const FLIGHT_MS = 380;

function Flight({ from, to, size }: { from: { x: number; y: number } | null; to: { x: number; y: number } | null; size: number }) {
  const v = useRef(new Animated.Value(0)).current;
  const [done, setDone] = useState(false);
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: FLIGHT_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }).start(() => setDone(true));
  }, [v]);
  if (!from || !to || done) return null;
  const lift = Math.min(140, 50 + Math.abs(to.x - from.x) * 0.3);
  const mid = Math.min(from.y, to.y) - lift;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.abs,
        {
          zIndex: 6000,
          left: -size / 2,
          top: -size / 2,
          transform: [
            { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] }) },
            { translateY: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [from.y, mid, to.y] }) },
            { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', to.x > from.x ? '320deg' : '-320deg'] }) },
          ],
        },
      ]}
    >
      <Pumpkin size={size} glow={false} />
    </Animated.View>
  );
}

const DEBRIS: [number, number, string][] = [
  [-60, -50, '#FF9A3D'],
  [55, -60, '#FFD45E'],
  [-30, -85, '#FF9A3D'],
  [80, -20, '#D9772A'],
  [-85, -10, '#FFD45E'],
  [20, -95, '#4E8A3E'],
  [-50, 30, '#D9772A'],
  [60, 30, '#FF9A3D'],
];

function Boom({ at, s, reduce }: { at: { x: number; y: number } | null; s: number; reduce: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: reduce ? 300 : 1000, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
  }, [v, reduce]);
  if (!at) return null;
  const r = 70 * s;
  return (
    <View pointerEvents="none" style={[styles.abs, { zIndex: 6000, left: at.x, top: at.y + 20 }]}>
      <Animated.View
        style={[
          styles.blast,
          {
            width: r * 2,
            height: r * 2,
            borderRadius: r,
            left: -r,
            top: -r,
            opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.95, 0] }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.5] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.blastCore,
          {
            width: r,
            height: r,
            borderRadius: r / 2,
            left: -r / 2,
            top: -r / 2,
            opacity: v.interpolate({ inputRange: [0, 0.1, 0.5], outputRange: [0, 1, 0], extrapolate: 'clamp' }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 0.5], outputRange: [0.4, 1.6], extrapolate: 'clamp' }) }],
          },
        ]}
      />
      {!reduce
        ? DEBRIS.map(([dx, dy, col], i) => (
            <Animated.View
              key={i}
              style={[
                styles.debris,
                {
                  backgroundColor: col,
                  opacity: v.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] }),
                  transform: [
                    { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, dx * s * 1.4] }) },
                    { translateY: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, dy * s * 1.2, dy * s * 1.2 + 40 * s] }) },
                    { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i % 2 ? 1 : -1) * 260}deg`] }) },
                  ],
                },
              ]}
            />
          ))
        : null}
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={`s${i}`}
          style={[
            styles.smoke,
            {
              width: 34 * s,
              height: 34 * s,
              borderRadius: 17 * s,
              left: (i - 1) * 26 * s - 17 * s,
              opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.6, 0] }),
              transform: [
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -70 * s - i * 14] }) },
                { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.6] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  plus: { position: 'absolute', width: 80, textAlign: 'center', fontFamily: F.display, fontSize: 22, textShadowColor: '#2B2035', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  flash: { position: 'absolute', width: 6, borderRadius: 3, backgroundColor: '#FFF4C2' },
  blast: { position: 'absolute', backgroundColor: '#FFB347' },
  blastCore: { position: 'absolute', backgroundColor: '#FFF4C2' },
  debris: { position: 'absolute', left: -5, top: -4, width: 10, height: 8, borderRadius: 3, borderWidth: 1, borderColor: '#2B2035' },
  smoke: { position: 'absolute', top: -17, backgroundColor: '#7D7690' },
});

