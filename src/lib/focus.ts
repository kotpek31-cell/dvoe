import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

// true, пока экран виден (вкладки не размонтируются — анимации на скрытых экранах останавливаем)
export function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}
