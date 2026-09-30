// Данные для виджета на главном экране: лицо настроения партнёра, статус сна и оценка дня.
// Android-виджет обновляется сам (каждые 30 минут) и когда приложение что-то меняет.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatTime, todayKey } from './dates';
import { entryMix, getEmotion, mixDominant, mixSummary } from './emotions';
import type { FaceKey } from './face';
import { formatScore } from './score';
import { supabase } from './supabase';
import { pushSnapshotToWidgets } from './widgetBridge';

export type PartnerSnapshot = {
  state: 'ok' | 'no_partner' | 'signed_out';
  name: string;
  faceKey: FaceKey;
  faceValue: number;
  moodLabel: string;
  moodDetail: string;
  rating: string;
  updatedAt: string;
  // для iOS-виджета (expo-widgets) — там нет рисования SVG
  avatar: string;
  emoji: string;
};

type SnapshotRow = {
  name: string;
  avatar: string;
  sleeping_since: string | null;
  mood: { emotion: string; sub_emotion: string | null; intensity: number; created_at: string; emotions?: unknown } | null;
  rating: number | null;
  auto_score: number | null;
};

const CACHE_KEY = 'dvoe:widget-snapshot-0.1';

export function placeholderSnapshot(state: PartnerSnapshot['state']): PartnerSnapshot {
  return {
    state,
    name: state === 'signed_out' ? 'Двое' : 'Партнёр',
    faceKey: 'love',
    faceValue: 40,
    moodLabel: state === 'signed_out' ? 'Войди в приложение' : 'Ждём партнёра',
    moodDetail: state === 'signed_out' ? 'чтобы видеть настроение пары' : 'поделись кодом пары',
    rating: '—',
    updatedAt: formatTime(new Date()),
    avatar: '💞',
    emoji: '🫶',
  };
}

function mapRow(row: SnapshotRow): PartnerSnapshot {
  const now = formatTime(new Date());
  const rating = row.rating != null ? `${row.rating}/10` : row.auto_score != null ? `авто ${formatScore(row.auto_score)}` : '—';
  if (row.sleeping_since) {
    return {
      state: 'ok',
      name: row.name,
      faceKey: 'sleep',
      faceValue: 100,
      moodLabel: 'Спит',
      moodDetail: `с ${formatTime(row.sleeping_since)}`,
      rating,
      updatedAt: now,
      avatar: row.avatar,
      emoji: '😴',
    };
  }
  const mix = row.mood ? entryMix(row.mood) : {};
  const top = mixDominant(mix);
  return {
    state: 'ok',
    name: row.name,
    faceKey: top?.key ?? 'calm',
    faceValue: top?.value ?? 0,
    moodLabel: top ? mixSummary(mix) : 'Ещё не отмечено',
    moodDetail: row.mood ? [formatTime(row.mood.created_at), row.mood.sub_emotion].filter(Boolean).join(' · ') : 'настроение за сегодня',
    rating,
    updatedAt: now,
    avatar: row.avatar,
    emoji: top ? getEmotion(top.key).emoji : '🤍',
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
