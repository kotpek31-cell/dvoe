// Титр нового места на главной: сменили локацию (ты или партнёр) — по центру проявляется название и строка настроения.
// Уходит по таймеру, а не по концу анимации (надписи-вспышки обязаны исчезнуть).
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LOCATION_LINE, locationName, type LocationId } from '../../lib/locations';
import { nativeDriver, useReducedMotion } from '../../lib/motion';
import { C } from '../../theme';
import { Icon } from '../Icon';
import { Txt } from '../ui';

const HOLD = 2600;

export function PlaceTitle({ id, nonce, top }: { id: LocationId; nonce: number; top: number }) {
  const reduce = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!nonce) return;
    setShown(true);
    v.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: reduce ? 200 : 620, delay: reduce ? 0 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }),
      Animated.delay(HOLD - 1300),
      Animated.timing(v, { toValue: 2, duration: reduce ? 200 : 520, easing: Easing.in(Easing.quad), useNativeDriver: nativeDriver }),
    ]);
    anim.start();
    const t = setTimeout(() => setShown(false), HOLD + 200);
    return () => {
      anim.stop();
      clearTimeout(t);
    };
  }, [nonce, reduce, v]);

  if (!shown) return null;
  const opacity = v.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] });
  const rise = reduce ? 0 : v.interpolate({ inputRange: [0, 1, 2], outputRange: [16, 0, -10] });
  const spread = v.interpolate({ inputRange: [0, 1, 2], outputRange: [0.2, 1, 1.15] });
  return (
    <View pointerEvents="none" style={[styles.wrap, { top }]} accessibilityLiveRegion="polite">
      <Animated.View style={[styles.box, { opacity, transform: [{ translateY: rise }] }]}>
        <View style={styles.row}>
          <Animated.View style={[styles.line, { transform: [{ scaleX: spread }] }]} />
          <View style={styles.pin}>
            <Icon name="pin" size={14} color={C.onAccent} strokeWidth={2.4} />
          </View>
          <Animated.View style={[styles.line, { transform: [{ scaleX: spread }] }]} />
        </View>
        <Txt weight="display" size={26} center numberOfLines={2} style={styles.name}>
          {locationName(id)}
        </Txt>
        <Txt weight="bold" size={14} center color="rgba(255,255,255,0.88)" style={styles.shadow}>
          {LOCATION_LINE[id]}
        </Txt>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 24, right: 24, alignItems: 'center', zIndex: 10 },
  box: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 26,
    backgroundColor: 'rgba(16,12,30,0.56)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderTopColor: 'rgba(255,255,255,0.3)',
    boxShadow: '0px 12px 34px rgba(4,2,14,0.35)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { width: 46, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.7)' },
  pin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 0px 16px rgba(255,107,138,0.7)',
  },
  name: { textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 } },
  shadow: { textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
});
