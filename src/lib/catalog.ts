// Каталог вещей. Рисунки — данные из таблицы items: новые вещи появляются без обновления приложения.
// Порядок: встроенный стартовый каталог → кэш на телефоне → свежий из базы (раз в минуту, не чаще).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { STARTER_ITEMS } from './catalogStarter';
import { supabase } from './supabase';

export type ItemCat = 'hair' | 'eyes' | 'hat' | 'face' | 'top' | 'bottom' | 'shoes' | 'back' | 'hand' | 'ability';

export type ItemMeta = {
  sleeve?: 'full' | 'short'; // рукава верха
  sleeveColor?: string; // ключ цвета рукава, если он не цвета вещи
  cuff?: string; // цвет манжет
  coversBottom?: boolean; // платье закрывает «Низ»
  hover?: boolean; // крылья: чибик парит
  style?: string; // стиль глаз (рисует движок лица)
  [key: string]: unknown;
};

export type ItemRow = {
  id: string;
  cat: ItemCat;
  name: string;
  rarity: number;
  source: 'free' | 'code' | 'shop' | 'dev';
  palette: 'cloth' | 'hair' | null;
  def_color: string | null;
  sort: number;
  // Слои рисунка: SVG-строки в координатах чибика 120×170 с токенами цвета (см. art.tsx)
  art: { layers?: Record<string, string> };
  meta: ItemMeta;
  updated_at?: string;
};

export type Catalog = ReadonlyMap<string, ItemRow>;

const CACHE_KEY = 'dvoe:catalog-v1';
const COLUMNS = 'id, cat, name, rarity, source, palette, def_color, sort, art, meta, updated_at';

function isRow(r: unknown): r is ItemRow {
  const o = r as ItemRow | null;
  return Boolean(o && typeof o.id === 'string' && typeof o.cat === 'string' && typeof o.name === 'string' && o.art && typeof o.art === 'object' && o.meta && typeof o.meta === 'object');
}

let current: Catalog = new Map(STARTER_ITEMS.map((r) => [r.id, r]));
const listeners = new Set<() => void>();

function merge(rows: unknown[]) {
  const next = new Map(current);
  let changed = false;
  rows.forEach((r) => {
    if (!isRow(r)) return;
    const old = next.get(r.id);
    if (old && old.updated_at && old.updated_at === r.updated_at) return;
    next.set(r.id, r);
    changed = true;
  });
  if (!changed) return;
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = () => current;

export function useCatalog(): Catalog {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function getCatalog(): Catalog {
  return current;
}

let restored = false;
async function restore() {
  if (restored) return;
  restored = true;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const rows: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(rows)) merge(rows);
  } catch {
    // кэш испорчен — останется встроенный каталог
  }
}

let running: Promise<void> | null = null;
let lastSync = 0;

// Скачать свежий каталог. Без входа или на старой базе тихо остаётся то, что есть.
export function syncCatalog(force = false): Promise<void> {
  if (running) return running;
  if (!force && Date.now() - lastSync < 60_000) return restore();
  running = (async () => {
    try {
      await restore();
      const { data, error } = await supabase.from('items').select(COLUMNS);
      if (error || !Array.isArray(data)) return;
      lastSync = Date.now();
      merge(data);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      // нет сети — попробуем в следующий раз
    } finally {
      running = null;
    }
  })();
  return running;
}

// Встретили вещь, которой нет в каталоге (партнёр надел новинку) — подтянуть каталог
export function requestItem(id: string) {
  if (!current.has(id)) syncCatalog().catch(() => undefined);
}
