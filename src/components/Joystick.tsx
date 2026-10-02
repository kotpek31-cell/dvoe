// Маленький джойстик (этап фиксации 0.2): ведёшь пальцем — чибик идёт в ту сторону, дальше от центра — бежит.
// Сам ничего не двигает: сообщает направление (угол, сила 0…1) и «отпустил». Рисуется стеклом, как остальные кнопки.
import { useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { haptic } from '../lib/motion';

type Props = {
  size?: number;
  onSteer: (angle: number, power: number) => void; // угол в радианах (0 — вправо, π/2 — к себе), сила 0…1
  onRelease: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

const DEAD = 0.18; // мёртвая зона в центре

export function Joystick({ size = 104, onSteer, onRelease, style, disabled }: Props) {
  const knob = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const r = size / 2;
  const knobR = Math.round(size * 0.22);
  const cb = useRef({ onSteer, onRelease, disabled });
  cb.current = { onSteer, onRelease, disabled };
  const live = useRef(false);
  const start = useRef({ x: 0, y: 0 }); // где палец лёг (мог лечь не в центр)

  const responder = useMemo(() => {
    const place = (dx: number, dy: number) => {
      const max = r - knobR * 0.6;
      const d = Math.hypot(dx, dy);
      const k = d > max ? max / d : 1;
      knob.setValue({ x: dx * k, y: dy * k });
      const power = Math.min(1, d / max);
      if (power < DEAD) {
        if (live.current) {
          live.current = false;
          cb.current.onRelease();
        }
        return;
      }
      live.current = true;
      cb.current.onSteer(Math.atan2(dy, dx), (power - DEAD) / (1 - DEAD));
    };
    const end = () => {
      Animated.spring(knob, { toValue: { x: 0, y: 0 }, useNativeDriver: false, speed: 28, bounciness: 6 }).start();
      if (live.current) {
        live.current = false;
        cb.current.onRelease();
      }
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !cb.current.disabled,
      onMoveShouldSetPanResponder: () => !cb.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        haptic.tap();
        knob.stopAnimation();
        start.current = { x: e.nativeEvent.locationX - r, y: e.nativeEvent.locationY - r };
        place(start.current.x, start.current.y);
      },
      onPanResponderMove: (_e, g) => {
        place(start.current.x + g.dx, start.current.y + g.dy);
      },
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    });
  }, [r, knobR, knob]);

  return (
    <View
      style={[styles.base, { width: size, height: size, borderRadius: r, opacity: disabled ? 0.4 : 1 }, style]}
      {...responder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel="Джойстик: веди пальцем — чибик идёт, дальше от центра — бежит"
    >
      <View pointerEvents="none" style={[styles.ring, { width: size * 0.62, height: size * 0.62, borderRadius: size * 0.31 }]} />
      <Animated.View
        pointerEvents="none"
        style={[styles.knob, { width: knobR * 2, height: knobR * 2, borderRadius: knobR, transform: knob.getTranslateTransform() }]}
      >
        <View style={[styles.knobShine, { width: knobR * 0.9, height: knobR * 0.5, borderRadius: knobR * 0.25 }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24,18,40,0.42)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  knob: {
    alignItems: 'center',
    paddingTop: 5,
    backgroundColor: 'rgba(246,243,255,0.88)',
    borderWidth: 2,
    borderColor: '#2B2035',
    boxShadow: '0px 4px 10px rgba(10,6,24,0.35)',
  },
  knobShine: { backgroundColor: '#FFFFFF', opacity: 0.7 },
});
