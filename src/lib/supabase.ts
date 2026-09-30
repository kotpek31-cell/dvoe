import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

// Значения берутся из файла .env (EXPO_PUBLIC_* встраиваются при сборке)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured =
  /^https:\/\/.+/.test(SUPABASE_URL) && !SUPABASE_URL.includes('your-project-ref') && SUPABASE_KEY.length > 20;

export const supabase = createClient(
  isSupabaseConfigured ? SUPABASE_URL : 'https://not-configured.supabase.co',
  isSupabaseConfigured ? SUPABASE_KEY : 'not-configured-publishable-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Обновлять токен сессии, только пока приложение на экране (рекомендация Supabase для RN)
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
