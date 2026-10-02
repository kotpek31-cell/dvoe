// Грибы в «Лесу с костром» (0.2.2): 5 цветов, собрать 5 по секретному порядку → шляпа грибника.
// Порядок знает только сервер (mushroom_try); здесь — цвета, где растут грибы, корзинка и подсказка для пещеры.
// Корзинка общая для главной и комнаты: что собрал в одном месте, видно в другом (до перезапуска).
import { useEffect, useSyncExternalStore } from 'react';
import { mushroomHint, mushroomTry, type MushroomReply } from './api';

export type MushColor = 'red' | 'blue' | 'yellow' | 'purple' | 'white';
export const MUSH_COLORS: MushColor[] = ['red', 'blue', 'yellow', 'purple', 'white'];
export const MUSH_HEX: Record<MushColor, string> = { red: '#E5484D', blue: '#4F8BFF', yellow: '#FFC94D', purple: '#B07BFF', white: '#F4F0FF' };
export const MUSH_NAME: Record<MushColor, string> = { red: 'красный', blue: 'синий', yellow: 'жёлтый', purple: 'фиолетовый', white: 'белый' };
export const isMushColor = (v: unknown): v is MushColor => typeof v === 'string' && (MUSH_COLORS as string[]).includes(v);

export const MUSH_REGROW_MS = 2000;
export const HAT_ID = 'hat.mushroom';

// Главная: низ ножки в координатах сцены 390×844 — там, куда дотягиваются ноги чибика (645…737),
// мимо бревна, костра, пледа и кнопки способности (справа внизу)
export const HOME_MUSHROOMS: { c: MushColor; x: number; y: number }[] = [
  { c: 'red', x: 152, y: 664 },
  { c: 'yellow', x: 28, y: 618 }, // был под джойстиком (этап фиксации 0.2) — теперь у костра
  { c: 'white', x: 122, y: 740 },
  { c: 'purple', x: 206, y: 724 },
  { c: 'blue', x: 286, y: 738 },
];

// Комната: доли мира, как у чибиков (x — по ширине, y — по глубине); препятствия обходит freeSpot
export const ROOM_MUSHROOMS: { c: MushColor; fx: number; fy: number }[] = [
  { c: 'yellow', fx: 0.09, fy: 0.72 },
  { c: 'red', fx: 0.28, fy: 0.3 },
  { c: 'white', fx: 0.47, fy: 0.86 },
  { c: 'blue', fx: 0.66, fy: 0.42 },
  { c: 'purple', fx: 0.88, fy: 0.66 },
];

// ---------- корзинка ----------
export type HuntState = {
  basket: MushColor[];
  checking: boolean;
  shake: number; // растёт при неверном порядке — корзинка трясётся, грибы вянут
  pop: number; // растёт, когда положили гриб
};
let state: HuntState = { basket: [], checking: false, shake: 0, pop: 0 };
const subs = new Set<() => void>();
const set = (next: Partial<HuntState>) => {
  state = { ...state, ...next };
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
const getState = () => state;
export const useHunt = () => useSyncExternalStore(subscribe, getState, getState);

export function emptyBasket() {
  if (!state.checking) set({ basket: [] });
}

export type PutOutcome =
  | { kind: 'added' }
  | { kind: 'full' } // уже проверяем
  | { kind: 'hat' } // верно — шляпа
  | { kind: 'again' } // шляпа уже есть — просто собрали
  | { kind: 'wrong'; message: string }
  | { kind: 'error'; message: string };

// Положить гриб; пятый — проверка на сервере (если шляпы ещё нет)
export async function putMushroom(c: MushColor, hasHat: boolean): Promise<PutOutcome> {
  if (state.checking || state.basket.length >= 5) return { kind: 'full' };
  const basket = [...state.basket, c];
  set({ basket, pop: state.pop + 1 });
  if (basket.length < 5) return { kind: 'added' };
  if (hasHat) {
    setTimeout(() => set({ basket: [] }), 1200);
    return { kind: 'again' };
  }
  set({ checking: true });
  let res: MushroomReply;
  try {
    res = await mushroomTry(basket);
  } catch (e) {
    set({ checking: false, basket: basket.slice(0, 4) });
    return { kind: 'error', message: e instanceof Error ? e.message : 'Нет связи — попробуй ещё раз' };
  }
  if (res.ok || res.error === 'owned') {
    setTimeout(() => set({ basket: [], checking: false }), 1400);
    return res.ok ? { kind: 'hat' } : { kind: 'again' };
  }
  if (res.error === 'wrong') {
    set({ shake: state.shake + 1 });
    setTimeout(() => set({ basket: [], checking: false }), 1300);
    const left = res.left ?? 0;
    return { kind: 'wrong', message: left > 0 ? `Не тот порядок · ${left === 1 ? 'осталась 1 попытка' : `осталось ${left} ${left < 5 ? 'попытки' : 'попыток'}`}` : 'Не тот порядок · попытки на сегодня кончились' };
  }
  // кончились попытки, порядок не задан — грибы не пропадают, корзинку можно высыпать
  set({ checking: false, shake: state.shake + 1 });
  setTimeout(() => set({ basket: [] }), 1300);
  return { kind: 'error', message: res.message };
}

// ---------- подсказка для пещеры ----------
// Порядок приходит с сервера один раз за запуск; в коде его нет
let hint: MushColor[] | null = null;
let hintLoading = false;
const hintSubs = new Set<() => void>();
export function useMushroomHint(enabled: boolean): MushColor[] | null {
  const value = useSyncExternalStore(
    (f) => {
      hintSubs.add(f);
      return () => hintSubs.delete(f);
    },
    () => hint,
    () => hint,
  );
  useEffect(() => {
    if (!enabled || hint || hintLoading) return;
    hintLoading = true;
    mushroomHint()
      .then((seq) => {
        if (Array.isArray(seq) && seq.length === 5 && seq.every(isMushColor)) {
          hint = seq;
          hintSubs.forEach((f) => f());
        }
      })
      .catch(() => undefined)
      .finally(() => {
        hintLoading = false;
      });
  }, [enabled]);
  return value;
}

// ---------- торжество «шляпа получена» ----------
// Показывает HatReveal поверх любого экрана; dry — проверка из комнаты разработчиков (без «Надеть»)
type Reveal = { n: number; dry: boolean } | null;
let reveal: Reveal = null;
const revealSubs = new Set<() => void>();
export function showHatReveal(dry = false) {
  reveal = { n: (reveal?.n ?? 0) + 1, dry };
  revealSubs.forEach((f) => f());
}
export function closeHatReveal() {
  reveal = null;
  revealSubs.forEach((f) => f());
}
export const useHatReveal = () =>
  useSyncExternalStore(
    (f) => {
      revealSubs.add(f);
      return () => revealSubs.delete(f);
    },
    () => reveal,
    () => reveal,
  );
