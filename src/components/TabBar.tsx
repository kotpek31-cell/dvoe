// Нижняя панель Б3 «Капсула с подписью»: каждая вкладка — отдельный стеклянный островок со значком,
// активный растягивается в капсулу «значок + название». Переход — мягкая пружина ~0,3 с;
// при «Уменьшить движение» капсула сразу появляется на месте.
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../lib/motion';
import { C, F } from '../theme';
import { Icon, type IconName } from './Icon';
import { Pressy } from './ui';

const TABS: Record<string, { label: string; icon: IconName }> = {
  home: { label: 'Главная', icon: 'home' },
  mood: { label: 'Настроение', icon: 'mood' },
  sleep: { label: 'Сон', icon: 'sleep' },
  us: { label: 'Мы', icon: 'us' },
  stats: { label: 'Итоги', icon: 'stats' },
  profile: { label: 'Профиль', icon: 'profile' },
};


function Tab({ label, icon, focused, onPress, size }: { label: string; icon: IconName; focused: boolean; onPress: () => void; size: number }) {
  const reduce = useReducedMotion();
  const v = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const [labelW, setLabelW] = useState(label.length * 7.6);

  useEffect(() => {
    if (reduce) {
      v.setValue(focused ? 1 : 0);
      return;
    }
    // ширина не умеет native driver — анимация на JS, всего шесть маленьких кнопок
    const a = Animated.spring(v, { toValue: focused ? 1 : 0, useNativeDriver: false, speed: 18, bounciness: 6 });
    a.start();
    return () => a.stop();
  }, [focused, reduce, v]);

  const width = v.interpolate({ inputRange: [0, 1], outputRange: [size, size + labelW + 10] });
  return (
    <Pressy
      onPress={onPress}
      scaleTo={0.9}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
    >
      <Animated.View
        style={[
          styles.island,
          focused ? styles.islandOn : null,
          {
            width,
            height: size,
            borderRadius: size / 2,
            backgroundColor: v.interpolate({ inputRange: [0, 1], outputRange: ['rgba(22,18,38,0.86)', 'rgba(70,30,52,0.94)'] }),
            borderColor: v.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.14)', 'rgba(255,107,138,0.55)'] }),
          },
        ]}
      >
        {/* значок чуть «подпрыгивает», когда вкладку выбрали */}
        <Animated.View
          style={{
            width: size - 2,
            height: size - 2,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.2, 1.06] }) }],
          }}
        >
          <Icon name={icon} size={22} color={focused ? '#FF9DB3' : 'rgba(255,255,255,0.66)'} strokeWidth={focused ? 2.3 : 2} />
        </Animated.View>
        <Animated.Text
          numberOfLines={1}
          onLayout={(e) => {
            const w = Math.ceil(e.nativeEvent.layout.width);
            if (w > 0 && Math.abs(w - labelW) > 1) setLabelW(w);
          }}
          style={[styles.label, { left: size - 6, opacity: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] }) }]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressy>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [keyboard, setKeyboard] = useState(false);
  // 5 островков + капсула («Настроение» ~ 80 px) должны влезть в ширину экрана
  const size = Math.max(36, Math.min(46, Math.floor((Math.min(width, 560) - 16 - 25 - 84) / 6)));

  // На Android клавиатура поднимает вкладки — прячем их, пока она открыта
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (keyboard) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) + 8 }]}>
      <View style={styles.row} accessibilityRole="tablist" pointerEvents="box-none">
        {state.routes.map((route, index) => {
          const meta = TABS[route.name];
          if (!meta) return null;
          const focused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return <Tab key={route.key} label={meta.label} icon={meta.icon} focused={focused} onPress={onPress} size={size} />;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 8, right: 8, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 560 },
  island: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    boxShadow: '0px 10px 24px rgba(8,4,20,0.35), inset 0px 1px 0px rgba(255,255,255,0.1)',
  },
  islandOn: { boxShadow: '0px 8px 22px rgba(255,107,138,0.3), inset 0px 1px 0px rgba(255,255,255,0.22)' },
  label: { position: 'absolute', fontFamily: F.heavy, fontSize: 13, color: C.text },
});
