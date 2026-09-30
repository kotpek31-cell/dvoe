// «Уменьшить движение» из настроек системы и короткие тактильные отклики.
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

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
};
