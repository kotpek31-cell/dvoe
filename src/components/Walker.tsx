// Чибик, который сам бродит по лугу: выбирает точку, идёт к ней, стоит, снова идёт.
// По команде goTo идёт в нужную точку (нажали на землю, подходит к партнёру) и сообщает onArrive.
// Движение — translateX на native driver; поворот и позу меняем раз за переход.
// «Уменьшить движение»: не бродит, а по goTo сразу оказывается на месте.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import type { Look } from '../lib/chibi';
import type { FaceKey } from '../lib/face';
import { nativeDriver, useReducedMotion } from '../lib/motion';
import { Chibi, type ChibiPose } from './Chibi';

type Props = {
  look: Look;
  emotion: FaceKey;
  value: number;
  size: number;
  top: number;
  minX: number;
  maxX: number;
  startX: number;
  speed: number; // пикселей в секунду
  paused: boolean; // стоит на месте (пока с ним взаимодействуют или экран не виден)
  pose?: ChibiPose; // поза, пока стоит: например, машет рукой
  face?: 1 | -1; // куда смотреть, пока стоит (1 — вправо)
  goTo?: { x: number; id: number } | null; // пойти в точку (левый край чибика)
  onArrive?: (id: number) => void;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  children?: ReactNode; // то, что двигается вместе с чибиком: пузырь, имя, сердечки
};

export function Walker({ look, emotion, value, size, top, minX, maxX, startX, speed, paused, pose, face, goTo, onArrive, label, onPress, onLongPress, children }: Props) {
  const reduce = useReducedMotion();
  const x = useRef(new Animated.Value(startX)).current;
  const pos = useRef(startX);
  const [dir, setDir] = useState<1 | -1>(1);
  const [moving, setMoving] = useState(false);
  const height = Math.round((size * 170) / 120);
  const reached = useRef(0); // последний выполненный goTo
  const arrive = useRef(onArrive);
  arrive.current = onArrive;
  const goal = goTo && goTo.id !== reached.current ? goTo : null;
  const goalX = goal ? Math.min(maxX, Math.max(minX, goal.x)) : 0;
  const goalId = goal?.id ?? 0;

  useEffect(() => {
    if (paused || maxX <= minX || (reduce && !goalId)) {
      x.stopAnimation((v) => {
        pos.current = v;
      });
      setMoving(false);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const walk = (target: number, pace: number, then: () => void) => {
      const from = pos.current;
      const distance = Math.abs(target - from);
      if (distance < 2) {
        then();
        return;
      }
      setDir(target >= from ? 1 : -1);
      setMoving(true);
      Animated.timing(x, {
        toValue: target,
        duration: Math.max(400, (distance / pace) * 1000),
        easing: Easing.linear,
        useNativeDriver: nativeDriver,
      }).start(({ finished }) => {
        if (!finished || cancelled) return;
        pos.current = target;
        setMoving(false);
        then();
      });
    };
    const step = () => {
      if (cancelled || reduce) return;
      const from = pos.current;
      let target = minX + Math.random() * (maxX - minX);
      if (Math.abs(target - from) < size * 0.5) {
        target = from < (minX + maxX) / 2 ? Math.min(maxX, from + size) : Math.max(minX, from - size);
      }
      walk(target, speed, () => {
        timer = setTimeout(step, 900 + Math.random() * 2600);
      });
    };
    const done = () => {
      reached.current = goalId;
      arrive.current?.(goalId);
      timer = setTimeout(step, 2500 + Math.random() * 2500);
    };
    if (goalId && reduce) {
      x.setValue(goalX);
      pos.current = goalX;
      done();
    } else if (goalId) {
      walk(goalX, speed * 1.8, done);
    } else {
      timer = setTimeout(step, 500 + Math.random() * 1500);
    }
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      x.stopAnimation((v) => {
        pos.current = v;
      });
    };
  }, [paused, reduce, minX, maxX, size, speed, x, goalId, goalX]);

  const currentPose: ChibiPose = paused ? pose ?? 'idle' : moving ? (goalId ? 'run' : 'walk') : pose && pose !== 'idle' ? pose : 'idle';
  const flip = paused && face ? face === -1 : dir === -1;

  return (
    <Animated.View style={[styles.box, { top, width: size, height, transform: [{ translateX: x }] }]} pointerEvents="box-none">
      <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={450} accessibilityRole="button" accessibilityLabel={label} style={{ width: size, height }}>
        <Chibi look={look} emotion={emotion} value={value} pose={currentPose} size={size} flip={flip} />
      </Pressable>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', left: 0 },
});
