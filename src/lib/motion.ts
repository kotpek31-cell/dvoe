// «Уменьшить движение» из настроек системы и короткие тактильные отклики.
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

// В браузере native driver нет. Если его всё же попросить, Animated.loop из одной анимации
// проигрывается там ровно один раз (шаги чибика, облака, звёзды замирали) — поэтому в вебе выключаем.
export const nativeDriver = Platform.OS !== 'web';

let reduceMotion = false;
const listeners = new Set<(value: boolean) => void>();

function setReduceMotion(value: boolean) {
  reduceMotion = value;
  listeners.forEach((listener) => listener(value));
}

AccessibilityInfo.isReduceMotionEnabled()
  .then(setReduceMotion)
  .catch(() => undefined);
AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

// true — пользователь попросил меньше анимаций: оставляем только короткие переходы
export function useReducedMotion(): boolean {
  const [value, setValue] = useState(reduceMotion);
  useEffect(() => {
    listeners.add(setValue);
    setValue(reduceMotion);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}

export const haptic = {
  tap: () => {
    Haptics.selectionAsync().catch(() => undefined);
  },
  light: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  medium: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  },
  success: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
  warning: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  },
};
