import { useNavigation } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';

type FocusNavigation = {
  isFocused(): boolean;
  addListener(type: 'focus' | 'blur', callback: () => void): () => void;
};

// true, пока экран виден. Вкладки не размонтируются: на скрытых экранах
// останавливаем анимации, а в браузере ещё и прячем сам экран.
export function useScreenFocused(): boolean {
  const navigation = useNavigation() as unknown as FocusNavigation;
  const subscribe = useCallback(
    (onChange: () => void) => {
      const offFocus = navigation.addListener('focus', onChange);
      const offBlur = navigation.addListener('blur', onChange);
      return () => {
        offFocus();
        offBlur();
      };
    },
    [navigation],
  );
  return useSyncExternalStore(subscribe, navigation.isFocused, navigation.isFocused);
}
