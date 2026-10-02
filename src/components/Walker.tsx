// Чибик, который сам бродит по лугу: выбирает точку, идёт к ней, стоит, снова идёт.
// По команде goTo идёт в нужную точку (нажали на землю, подходит к партнёру) и сообщает onArrive.
// Движение — translateX на native driver; поворот и позу меняем раз за переход.
// «Уменьшить движение»: не бродит, а по goTo сразу оказывается на месте.
// Этап фиксации 0.2: шаг по нажатию — с мягким разгоном и торможением; steer — джойстик (идёт, пока держат);
// где чибик сейчас, считаем по времени (на Android конец нативной анимации приходит с опозданием — был «отскок» назад).
// 0.2.2: с minTop/maxTop ходит и вглубь — дальше меньше и позади, ближе крупнее и впереди (рамка — без масштаба,
// уменьшается только сам чибик, ногами на месте; плашки остаются читаемыми).
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
  goTo?: { x: number; y?: number; id: number } | null; // пойти в точку (левый край и верх чибика)
  steer?: { ang: number; run: boolean; n: number } | null; // джойстик: направление (0 — вправо), n — новый отрезок
  minTop?: number; // полоса глубины: верх рамки на дальнем и ближнем краю
  maxTop?: number;
  onArrive?: (id: number) => void;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  children?: ReactNode; // то, что двигается вместе с чибиком: пузырь, имя, сердечки
};

const EASE = Easing.bezier(0.3, 0, 0.25, 1);
const LINEAR = (t: number) => t;

export function Walker({ look, emotion, value, size, top, minX, maxX, startX, speed, paused, pose, face, goTo, steer, onArrive, label, onPress, onLongPress, minTop, maxTop, children }: Props) {
  const reduce = useReducedMotion();
  const x = useRef(new Animated.Value(startX)).current;
  const pos = useRef(startX);
  const deep = minTop !== undefined && maxTop !== undefined && maxTop > minTop;
  const lo = deep ? minTop : top;
  const hi = deep ? maxTop : top;
  const y = useRef(new Animated.Value(top)).current;
  const posY = useRef(top);
  const [zTop, setZTop] = useState(top);
  const [dir, setDir] = useState<1 | -1>(1);
  const [moving, setMoving] = useState(false);
  const height = Math.round((size * 170) / 120);
  const reached = useRef(0); // последний выполненный goTo
  const seg = useRef<{ fx: number; fy: number; tx: number; ty: number; start: number; dur: number; ease: (t: number) => number } | null>(null);
  const steered = useRef(false); // только что вели джойстиком — сам гулять начнёт не сразу
  const steerN = steer?.n ?? 0;
  const steerRef = useRef(steer);
  steerRef.current = steer;
  const arrive = useRef(onArrive);
  arrive.current = onArrive;
  const goal = goTo && goTo.id !== reached.current ? goTo : null;
  const goalX = goal ? Math.min(maxX, Math.max(minX, goal.x)) : 0;
  const goalY = goal && goal.y !== undefined ? Math.min(hi, Math.max(lo, goal.y)) : null;
  const goalId = goal?.id ?? 0;

  // Сменился размер экрана: стоим в той же полосе
  useEffect(() => {
    const v = deep ? Math.min(hi, Math.max(lo, posY.current)) : top;
    if (v === posY.current) return;
    y.setValue(v);
    posY.current = v;
    setZTop(v);
  }, [deep, lo, hi, top, y]);

  useEffect(() => {
    // Остановиться там, где он сейчас (по времени отрезка, без ожидания ответа от нативной анимации)
    const halt = () => {
      const sg = seg.current;
      x.stopAnimation();
      y.stopAnimation();
      if (!sg) return;
      const k = sg.ease(Math.min(1, (Date.now() - sg.start) / sg.dur));
      seg.current = null;
      pos.current = sg.fx + (sg.tx - sg.fx) * k;
      posY.current = sg.fy + (sg.ty - sg.fy) * k;
      x.setValue(pos.current);
      y.setValue(posY.current);
    };
    if (paused || maxX <= minX || (reduce && !goalId && !steerN)) {
      halt();
      setMoving(false);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const walk = (target: number, targetY: number, pace: number, then: () => void, smooth = false) => {
      const from = pos.current;
      const fromY = posY.current;
      const distance = Math.hypot(target - from, (targetY - fromY) * 1.4);
      if (distance < 2) {
        then();
        return;
      }
      if (Math.abs(target - from) > 3) setDir(target >= from ? 1 : -1);
      setMoving(true);
      setZTop(targetY);
      const ease = smooth ? EASE : LINEAR;
      const duration = Math.max(smooth ? 420 : 250, (distance / pace) * 1000 * (smooth ? 1.18 : 1));
      seg.current = { fx: from, fy: fromY, tx: target, ty: targetY, start: Date.now(), dur: duration, ease };
      const t = (v: Animated.Value, toValue: number) => Animated.timing(v, { toValue, duration, easing: ease, useNativeDriver: nativeDriver });
      Animated.parallel([t(x, target), t(y, targetY)]).start(({ finished }) => {
        if (!finished || cancelled) return;
        seg.current = null;
        pos.current = target;
        posY.current = targetY;
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
      const targetY = deep ? lo + Math.random() * (hi - lo) : posY.current;
      walk(target, targetY, speed, () => {
        timer = setTimeout(step, 900 + Math.random() * 2600);
      });
    };
    const done = () => {
      reached.current = goalId;
      arrive.current?.(goalId);
      timer = setTimeout(step, 2500 + Math.random() * 2500);
    };
    const gy = goalY ?? posY.current;
    const st = steerRef.current;
    if (st && steerN) {
      // джойстик: далеко вперёд по направлению, до края полосы
      steered.current = true;
      const pace = speed * (st.run ? 2.6 : 1.5);
      const far = pace * 1.6;
      const tx = Math.min(maxX, Math.max(minX, pos.current + Math.cos(st.ang) * far));
      const ty = deep ? Math.min(hi, Math.max(lo, posY.current + (Math.sin(st.ang) * far) / 1.4)) : posY.current;
      walk(tx, ty, pace, () => undefined);
    } else if (goalId && reduce) {
      x.setValue(goalX);
      y.setValue(gy);
      pos.current = goalX;
      posY.current = gy;
      setZTop(gy);
      done();
    } else if (goalId) {
      walk(goalX, gy, speed * 1.8, done, true);
    } else {
      // после джойстика постоит подольше, потом снова гуляет сам
      timer = setTimeout(step, steered.current ? 5000 + Math.random() * 3000 : 500 + Math.random() * 1500);
      steered.current = false;
    }
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      halt();
    };
  }, [paused, reduce, minX, maxX, size, speed, x, y, goalId, goalX, goalY, deep, lo, hi, steerN]);

  const currentPose: ChibiPose = paused ? pose ?? 'idle' : moving ? (goalId || steer?.run ? 'run' : 'walk') : pose && pose !== 'idle' ? pose : 'idle';
  const flip = paused && face ? face === -1 : dir === -1;

  // дальше — меньше: рамка та же, чибик уменьшается к ногам
  const scale = deep ? y.interpolate({ inputRange: [lo, hi], outputRange: [0.86, 1.06], extrapolate: 'clamp' }) : 1;

  return (
    <Animated.View style={[styles.box, { top: 0, zIndex: Math.round(zTop), width: size, height, transform: [{ translateX: x }, { translateY: y }] }]} pointerEvents="box-none">
      <Animated.View style={{ width: size, height, transform: [{ translateY: height / 2 }, { scale }, { translateY: -height / 2 }] }}>
        <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={450} accessibilityRole="button" accessibilityLabel={label} style={{ width: size, height }}>
          <Chibi look={look} emotion={emotion} value={value} pose={currentPose} size={size} flip={flip} />
        </Pressable>
      </Animated.View>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', left: 0 },
});
