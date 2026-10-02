// Перед игрой: колесо 4 с со щелчками (игру выбрал сервер — у всех останавливается на ней же),
// название выпавшей игры, отсчёт 3-2-1 поверх арены (чибики тем временем сбегаются туда).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { COUNT_MS, INTRO_MS, WHEEL_MS, type GameSnap } from '../../../lib/games/host';
import { rng, type GameId } from '../../../lib/games/rules';
import { nativeDriver } from '../../../lib/motion';
import { playSound } from '../../../lib/sound';
import { C, F } from '../../../theme';
import { Icon } from '../../Icon';
import { Txt } from '../../ui';

export const GAME_NAME: Record<GameId, string> = { pumpkin: 'Горячая тыква', stars: 'Звездопад', reaction: 'Реакция', rps: 'Камень, ножницы, бумага' };
export const GAME_SHORT: Record<GameId, string> = { pumpkin: 'Тыква', stars: 'Звездопад', reaction: 'Реакция', rps: 'КНБ' };
export const GAME_HINT: Record<GameId, string> = {
  pumpkin: 'Нажми на соседа — тыква перелетит к нему. Бахнет у тебя — выбываешь',
  stars: 'Беги к тени и лови звёзды. Золотая — 3 очка, тучка оглушает',
  reaction: 'Жми, когда фонарь станет зелёным. Раньше — фальстарт',
  rps: '5 секунд на выбор. Проигравшие выбывают',
};
export const GAME_COLOR: Record<GameId, string> = { pumpkin: '#FF9A3D', stars: '#9B8CFF', reaction: '#5ED3A0', rps: '#8FA2FF' };
const ORDER: GameId[] = ['pumpkin', 'stars', 'reaction', 'rps'];
const INK = '#2B2035';

const easeOut = (x: number) => 1 - (1 - x) ** 3;

type Who = { id: string; name: string; color: string; note: string };

export function PreGame({ snap, toLocal, spinText, who, width, top, reduce }: { snap: GameSnap; toLocal: (t: number) => number; spinText: string; who: Who[]; width: number; top: number; reduce: boolean }) {
  const t0 = toLocal(snap.t0);
  const wheelEnd = t0 + WHEEL_MS;
  const introEnd = wheelEnd + INTRO_MS;
  const playAt = toLocal(snap.playAt);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  // Сколько повернуть: 5 оборотов + до середины выпавшего сектора (чуть мимо середины — у всех одинаково)
  const total = useMemo(() => {
    const i = ORDER.indexOf(snap.game);
    const wobble = (rng(snap.seed ^ 0x9e37)() - 0.5) * 50;
    return 1800 + ((((-45 - i * 90 + wobble) % 360) + 360) % 360);
  }, [snap.game, snap.seed]);

  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const start = Date.now();
    const k0 = Math.min(1, Math.max(0, (start - t0) / WHEEL_MS));
    p.setValue(reduce ? 1 : k0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!reduce && k0 < 1) {
      Animated.timing(p, { toValue: 1, duration: Math.max(1, wheelEnd - start), easing: Easing.linear, useNativeDriver: nativeDriver }).start();
      // щелчки: каждые 45° поворота
      let last = -1000;
      for (let deg = 45; deg < total; deg += 45) {
        const at = t0 + WHEEL_MS * (1 - Math.cbrt(1 - deg / total));
        if (at <= start || at - last < 45) continue;
        last = at;
        timers.push(setTimeout(() => playSound('tick', 0.55), at - start));
      }
    }
    if (wheelEnd > start) timers.push(setTimeout(() => playSound('ding', 0.7), wheelEnd - start));
    // 3-2-1
    for (let k = 0; k < 3; k++) {
      const at = introEnd + (k * COUNT_MS) / 3;
      if (at > start) timers.push(setTimeout(() => playSound('beep', 0.7), at - start));
    }
    if (playAt > start) timers.push(setTimeout(() => playSound('go', 0.8), playAt - start));
    return () => {
      timers.forEach(clearTimeout);
      p.stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.id]);

  const steps = useMemo(() => Array.from({ length: 21 }, (_, k) => k / 20), []);
  const rotate = p.interpolate({ inputRange: steps, outputRange: steps.map((x) => `${(total * easeOut(x)).toFixed(1)}deg`) });

  const counting = now >= introEnd && now < playAt;
  const n = counting ? 3 - Math.min(2, Math.floor(((now - introEnd) / COUNT_MS) * 3)) : 0;
  const r = Math.min(150, width * 0.36);
  const stopped = now >= wheelEnd;

  if (counting) {
    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: 'rgba(8,5,18,0.18)' }]}>
        <View style={[styles.countTop, { top: top + 58 }]}>
          <View style={[styles.gamePill, { borderColor: GAME_COLOR[snap.game] }]}>
            <Txt weight="heavy" size={14} color={GAME_COLOR[snap.game]}>
              {GAME_NAME[snap.game]}
            </Txt>
          </View>
          <View style={styles.hint}>
            <Txt weight="heavy" size={13.5} center>
              {GAME_HINT[snap.game]}
            </Txt>
          </View>
        </View>
        <CountNum key={n} n={n} reduce={reduce} />
      </View>
    );
  }
  if (now >= playAt) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim]}>
      <View style={[styles.head, { top: top + 64 }]}>
        <Txt weight="display" size={20} center>
          {stopped ? `${GAME_NAME[snap.game]}!` : 'Во что играем?'}
        </Txt>
        <Txt weight="bold" size={13} muted center>
          {stopped ? GAME_HINT[snap.game] : spinText}
        </Txt>
      </View>
      <View style={[styles.wheelWrap, { top: top + 150, width: r * 2 + 40, height: r * 2 + 56, left: width / 2 - r - 20 }]}>
        <Animated.View style={{ position: 'absolute', left: 20, top: 30, width: r * 2, height: r * 2, transform: [{ rotate }] }}>
          <WheelArt r={r} highlight={stopped ? snap.game : null} />
        </Animated.View>
        <View style={[styles.hub, { left: 20 + r - 26, top: 30 + r - 26 }]}>
          <Icon name="wheel" size={26} color="#FFD45E" />
        </View>
        <Svg width={40} height={40} style={{ position: 'absolute', left: r, top: 0 }} viewBox="-20 -6 40 40">
          <Path d="M-15 0 L15 0 L0 28 Z" fill={C.accent} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        </Svg>
      </View>
      <View style={[styles.chips, { top: top + 150 + r * 2 + 64 }]}>
        {who.map((w) => (
          <View key={w.id} style={[styles.chip, { borderColor: w.color }]}>
            <Txt weight="heavy" size={13} numberOfLines={1}>
              {w.name}
            </Txt>
            <Txt weight="bold" size={11.5} muted numberOfLines={1}>
              {w.note}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

function WheelArt({ r, highlight }: { r: number; highlight: GameId | null }) {
  const R = 100;
  const sector = (i: number) => {
    const a0 = ((i * 90 - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * 90 - 90) * Math.PI) / 180;
    return `M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 0 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`;
  };
  return (
    <Svg width={r * 2} height={r * 2} viewBox={`${-R - 8} ${-R - 8} ${2 * R + 16} ${2 * R + 16}`}>
      <Circle cx={0} cy={0} r={R + 6} fill={INK} stroke="#FFD45E" strokeWidth={3} />
      {ORDER.map((g, i) => (
        <Path key={g} d={sector(i)} fill={GAME_COLOR[g]} stroke={INK} strokeWidth={2} opacity={highlight && highlight !== g ? 0.45 : 1} />
      ))}
      {ORDER.map((g, i) => (
        <G key={`t${g}`} transform={`rotate(${i * 90 + 45})`}>
          <SvgText x={0} y={-R * 0.56} fill={INK} fontSize={11} fontFamily={F.display} textAnchor="middle" alignmentBaseline="middle">
            {GAME_SHORT[g]}
          </SvgText>
        </G>
      ))}
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return <Circle key={i} cx={(R + 3) * Math.cos(a)} cy={(R + 3) * Math.sin(a)} r={2.4} fill="#FFF4C2" />;
      })}
    </Svg>
  );
}

function CountNum({ n, reduce }: { n: number; reduce: boolean }) {
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.spring(v, { toValue: 1, useNativeDriver: nativeDriver, speed: 18, bounciness: 12 }).start();
  }, [v, reduce]);
  return (
    <Animated.Text
      style={[
        styles.count,
        { opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.8, 1] }) }] },
      ]}
    >
      {n}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(8,5,18,0.8)' },
  center: { alignItems: 'center', justifyContent: 'center' },
  head: { position: 'absolute', left: 24, right: 24, gap: 4 },
  wheelWrap: { position: 'absolute' },
  hub: { position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: INK, borderWidth: 3, borderColor: '#FFD45E', alignItems: 'center', justifyContent: 'center' },
  chips: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chip: { minWidth: 96, maxWidth: 140, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.4, backgroundColor: 'rgba(24,18,40,0.84)', alignItems: 'center' },
  gamePill: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 18, borderWidth: 1.4, backgroundColor: 'rgba(24,18,40,0.8)' },
  count: { fontFamily: F.display, fontSize: 120, color: '#FFFFFF', textShadowColor: INK, textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10 },
  countTop: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 8 },
  hint: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(24,18,40,0.8)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', maxWidth: '100%' },
});
