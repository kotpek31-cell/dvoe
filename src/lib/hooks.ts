import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { errorMessage } from './env';

// Загружает данные экрана: при изменении зависимостей, при возврате на экран
// и по «потянуть вниз». Старые ответы, пришедшие позже новых, игнорируются.
export function useLoader<T>(loader: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const seq = useRef(0);
  const focusedOnce = useRef(false);

  const run = useCallback(async (pullToRefresh: boolean) => {
    const id = ++seq.current;
    if (pullToRefresh) setRefreshing(true);
    try {
      const result = await loaderRef.current();
      if (id === seq.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (id === seq.current) setError(errorMessage(e));
    } finally {
      if (id === seq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      run(false);
    }, [run]),
  );

  return {
    data,
    setData,
    loading,
    refreshing,
    error,
    reload: useCallback(() => run(false), [run]),
    refresh: useCallback(() => run(true), [run]),
  };
}
