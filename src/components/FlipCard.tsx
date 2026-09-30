// Карточка-перевёртыш: когда ответили оба, вопрос дня переворачивается и открывает ответы
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { nativeDriver, useReducedMotion } from '../lib/motion';

export function FlipCard({ flipped, front, back }: { flipped: boolean; front: ReactNode; back: ReactNode }) {
  const reduce = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  const [heights, setHeights] = useState({ front: 0, back: 0 });

  useEffect(() => {
    if (reduce) v.setValue(flipped ? 1 : 0);
    else Animated.spring(v, { toValue: flipped ? 1 : 0, useNativeDriver: nativeDriver, speed: 7, bounciness: 5 }).start();
  }, [flipped, reduce, v]);

  const height = flipped ? heights.back : heights.front;
  const side = (isBack: boolean) => ({
    opacity: v.interpolate({
      inputRange: [0, 0.49, 0.5, 1],
      outputRange: isBack ? [0, 0, 1, 1] : [1, 1, 0, 0],
    }),
    transform: [
      { perspective: 1200 },
      { rotateY: v.interpolate({ inputRange: [0, 1], outputRange: isBack ? ['-180deg', '0deg'] : ['0deg', '180deg'] }) },
    ],
  });

  return (
    <View style={{ height: height || undefined }}>
      <Animated.View
        pointerEvents={flipped ? 'none' : 'auto'}
        style={[styles.face, side(false)]}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          setHeights((prev) => (prev.front === h ? prev : { ...prev, front: h }));
        }}
      >
        {front}
      </Animated.View>
      <Animated.View
        pointerEvents={flipped ? 'auto' : 'none'}
        style={[styles.face, side(true)]}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          setHeights((prev) => (prev.back === h ? prev : { ...prev, back: h }));
        }}
      >
        {back}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  face: { position: 'absolute', left: 0, right: 0, top: 0, backfaceVisibility: 'hidden' },
});
