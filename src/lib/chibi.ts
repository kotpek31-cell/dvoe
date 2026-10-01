// Образ чибика 2.0: основа (вид и тон кожи) + надетые вещи из каталога.
// В профиле хранится profiles.chibi = {"kind", "v": 2, "skin", "hair": {"id", "c"}, …}.
// Старый формат {"kind"} (0.1.1) превращается в похожий образ из бесплатных вещей.
import type { ChibiKind, ChibiLook } from '../types';
import { getCatalog, requestItem, type Catalog, type ItemCat, type ItemRow } from './catalog';
import { CLOTH, HAIR, SKIN } from './palette';

export type Slot = { id: string; c?: string };
export type WearCat = Exclude<ItemCat, 'ability'>;

// Порядок категорий в гардеробе
export const WEAR_CATS: WearCat[] = ['hair', 'eyes', 'hat', 'face', 'top', 'bottom', 'shoes', 'back', 'hand'];

export type Look = {
  kind: ChibiKind;
  skin: number; // 0…4
  hair: Slot | null;
  eyes: Slot;
  top: Slot;
  shoes: Slot | null;
  hat?: Slot | null;
  face?: Slot | null;
  bottom?: Slot | null;
  back?: Slot | null;
  hand?: Slot | null;
  ability?: string;
};

// Без них чибика не нарисовать: тело — это «Верх», лицо — «Глаза»
const REQUIRED = new Set<WearCat>(['eyes', 'top']);

// Образы по умолчанию; ими же становятся чибики, выбранные в 0.1.1
export const LOOKS: Record<ChibiKind, Look> = {
  boy: { kind: 'boy', skin: 1, hair: { id: 'hair.vikhor' }, eyes: { id: 'eyes.classic' }, top: { id: 'top.hoodie' }, bottom: { id: 'bottom.pants' }, shoes: { id: 'shoes.kedy' } },
  girl: { kind: 'girl', skin: 1, hair: { id: 'hair.long' }, eyes: { id: 'eyes.lashes' }, hat: { id: 'hat.bow' }, top: { id: 'top.dress' }, shoes: { id: 'shoes.sapozhki', c: 'coal' } },
  nb: { kind: 'nb', skin: 1, hair: { id: 'hair.fluffy' }, eyes: { id: 'eyes.classic' }, top: { id: 'top.hoodie', c: 'mint' }, bottom: { id: 'bottom.pants' }, shoes: { id: 'shoes.kedy' } },
};

export const CHIBI_LABELS: Record<ChibiKind, string> = {
  boy: 'Мальчик',
  girl: 'Девочка',
  nb: 'Небинарный',
};

export const CHIBI_KINDS: ChibiKind[] = ['boy', 'girl', 'nb'];

type ProfileLike = { chibi?: unknown } | null | undefined;

const rawOf = (profile: ProfileLike): Record<string, unknown> | null => {
  const c = profile?.chibi;
  return c && typeof c === 'object' && !Array.isArray(c) ? (c as Record<string, unknown>) : null;
};

export function chibiKindOf(profile: ProfileLike): ChibiKind {
  const kind = rawOf(profile)?.kind;
  return kind === 'boy' || kind === 'girl' || kind === 'nb' ? kind : 'nb';
}

export function hasChosenChibi(profile: ProfileLike): boolean {
  const kind = rawOf(profile)?.kind;
  return kind === 'boy' || kind === 'girl' || kind === 'nb';
}

function slotOf(v: unknown): Slot | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as { id?: unknown; c?: unknown };
  if (typeof o.id !== 'string') return null;
  return typeof o.c === 'string' ? { id: o.id, c: o.c } : { id: o.id };
}

const looks = new WeakMap<object, Look>();

// Образ человека из профиля. Один и тот же profiles.chibi даёт один и тот же объект,
// поэтому чибик не перерисовывает вещи без надобности.
export function lookOf(profile: ProfileLike): Look {
  const kind = chibiKindOf(profile);
  const base = LOOKS[kind];
  const raw = rawOf(profile);
  if (!raw || raw.v !== 2) return base;
  const cached = looks.get(raw);
  if (cached) return cached;
  const look: Look = { ...base };
  if (typeof raw.skin === 'number' && SKIN[raw.skin]) look.skin = raw.skin;
  for (const cat of WEAR_CATS) {
    if (!(cat in raw)) continue;
    const slot = slotOf(raw[cat]);
    if (slot) (look as Record<WearCat, Slot | null | undefined>)[cat] = slot;
    else if (raw[cat] === null && !REQUIRED.has(cat)) (look as Record<WearCat, Slot | null | undefined>)[cat] = null;
  }
  if (typeof raw.ability === 'string') look.ability = raw.ability;
  looks.set(raw, look);
  return look;
}

export const skinColor = (look: Look) => SKIN[look.skin] ?? SKIN[1];

// Цвет вещи: выбранный, иначе цвет по умолчанию; чужой палитре — по умолчанию
export function itemColor(slot: Slot | null | undefined, item: ItemRow | undefined): string {
  const pal = item?.palette === 'hair' ? HAIR : CLOTH;
  const def = item?.def_color ?? 'coal';
  return pal[slot?.c ?? def]?.[1] ?? pal[def]?.[1] ?? CLOTH[def]?.[1] ?? '#888888';
}

export type Worn = { slot: Slot; item: ItemRow; color: string };
export type Dressed = { skin: string; worn: Partial<Record<WearCat, Worn>> };

// Образ → вещи из каталога. Неизвестную вещь (каталог ещё не обновился) пропускаем,
// а обязательную заменяем вещью по умолчанию — чибик всегда нарисован целиком.
export function dress(look: Look, catalog: Catalog): Dressed {
  const worn: Partial<Record<WearCat, Worn>> = {};
  for (const cat of WEAR_CATS) {
    let slot = (look as Record<WearCat, Slot | null | undefined>)[cat] ?? null;
    let item = slot ? catalog.get(slot.id) : undefined;
    if (slot && (!item || item.cat !== cat)) {
      requestItem(slot.id);
      item = undefined;
    }
    if (!item && REQUIRED.has(cat)) {
      slot = (LOOKS[look.kind] ?? LOOKS.nb)[cat] as Slot;
      item = catalog.get(slot.id);
    }
    if (slot && item) worn[cat] = { slot, item, color: itemColor(slot, item) };
  }
  return { skin: skinColor(look), worn };
}

// ---------- Гардероб ----------

export const DEFAULT_ABILITY = 'ability.hug';

// Образ → profiles.chibi. Порядок ключей всегда один, поэтому строки можно сравнивать.
export function lookToChibi(look: Look): ChibiLook {
  const out: ChibiLook = { kind: look.kind, v: 2, skin: look.skin };
  for (const cat of WEAR_CATS) out[cat] = (look as Record<WearCat, Slot | null | undefined>)[cat] ?? null;
  if (look.ability) out.ability = look.ability;
  return out;
}

export const sameLook = (a: Look, b: Look) => JSON.stringify(lookToChibi(a)) === JSON.stringify(lookToChibi(b));

// Надеть вещь (или снять: item = null). Цвет сохраняется, если новая вещь из той же палитры.
export function wear(look: Look, cat: WearCat, item: ItemRow | null): Look {
  const slot = (look as Record<WearCat, Slot | null | undefined>)[cat];
  if (!item) return REQUIRED.has(cat) ? look : { ...look, [cat]: null };
  const old = slot ? getCatalog().get(slot.id) : undefined;
  const keep = slot?.c && item.palette && old?.palette === item.palette;
  return { ...look, [cat]: keep ? { id: item.id, c: slot!.c } : { id: item.id } };
}

export function recolor(look: Look, cat: WearCat, color: string): Look {
  const slot = (look as Record<WearCat, Slot | null | undefined>)[cat];
  return slot ? { ...look, [cat]: { id: slot.id, c: color } } : look;
}

// Надеть всё из набора: в каждой категории — первую вещь, способность — первую
export function wearAll(look: Look, ids: string[], catalog: Catalog): Look {
  let next = look;
  const done = new Set<string>();
  for (const id of ids) {
    const item = catalog.get(id);
    if (!item || done.has(item.cat)) continue;
    done.add(item.cat);
    next = item.cat === 'ability' ? { ...next, ability: item.id } : wear(next, item.cat, item);
  }
  return next;
}
