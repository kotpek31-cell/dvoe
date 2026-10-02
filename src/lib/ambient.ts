// Фоновый звук места на главной: играет, пока главная на экране и приложение открыто.
import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { LocationId } from './locations';
import { playAmbient } from './sound';

export function useAmbient(id: LocationId, active: boolean) {
  useEffect(() => {
    playAmbient(active && AppState.currentState !== 'background' ? id : null);
    const sub = AppState.addEventListener('change', (state) => playAmbient(active && state === 'active' ? id : null));
    return () => {
      sub.remove();
      playAmbient(null);
    };
  }, [id, active]);
}
