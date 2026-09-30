// Плавающие стеклянные вкладки внизу экрана
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R } from '../theme';
import { Icon, type IconName } from './Icon';
import { Pressy, Txt } from './ui';

const TABS: Record<string, { label: string; icon: IconName }> = {
  home: { label: 'Главная', icon: 'home' },
  mood: { label: 'Настроение', icon: 'mood' },
  sleep: { label: 'Сон', icon: 'sleep' },
  us: { label: 'Мы', icon: 'us' },
  stats: { label: 'Итоги', icon: 'stats' },
  profile: { label: 'Профиль', icon: 'profile' },
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);

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
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) + 6 }]}>
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const meta = TABS[route.name];
          if (!meta) return null;
          const focused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressy
              key={route.key}
              onPress={onPress}
              scaleTo={0.88}
              style={styles.item}
              innerStyle={styles.itemInner}
              accessibilityRole="tab"
              accessibilityLabel={meta.label}
              accessibilityState={{ selected: focused }}
            >
              <View style={[styles.pill, focused ? styles.pillActive : null]}>
                <Icon name={meta.icon} size={23} color={focused ? '#FF8FA8' : 'rgba(255,255,255,0.62)'} strokeWidth={focused ? 2.3 : 2} />
              </View>
              <Txt weight="heavy" size={10.5} color={focused ? C.text : 'rgba(255,255,255,0.62)'} numberOfLines={1}>
                {meta.label}
              </Txt>
            </Pressy>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  bar: {
    width: '100%',
    maxWidth: 520,
    height: 68,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 4,
    borderRadius: R.xl,
    backgroundColor: 'rgba(22,18,38,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    boxShadow: '0px 12px 30px rgba(8,4,20,0.35)',
  },
  item: { flex: 1 },
  itemInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pill: { width: 46, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: 'rgba(255,107,138,0.2)' },
});
