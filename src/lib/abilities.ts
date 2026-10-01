// Способности: как они выглядят в интерфейсе и как долго идёт сцена.
// Правила (перезарядка, можно ли применить) — на сервере, в cast_ability; здесь только показ.
import type { IconName } from '../components/Icon';
import { C } from '../theme';
import type { Catalog } from './catalog';

export type AbilityInfo = {
  icon: IconName;
  color: string;
  sub: string; // подпись в гардеробе и панели смены
  sceneMs: number;
  banner: (name: string) => string; // плашка у партнёра на другом экране
};

export const ABILITIES: Record<string, AbilityInfo> = {
  'ability.hug': { icon: 'heart', color: C.partner, sub: 'обнять партнёра', sceneMs: 4000, banner: (n) => `${n} обнимает тебя` },
  'ability.mog': { icon: 'flame', color: C.warn, sub: 'раз в 10 минут', sceneMs: 7000, banner: (n) => `${n} применяет «Мог»` },
};

const FALLBACK: AbilityInfo = { icon: 'sparkle', color: C.accent, sub: 'способность', sceneMs: 4000, banner: (n) => `${n} применяет способность` };

export const abilityInfo = (id: string): AbilityInfo => ABILITIES[id] ?? FALLBACK;

// Перезарядка из каталога (meta.cooldown_s), как на сервере
export function cooldownMs(id: string, catalog: Catalog): number {
  const s = Number(catalog.get(id)?.meta.cooldown_s);
  return (Number.isFinite(s) && s > 0 ? s : 10) * 1000;
}

// «9 мин», «45 с»
export function leftLabel(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return s >= 60 ? `${Math.ceil(s / 60)} мин` : `${s} с`;
}
