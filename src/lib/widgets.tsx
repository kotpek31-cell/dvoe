// Данные для виджетов на главном экране: настроение и оценка дня партнёра.
// Android-виджет обновляется сам (каждые 30 минут) и когда приложение что-то меняет.
// iOS-виджет (expo-widgets) не умеет ходить в сеть — данные ему передаёт приложение.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatTime, todayKey } from './dates';
import { getEmotion, INTENSITY_LABELS } from './emotions';
import { formatScore } from './score';
import { supabase } from './supabase';
import { pushSnapshotToWidgets } from './widgetBridge';

export type PartnerSnapshot = {
  state: 'ok' | 'no_partner' | 'signed_out';
  name: string;
  avatar: string;
  emoji: string;
  moodLabel: string;
  moodDetail: string;
  rating: string;
  updatedAt: string;
};

type SnapshotRow = {
  name: string;
  avatar: string;
  sleeping_since: string | null;
  mood: { emotion: string; sub_emotion: string | null; intensity: number; created_at: string } | null;
  rating: number | null;
  auto_score: number | null;
};

const CACHE_KEY = 'dvoe:widget-snapshot';

export function placeholderSnapshot(state: PartnerSnapshot['state']): PartnerSnapshot {
  return {
    state,
    name: state === 'signed_out' ? 'Двое' : 'Партнёр',
    avatar: '💞',
    emoji: '🫶',
    moodLabel: state === 'signed_out' ? 'Войдите в приложение' : 'Ждём партнёра',
    moodDetail: state === 'signed_out' ? 'чтобы видеть настроение пары' : 'поделитесь кодом пары',
    rating: '—',
    updatedAt: formatTime(new Date()),
  };
}

function mapRow(row: SnapshotRow): PartnerSnapshot {
  const now = formatTime(new Date());
  if (row.sleeping_since) {
    return {
      state: 'ok',
      name: row.name,
      avatar: row.avatar,
      emoji: '😴',
      moodLabel: 'Спит',
      moodDetail: `с ${formatTime(row.sleeping_since)}`,
      rating: row.rating != null ? `${row.rating}/10` : '—',
      updatedAt: now,
    };
  }
  const mood = row.mood;
  const emotion = mood ? getEmotion(mood.emotion) : null;
  return {
    state: 'ok',
    name: row.name,
    avatar: row.avatar,
    emoji: emotion ? emotion.emoji : '🤍',
    moodLabel: emotion ? emotion.label : 'Ещё не отмечено',
    moodDetail: mood
      ? [mood.sub_emotion, INTENSITY_LABELS[mood.intensity], formatTime(mood.created_at)].filter(Boolean).join(' · ')
      : 'настроение за сегодня',
    rating: row.rating != null ? `${row.rating}/10` : row.auto_score != null ? `авто ${formatScore(row.auto_score)}` : '—',
    updatedAt: now,
  };
}

export async function loadPartnerSnapshot(): Promise<PartnerSnapshot> {
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) return placeholderSnapshot('signed_out');
  const { data, error } = await supabase.rpc('partner_snapshot', { p_day: todayKey() });
  if (error) throw new Error(error.message);
  if (!data) return placeholderSnapshot('no_partner');
  return mapRow(data as SnapshotRow);
}

export async function readCachedSnapshot(): Promise<PartnerSnapshot> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw) as PartnerSnapshot;
  } catch {
    // кэш повреждён — вернём заглушку
  }
  return placeholderSnapshot('signed_out');
}

export async function saveCachedSnapshot(snapshot: PartnerSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // не критично
  }
}

// Свежий снимок из сети, а если сети нет — последний сохранённый
export async function loadSnapshotWithFallback(timeoutMs = 8000): Promise<PartnerSnapshot> {
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs));
    const snapshot = await Promise.race([loadPartnerSnapshot(), timeout]);
    await saveCachedSnapshot(snapshot);
    return snapshot;
  } catch {
    return readCachedSnapshot();
  }
}

export async function refreshWidgets(): Promise<void> {
  try {
    const snapshot = await loadSnapshotWithFallback();
    await pushSnapshotToWidgets(snapshot);
  } catch (error) {
    console.warn('[widget] не удалось обновить виджет', error);
  }
}
