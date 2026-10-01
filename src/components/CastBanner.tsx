// Плашка сверху на любом экране, кроме главной: «{имя} применяет «Мог»» → «Смотреть» переносит на главную
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAbility } from '../context/AbilityProvider';
import { useAuth } from '../context/AuthProvider';
import { usePair } from '../context/PairProvider';
import { abilityInfo } from '../lib/abilities';
import { nativeDriver, useReducedMotion } from '../lib/motion';
import { C, R } from '../theme';
import { Icon } from './Icon';
import { IconButton, Pressy, Txt } from './ui';

export function CastBanner() {
  const { userId } = useAuth();
  const { partner } = usePair();
  const { scene, homeVisible, dismissScene } = useAbility();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const y = useRef(new Animated.Value(0)).current;
  const show = Boolean(userId && scene && scene.from === 'partner' && !homeVisible);

  useEffect(() => {
    if (!show) return;
    y.setValue(reduce ? 1 : 0);
    if (!reduce) Animated.spring(y, { toValue: 1, useNativeDriver: nativeDriver, speed: 14, bounciness: 6 }).start();
  }, [show, scene?.key, reduce, y]);

  if (!show || !scene) return null;
  const info = abilityInfo(scene.ability);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { top: insets.top + 8, opacity: y, transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }] },
      ]}
    >
      <View style={styles.card} accessibilityRole="alert">
        <View style={[styles.icon, { backgroundColor: `${info.color}33` }]}>
          <Icon name={info.icon} size={20} color={info.color} fill={info.color} strokeWidth={1.6} />
        </View>
        <Txt weight="heavy" size={14} style={styles.flex} numberOfLines={2}>
          {info.banner(partner?.display_name ?? 'Партнёр')}
        </Txt>
        <Pressy onPress={() => router.navigate('/home')} innerStyle={styles.watch} accessibilityLabel="Смотреть на главной">
          <Txt weight="heavy" size={13} color={C.onAccent}>
            Смотреть
          </Txt>
        </Pressy>
        <IconButton icon="close" label="Не смотреть" size={34} tint="transparent" onPress={dismissScene} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center', zIndex: 50 },
  flex: { flex: 1 },
  card: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 4,
    borderRadius: R.lg,
    backgroundColor: 'rgba(28,23,48,0.96)',
    borderWidth: 1,
    borderColor: C.glassBorder,
    boxShadow: '0px 12px 30px rgba(8,4,20,0.45)',
  },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  watch: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: C.accent, justifyContent: 'center' },
});
