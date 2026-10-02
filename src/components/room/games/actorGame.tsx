// Что игра добавляет чибику: тыква над головой, сажа и «выбыл», время в «Реакции», рука в КНБ, «оглушило».
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { GameSnap } from '../../../lib/games/host';
import { placesOf } from '../../../lib/games/rules';
import type { FaceKey } from '../../../lib/face';
import { nativeDriver } from '../../../lib/motion';
import { C } from '../../../theme';
import type { ChibiPose } from '../../Chibi';
import { Txt } from '../../ui';
import { Dizzy, HandArt, Pumpkin, Soot, Spark } from './art';
import { FLIGHT_MS } from './GameWorld';

export type ActorGame = { pose?: ChibiPose; emotion?: FaceKey; value?: number; over?: ReactNode; cover?: ReactNode; faded?: boolean };

const secs = (ms: number) => `${(ms / 1000).toFixed(2).replace('.', ',')} с`;

export function actorGame(snap: GameSnap | null, m: string, toLocal: (t: number) => number, size: number, reduce: boolean): ActorGame | null {
  if (!snap || (snap.phase !== 'play' && snap.phase !== 'end') || !snap.players.includes(m)) return null;
  const st = snap.st;
  if (!st) return null;
  const out = st.out.includes(m);
  if (snap.phase === 'end' && placesOf(st)[0] === m) return { pose: 'cheer', emotion: 'joy', value: 95 };

  if (st.g === 'pumpkin') {
    if (out) return { faded: true, pose: 'sit', emotion: 'sadness', value: 60, cover: <Soot size={size} />, over: <Tag text="вне игры" color={C.faint} /> };
    if (st.holder === m && st.phase === 'hold') {
      return { emotion: 'anxiety', value: 75, over: <PumpkinHead key={st.passAt} delay={st.from ? FLIGHT_MS : 0} reduce={reduce} /> };
    }
    return null;
  }

  if (st.g === 'stars') {
    if (out) return { faded: true, pose: 'sit', emotion: 'sadness', value: 50, over: <Tag text="вне игры" color={C.faint} /> };
    const until = toLocal(st.stun[m] ?? 0);
    if (until > Date.now()) return { emotion: 'anxiety', value: 70, over: <Timed until={until}><Dizzy size={70} /></Timed> };
    return null;
  }

  if (st.g === 'reaction') {
    if (out) return { faded: true, pose: 'sit', emotion: 'sadness', value: 50, over: <Tag text="вне игры" color={C.faint} /> };
    const a = st.answers[m];
    if (st.phase === 'result') {
      if (st.winner === m && typeof a === 'number') return { pose: 'cheer', emotion: 'joy', value: 90, over: <Tag text={`${secs(a)} · очко`} color={C.good} /> };
      if (a === 'fs') return { emotion: 'sadness', value: 60, over: <Tag text="фальстарт" color={C.warn} /> };
      if (typeof a === 'number') return { over: <Tag text={secs(a)} color={C.text} /> };
      return { over: <Tag text="—" color={C.faint} /> };
    }
    if (a === 'fs') return { emotion: 'sadness', value: 60, over: <Tag text="фальстарт" color={C.warn} /> };
    if (a !== undefined) return { over: <Tag text="готово" color={C.text} /> };
    return null;
  }

  // Камень, ножницы, бумага
  if (st.phase === 'reveal' && st.shown?.[m]) {
    const lost = st.lost.includes(m);
    const draw = st.result === 'draw';
    return {
      pose: !draw && !lost ? 'cheer' : undefined,
      emotion: lost ? 'sadness' : draw ? 'calm' : 'joy',
      value: 75,
      over: <HandArt hand={st.shown[m]} size={52} />,
    };
  }
  if (out) return { faded: true, pose: 'sit', emotion: 'sadness', value: 50, over: <Tag text="вне игры" color={C.faint} /> };
  if (st.phase === 'choose' && st.picked.includes(m)) return { over: <Tag text="готово" color={C.good} /> };
  return null;
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <Txt weight="heavy" size={12.5} color={color} numberOfLines={1}>
        {text}
      </Txt>
    </View>
  );
}

// Показать до момента until (оглушение кончится само, без нового снимка)
function Timed({ until, children }: { until: number; children: ReactNode }) {
  const [on, setOn] = useState(until > Date.now());
  useEffect(() => {
    const t = setTimeout(() => setOn(false), Math.max(0, until - Date.now()));
    return () => clearTimeout(t);
  }, [until]);
  return on ? <>{children}</> : null;
}

// Тыква над головой: прилетает (после полёта появляется), качается, фитиль искрит
function PumpkinHead({ delay, reduce }: { delay: number; reduce: boolean }) {
  const show = useRef(new Animated.Value(delay ? 0 : 1)).current;
  const wob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anims: Animated.CompositeAnimation[] = [];
    if (delay) {
      const a = Animated.sequence([Animated.delay(delay), Animated.spring(show, { toValue: 1, useNativeDriver: nativeDriver, speed: 22, bounciness: 12 })]);
      a.start();
      anims.push(a);
    }
    if (!reduce) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(wob, { toValue: 1, duration: 140, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
          Animated.timing(wob, { toValue: 0, duration: 140, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
        ]),
      );
      loop.start();
      anims.push(loop);
    }
    return () => anims.forEach((a) => a.stop());
  }, [delay, reduce, show, wob]);
  return (
    <Animated.View
      style={{
        width: 64,
        height: 64,
        opacity: show,
        transform: [{ scale: show.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }, { rotate: wob.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '7deg'] }) }],
      }}
    >
      <Pumpkin size={64} />
      <Animated.View style={[styles.spark, { opacity: wob.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.45, 1] }) }]}>
        <Spark size={20} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tag: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 11, borderWidth: 1.2, backgroundColor: 'rgba(24,18,40,0.82)' },
  spark: { position: 'absolute', left: 30, top: -3 },
});
