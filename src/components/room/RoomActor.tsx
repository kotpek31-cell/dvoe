// Чибик на площадке: стоит ногами в точке мира (Mover), дальше — меньше и позади, ближе — крупнее и впереди.
// Плашка «имя · роль» и облачко реакции над головой не уменьшаются — текст остаётся читаемым.
import { memo, useSyncExternalStore, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import type { Look } from '../../lib/chibi';
import type { FaceKey } from '../../lib/face';
import { pxY, scaleAt, type Geo, type Mover } from '../../lib/roomWorld';
import { C } from '../../theme';
import { Chibi, type ChibiPose } from '../Chibi';
import { Txt } from '../ui';

type Props = {
  mover: Mover;
  geo: Geo;
  look: Look;
  emotion: FaceKey;
  value: number;
  pose?: ChibiPose | null; // поза поверх ходьбы (дай пять, реакция)
  face?: 1 | -1; // куда смотреть, пока стоит
  label: string;
  dot: string; // цвет точки «я / человек / бот»
  online: boolean;
  hidden?: boolean; // идёт сцена способности с ним
  mog?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  a11y: string;
  over?: ReactNode; // облачко реакции, искры, тыква над головой
  cover?: ReactNode; // поверх чибика (сажа после взрыва) — масштабируется вместе с ним
  faded?: boolean; // выбыл из игры
};

export const RoomActor = memo(function RoomActor({ mover, geo, look, emotion, value, pose, face, label, dot, online, hidden, onPress, onLongPress, a11y, over, cover, faded }: Props) {
  const st = useSyncExternalStore(mover.subscribe, mover.getState, mover.getState);
  const size = geo.base;
  const h = Math.round((size * 170) / 120);
  const scale = mover.y.interpolate({ inputRange: [geo.farPx, geo.nearPx], outputRange: [geo.kFar, 1], extrapolate: 'clamp' });
  const headY = Animated.add(Animated.multiply(scale, -h * 0.94), h - 6); // от верха рамки: ноги — на её нижнем краю
  const walking = st.moving ? (st.run ? 'run' : 'walk') : null;
  const p: ChibiPose = walking ?? pose ?? (online ? 'idle' : 'sit');
  const flip = !st.moving && face ? face === -1 : st.dir === -1;
  // кто ближе — тот впереди: порядок по точке, куда идёт
  const z = Math.round(pxY(geo, st.to.y));
  const k = scaleAt(geo, st.to.y);

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      style={[styles.feet, { left: -size / 2, top: -h, width: size, height: h, zIndex: z, opacity: hidden ? 0 : 1, transform: [{ translateX: mover.x }, { translateY: mover.y }] }]}
    >
      <Animated.View
        pointerEvents="box-none"
        style={{ width: size, height: h, opacity: online && !faded ? 1 : 0.55, transform: [{ translateY: h / 2 }, { scale }, { translateY: -h / 2 }] }}
      >
        <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={450} accessibilityRole="button" accessibilityLabel={a11y} style={{ width: size, height: h }}>
          <Chibi look={look} emotion={emotion} value={value} pose={p} size={size} flip={flip} eyesClosed={!online && !walking} />
          {cover ? (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cover]}>
              {cover}
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.over, { left: size / 2 - 120, transform: [{ translateY: headY }] }]}>
        <View style={styles.overInner}>
          {over}
          <View style={[styles.tag, k < 0.8 ? styles.tagSmall : null]}>
            <View style={[styles.dot, { backgroundColor: online ? C.good : '#7D7690' }]} />
            <View style={[styles.who, { backgroundColor: dot }]} />
            <Txt weight="heavy" size={12} numberOfLines={1}>
              {label}
            </Txt>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  feet: { position: 'absolute' },
  cover: { zIndex: 50 }, // слои чибика со своим zIndex не должны перекрыть
  over: { position: 'absolute', width: 240, top: 0, height: 0 },
  overInner: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 2 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(24,18,40,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    maxWidth: 230,
  },
  tagSmall: { paddingHorizontal: 8, paddingVertical: 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  who: { width: 4, height: 12, borderRadius: 2, marginRight: 1 },
});
