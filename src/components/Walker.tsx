// Чибик, который сам бродит по лугу: выбирает точку, идёт к ней, стоит, снова идёт.
// Движение — translateX на native driver; поворот и позу меняем раз за переход.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import type { FaceKey } from '../lib/face';
import { nativeDriver, useReducedMotion } from '../lib/motion';
import type { ChibiKind } from '../types';
import { Chibi, type ChibiPose } from './Chibi';

type Props = {
  kind: ChibiKind;
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
  label: string;
  onPress: () => void;
  children?: ReactNode; // то, что двигается вместе с чибиком: пузырь, имя, сердечки
};

export function Walker({ kind, emotion, value, size, top, minX, maxX, startX, speed, paused, pose, label, onPress, children }: Props) {
  const reduce = useReducedMotion();
  const x = useRef(new Animated.Value(startX)).current;
  const pos = useRef(startX);
  const [dir, setDir] = useState<1 | -1>(1);
  const [moving, setMoving] = useState(false);
  const height = Math.round((size * 170) / 120);

  useEffect(() => {
    if (paused || reduce || maxX <= minX) {
      x.stopAnimation((v) => {
        pos.current = v;
      });
      setMoving(false);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const step = () => {
      if (cancelled) return;
      const from = pos.current;
      let target = minX + Math.random() * (maxX - minX);
      if (Math.abs(target - from) < size * 0.5) {
        target = from < (minX + maxX) / 2 ? Math.min(maxX, from + size) : Math.max(minX, from - size);
      }
      const distance = Math.abs(target - from);
      setDir(target >= from ? 1 : -1);
      setMoving(true);
      Animated.timing(x, {
        toValue: target,
        duration: Math.max(600, (distance / speed) * 1000),
        easing: Easing.linear,
        useNativeDriver: nativeDriver,
      }).start(({ finished }) => {
        if (!finished || cancelled) return;
        pos.current = target;
        setMoving(false);
        timer = setTimeout(step, 900 + Math.random() * 2600);
      });
    };
    timer = setTimeout(step, 500 + Math.random() * 1500);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      x.stopAnimation((v) => {
        pos.current = v;
      });
    };
  }, [paused, reduce, minX, maxX, size, speed, x]);

  const currentPose: ChibiPose = paused ? pose ?? 'idle' : moving ? 'walk' : 'idle';

  return (
    <Animated.View style={[styles.box, { top, width: size, height, transform: [{ translateX: x }] }]} pointerEvents="box-none">
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ width: size, height }}>
        <Chibi kind={kind} emotion={emotion} value={value} pose={currentPose} size={size} flip={dir === -1} />
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
