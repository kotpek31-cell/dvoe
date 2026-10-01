// Роль в комнате разработчиков: спрашиваем сервер один раз за вход (и по просьбе — refreshAccess).
// Это только чтобы показать плитку и пустить на экран; каждая функция комнаты всё равно проверяет роль на сервере.
import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '../context/AuthProvider';
import { fetchMyAccess, type Access } from './api';

let state: { user: string | null; access: Access } = { user: null, access: null };
const listeners = new Set<() => void>();
let loading: string | null = null;

function load(user: string) {
  if (loading === user) return;
  loading = user;
  fetchMyAccess()
    .then((access) => {
      state = { user, access };
      listeners.forEach((l) => l());
    })
    .finally(() => {
      loading = null;
    });
}

export function refreshAccess(user: string) {
  load(user);
}

export function useAccess(): Access {
  const { userId } = useAuth();
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
  useEffect(() => {
    if (userId && state.user !== userId) load(userId);
  }, [userId]);
  return userId && snap.user === userId ? snap.access : null;
}
