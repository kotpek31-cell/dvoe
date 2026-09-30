// Ползунок эмоции: бегунок — это лицо, которое меняется по мере движения (0 → 100).
// Горизонтальный жест забирает ползунок, вертикальный остаётся прокрутке страницы;
// простое касание дорожки ставит значение в эту точку.
import { memo, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { intensityWord, type Emotion } from '../lib/emotions';
import { haptic, nativeDriver } from '../lib/motion';
import { C } from '../theme';
import { Face } from './Face';
import { Txt } from './ui';

const THUMB = 44;

type Props = { emotion: Emotion; value: number; onChange: (key: Emotion['key'], value: number) => void };

function EmotionSliderView({ emotion, value, onChange }: Props) {
  const track = useRef<View>(null);
  const layout = useRef({ x: 0, width: 0 });
  const [width, setWidth] = useState(0);
  const grow = useRef(new Animated.Value(0)).current;
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const bucket = useRef(Math.ceil(value / 20));

  const measure = () =>
    track.current?.measureInWindow((x, _y, w) => {
      layout.current = { x, width: w };
    });

  const valueAt = (pageX: number) => {
    const { x, width: w } = layout.current;
    const usable = Math.max(1, w - THUMB);
    return Math.round(Math.min(100, Math.max(0, ((pageX - x - THUMB / 2) / usable) * 100)));
  };

  const set = (v: number) => {
    if (v === valueRef.current) return;
    onChangeRef.current(emotion.key, v);
    const b = Math.ceil(v / 20); // лёгкий «щелчок» на границах: едва → слегка → заметно…
    if (b !== bucket.current) {
      bucket.current = b;
      haptic.tap();
    }
  };

  const spring = (to: number) => Animated.spring(grow, { toValue: to, useNativeDriver: nativeDriver, speed: 22, bounciness: 9 }).start();

  const responder = useMemo(() => {
    let startX = 0;
    let active = false;
    const end = () => {
      active = false;
      spring(0);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => !active,
      onPanResponderGrant: (e) => {
        startX = e.nativeEvent.pageX;
        active = false;
        measure();
      },
      onPanResponderMove: (e, g) => {
        if (!active) {
          if (Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy)) {
            active = true;
            spring(1);
          } else return;
        }
        set(valueAt(e.nativeEvent.pageX));
      },
      onPanResponderRelease: (_e, g) => {
        if (!active && Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) set(valueAt(startX));
        end();
      },
      onPanResponderTerminate: end,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usable = Math.max(0, width - THUMB);
  const left = (value / 100) * usable;
  const word = intensityWord(value);

  return (
    <View style={styles.row}>
      <View style={styles.labels}>
        <Txt weight="bold" size={15} numberOfLines={1}>
          {emotion.label}
        </Txt>
        <Txt weight="heavy" size={12} color={value > 0 ? emotion.color : C.faint}>
          {word}
        </Txt>
      </View>
      <View
        ref={track}
        style={[styles.track, Platform.OS === 'web' ? ({ touchAction: 'pan-y', cursor: 'pointer' } as ViewStyle) : null]}
        onLayout={(e) => {
          setWidth(e.nativeEvent.layout.width);
          measure();
        }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={emotion.label}
        accessibilityValue={{ min: 0, max: 100, now: value, text: word }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') set(Math.min(100, value + 10));
          if (e.nativeEvent.actionName === 'decrement') set(Math.max(0, value - 10));
        }}
        {...responder.panHandlers}
      >
        <View style={styles.rail} />
        <View style={[styles.fill, { width: left, backgroundColor: emotion.color }]} />
        <Animated.View
          style={[
            styles.thumb,
            { transform: [{ translateX: left }, { scale: grow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] }) }] },
          ]}
        >
          <Face emotion={emotion.key} value={value} size={THUMB - 4} />
        </Animated.View>
      </View>
    </View>
  );
}

export const EmotionSlider = memo(EmotionSliderView);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 54 },
  labels: { width: 108 },
  track: { flex: 1, height: THUMB, justifyContent: 'center' },
  rail: {
    position: 'absolute',
    left: THUMB / 2,
    right: THUMB / 2,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  fill: { position: 'absolute', left: THUMB / 2, height: 8, borderRadius: 4, opacity: 0.85 },
  thumb: { position: 'absolute', left: 2, top: 2, width: THUMB - 4, height: THUMB - 4 },
});
