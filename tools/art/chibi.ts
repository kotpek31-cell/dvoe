// Чибик 2.0 для макета: та же геометрия 120×170, лицо — настоящий движок src/lib/face.ts.
// Вещи описаны слоями; эти же описания потом станут каталогом в базе.
import { faceModel, faceParams, FACE_PATHS, FACE_SPOTS, INK, type FaceKey } from '../../src/lib/face.ts';

// ---------- цвета (общие с приложением: src/lib/palette.ts) ----------
import { CLOTH, HAIR, SKIN } from '../../src/lib/palette.ts';
import { eyeArt, isNewEye } from '../../src/lib/eyes.ts';
export { CLOTH, HAIR, SKIN };

function rgb(h: string): number[] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// Токены цвета для каталога в базе: '@c' — цвет вещи, '@skin' — кожа.
// Операции через '|': d0.2 — темнее (к INK), l0.3 — светлее (к белому), k — контраст для сердечка.
export function mix(a: string, b: string, t: number): string {
  if (a.startsWith('@')) {
    if (b === INK) return `${a}|d${t}`;
    if (b.toUpperCase() === '#FFFFFF') return `${a}|l${t}`;
    throw new Error(`mix: токен ${a} можно смешивать только с INK или белым`);
  }
  const A = rgb(a);
  const B = rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
export const dark = (c: string, t = 0.18) => mix(c, INK, t);
export const light = (c: string, t = 0.3) => mix(c, '#FFFFFF', t);
// Сердечко на свитере: на вишнёвом — молочное, на остальных — вишнёвое
export const contrast = (c: string) => (c.startsWith('@') ? `${c}|k` : c.toUpperCase() === CLOTH.cherry[1] ? '#F4F0FF' : '#E5566B');

// ---------- svg-помощники (все теги закрыты явно) ----------
type A = Record<string, string | number | undefined | null>;
export function el(tag: string, attrs: A, children = ''): string {
  const a = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  return `<${tag}${a ? ' ' + a : ''}>${children}</${tag}>`;
}
export const SW = 2.2;
export const path = (d: string, fill: string, o: A = {}) =>
  d ? el('path', { d, fill, stroke: INK, 'stroke-width': SW, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...o }) : '';
export const line = (d: string, color: string, w: number, o: A = {}) =>
  el('path', { d, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...o });
export const g = (children: string, o: A = {}) => el('g', o, children);
let uidN = 0;
export const uid = (p: string) => `${p}${++uidN}`;

// ---------- постоянные детали ----------
export const P = {
  legL: { x: 47, y: 124, w: 11, h: 24 },
  legR: { x: 62, y: 124, w: 11, h: 24 },
  shoeL: 'M44 150 C44 145 47.5 143.5 52.5 143.5 C57.5 143.5 60 146 60 150.5 C60 154.5 57 156.5 52 156.5 C47 156.5 44 154.5 44 150 Z',
  shoeR: 'M76 150 C76 145 72.5 143.5 67.5 143.5 C62.5 143.5 60 146 60 150.5 C60 154.5 63 156.5 68 156.5 C73 156.5 76 154.5 76 150 Z',
  pocket: 'M47 123 C52 119 68 119 73 123 L72 132 L48 132 Z',
  strings: 'M55 102 L54.5 111 M65 102 L65.5 111',
  hem: 'M35 132.5 C47 135.5 73 135.5 85 132.5',
  collar: 'M47 99.5 C49 106 56 107 60 102 C64 107 71 106 73 99.5 C68 98 52 98 47 99.5 Z',
  bowLoops: 'M0 0 C-4 -7 -12 -8 -12 -1 C-12 6 -4 5 0 0 Z M0 0 C4 -7 12 -8 12 -1 C12 6 4 5 0 0 Z',
};
export const HOODIE = 'M40 104 C40 99 47 96 60 96 C73 96 80 99 80 104 L84 128 C85 134 81 137 76 137 L44 137 C39 137 35 134 36 128 Z';
export const DRESS = 'M41 103 C41 98.5 48 96 60 96 C72 96 79 98.5 79 103 L86 133 C87 138 83 140 78 140 L42 140 C37 140 33 138 34 133 Z';

// ---------- вещи ----------
export type Cat = 'hair' | 'eyes' | 'hat' | 'face' | 'top' | 'bottom' | 'shoes' | 'back' | 'hand';
export type Slot = { id: string; c?: string };
export type Ctx = { col: string; skin: string; side?: 'L' | 'R'; x?: number };
export type Item = {
  cat: Cat;
  name: string;
  def?: string; // цвет по умолчанию
  palette?: 'cloth' | 'hair';
  code?: boolean; // по коду
  sleeve?: 'full' | 'short';
  sleeveColor?: string; // ключ цвета рукава, если не цвет вещи
  cuff?: string; // манжеты на рукавах
  coversBottom?: boolean;
  hover?: boolean;
  anim?: 'sway' | 'flicker' | 'pulse'; // 0.2.1: качается (спина) или мерцает (слои *Fx)
  pivot?: [number, number]; // точка качания
  skin?: string; // вещь красит кожу (Франкенштейн, вампир)
  layers: Partial<Record<string, (c: Ctx) => string>>;
};

export const BOY_FRONT =
  'M15 66 C11 38 30 17 60 17 C90 17 109 38 105 66 C102 58 98 52 93 49 C92 54 89 57 85 58 C85 52 82 47 77 45 C75 51 70 55 63 55 C65 50 64 46 61 43 C57 50 50 55 41 55 C44 51 45 47 44 44 C38 48 34 54 31 58 C30 53 28 50 26 49 C21 53 17 59 15 66 Z';
export const GIRL_FRONT =
  'M15 70 C11 38 32 16 60 16 C88 16 109 38 105 70 C103 63 101 58 98 54 C94 58 89 58 85 55 C82 59 76 60 71 57 C67 61 62 61 58 58 C54 61 48 61 45 57 C41 60 36 59 32 55 C28 58 23 58 21 54 C18 59 16 64 15 70 Z';
export const NB_FRONT =
  'M15 70 C11 38 32 16 60 16 C88 16 109 38 105 70 C103 62 100 55 95 50 C88 55 76 54 68 44 C66 50 62 53 60 53 C58 53 54 50 52 44 C44 54 32 55 25 50 C20 55 17 62 15 70 Z';
export const shine = (d: string) => line(d, '#FFFFFF', 2.6, { opacity: 0.3 });

export const ITEMS: Record<string, Item> = {
  // ----- причёски -----
  'hair.vikhor': {
    cat: 'hair', name: 'Вихор', def: 'coal', palette: 'hair',
    layers: {
      hairFront: ({ col }) => path(BOY_FRONT, col) + path('M59 18 C56 10 62 3 71 4 C66 7 64 11 65 18 Z', col) + shine('M33 31 C40 24 50 21 58 21'),
    },
  },
  'hair.long': {
    cat: 'hair', name: 'Длинные с чёлкой', def: 'chocolate', palette: 'hair',
    layers: {
      hairBack: ({ col }) =>
        path('M14 68 C10 36 32 16 60 16 C88 16 110 36 106 68 C106 84 108 100 112 116 C114 125 109 132 101 132 C95 132 91 128 89 122 L31 122 C29 128 25 132 19 132 C11 132 6 125 8 116 C12 100 14 84 14 68 Z', col),
      hairFront: ({ col }) =>
        path(GIRL_FRONT, col) +
        path('M16 62 C12 78 12 96 17 112 C21 108 23 98 24 88 C25 78 24 70 23 60 Z', col) +
        path('M104 62 C108 78 108 96 103 112 C99 108 97 98 96 88 C95 78 96 70 97 60 Z', col) +
        shine('M31 31 C39 23 50 20 60 20 M72 21 C79 22 85 25 89 30'),
    },
  },
  'hair.fluffy': {
    cat: 'hair', name: 'Пушистая', def: 'plum', palette: 'hair',
    layers: {
      hairBack: ({ col }) => path('M14 68 C10 36 32 16 60 16 C88 16 110 36 106 68 C107 80 106 90 101 97 L19 97 C14 90 13 80 14 68 Z', col),
      hairFront: ({ col }) =>
        path(NB_FRONT, col) +
        path('M16 62 C12 74 13 86 18 96 C20 92 23 90 26 90 C24 82 23 72 23 62 Z', col) +
        path('M104 62 C108 74 107 86 102 96 C100 92 97 90 94 90 C96 82 97 72 97 62 Z', col) +
        shine('M31 31 C39 23 50 20 60 20'),
    },
  },
  'hair.ponytail': {
    cat: 'hair', name: 'Хвостик', def: 'caramel', palette: 'hair',
    layers: {
      hairBack: ({ col }) =>
        path('M90 30 C106 22 122 36 121 58 C120 76 112 92 103 100 C104 86 104 70 99 58 C96 48 93 40 90 30 Z', col) +
        line('M99 58 C103 70 104 82 103 94', dark(col, 0.25), 1.6, { opacity: 0.7 }),
      hairFront: ({ col }) => path(GIRL_FRONT, col) + shine('M31 31 C39 23 50 20 60 20') + el('circle', { cx: 93, cy: 31, r: 4.6, fill: '#FF6B8A', stroke: INK, 'stroke-width': 1.8 }),
    },
  },
  'hair.bob': {
    cat: 'hair', name: 'Каре', def: 'coal', palette: 'hair', code: true,
    layers: {
      hairBack: ({ col }) =>
        path('M14 66 C10 34 32 15 60 15 C88 15 110 34 106 66 C107 78 108 88 104 96 C101 101 95 102 91 99 L29 99 C25 102 19 101 16 96 C12 88 13 78 14 66 Z', col),
      hairFront: ({ col }) =>
        path('M15 66 C11 36 32 15 60 15 C88 15 109 36 105 66 C104 59 102 54 99 50 C95 53 90 53 86 50 C83 54 77 55 73 51 C69 55 63 55 60 51 C57 55 51 55 47 51 C43 55 37 54 34 50 C30 53 25 53 21 50 C18 54 16 59 15 66 Z', col) +
        path('M16 58 C12 72 12 86 16 96 C19 100 25 100 27 96 C25 92 24 86 24 80 C24 72 24 64 23 58 Z', col) +
        path('M104 58 C108 72 108 86 104 96 C101 100 95 100 93 96 C95 92 96 86 96 80 C96 72 96 64 97 58 Z', col) +
        line('M40 22 C34 30 31 40 31 48 M60 19 C57 28 56 38 57 47 M80 22 C86 30 89 40 89 48', light(col, 0.22), 1.3, { opacity: 0.55 }) +
        line('M19 70 C18 80 19 88 21 94 M101 70 C102 80 101 88 99 94', light(col, 0.22), 1.2, { opacity: 0.5 }) +
        line('M30 30 C38 22 48 19 58 19', '#FFFFFF', 3.2, { opacity: 0.32 }) +
        line('M72 20 C80 21 86 24 90 28', '#FFFFFF', 2.2, { opacity: 0.25 }),
    },
  },
  // ----- глаза (стиль рисует движок лица) -----
  'eyes.classic': { cat: 'eyes', name: 'Обычные', def: 'coal', palette: 'cloth', layers: {} },
  'eyes.lashes': { cat: 'eyes', name: 'С ресничками', def: 'coal', palette: 'cloth', layers: {} },
  'eyes.sparkle': { cat: 'eyes', name: 'Сияющие', def: 'blueberry', palette: 'cloth', layers: {} },
  'eyes.sleepy': { cat: 'eyes', name: 'Сонные', def: 'coal', palette: 'cloth', layers: {} },
  'eyes.azure': { cat: 'eyes', name: 'Дымка', code: true, layers: {} },

  // ----- шляпы -----
  'hat.beanie': {
    cat: 'hat', name: 'Бини', def: 'cherry', palette: 'cloth',
    layers: {
      hat: ({ col }) =>
        path('M17 50 C15 24 35 9 60 9 C85 9 105 24 103 50 Z', col) +
        line('M40 16 V46 M60 10 V46 M80 16 V46', dark(col, 0.2), 1.4, { opacity: 0.55 }) +
        path('M14 50 C14 45 17 43 21 43 H99 C103 43 106 45 106 50 C106 55 103 57 99 57 H21 C17 57 14 55 14 50 Z', dark(col, 0.12)) +
        el('circle', { cx: 60, cy: 7, r: 7.5, fill: light(col, 0.35), stroke: INK, 'stroke-width': SW }),
    },
  },
  'hat.cap': {
    cat: 'hat', name: 'Кепка', def: 'blueberry', palette: 'cloth',
    layers: {
      hat: ({ col }) =>
        path('M18 50 C16 25 36 11 60 11 C84 11 104 25 102 50 Z', col) +
        path('M56 44 C70 41 98 41 114 48 C108 55 82 56 56 51 Z', dark(col, 0.15)) +
        line('M60 12 C58 24 58 36 60 48', dark(col, 0.25), 1.4, { opacity: 0.6 }) +
        el('circle', { cx: 60, cy: 12, r: 3.4, fill: light(col, 0.3), stroke: INK, 'stroke-width': 1.8 }),
    },
  },
  'hat.panama': {
    cat: 'hat', name: 'Панама', def: 'lemon', palette: 'cloth',
    layers: {
      hat: ({ col }) =>
        path('M28 38 C28 20 42 11 60 11 C78 11 92 20 92 38 Z', col) +
        path('M28 36 H92 V41 H28 Z', dark(col, 0.22), { 'stroke-width': 1.6 }) +
        path('M6 44 C6 36 30 34 60 34 C90 34 114 36 114 44 C114 51 92 53 60 53 C28 53 6 51 6 44 Z', light(col, 0.12)),
    },
  },
  'hat.bow': {
    cat: 'hat', name: 'Бантик', def: 'cherry', palette: 'cloth',
    layers: {
      hat: ({ col }) =>
        g(path(P.bowLoops, col, { 'stroke-width': 1.8 }) + el('circle', { cx: 0, cy: -0.5, r: 3, fill: light(col, 0.3), stroke: INK, 'stroke-width': 1.6 }), {
          transform: 'translate(87 23) rotate(18) scale(1.15)',
        }),
    },
  },
  'hat.beret': {
    cat: 'hat', name: 'Берет', def: 'cherry', palette: 'cloth', code: true,
    layers: {
      hat: ({ col }) =>
        g(
          path('M14 34 C18 17 42 8 64 10 C88 12 108 22 106 35 C104 42 92 44 78 42 C58 39 34 44 21 42 C15 41 13 38 14 34 Z', col) +
            line('M62 10 L64 2', INK, 2.6) +
            line('M24 38 C44 35 70 34 98 38', dark(col, 0.25), 1.4, { opacity: 0.6 }),
          { transform: 'rotate(-8 60 30)' },
        ),
    },
  },
  'hat.halo': {
    cat: 'hat', name: 'Нимб', code: true,
    layers: {
      over: () =>
        el('ellipse', { cx: 60, cy: 0, rx: 30, ry: 9, fill: 'none', stroke: '#FFE89A', 'stroke-width': 9, opacity: 0.3 }) +
        el('ellipse', { cx: 60, cy: 0, rx: 25, ry: 6.5, fill: 'none', stroke: INK, 'stroke-width': 6.4 }) +
        el('ellipse', { cx: 60, cy: 0, rx: 25, ry: 6.5, fill: 'none', stroke: '#FFD45E', 'stroke-width': 3.6 }) +
        el('path', { d: 'M40 -3 C48 -6 60 -7 72 -5', fill: 'none', stroke: '#FFF6CF', 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
    },
  },
  'face.bandana': {
    cat: 'face', name: 'Бандана на лицо', def: 'cherry', palette: 'cloth', code: true,
    layers: {
      mask: ({ col }) =>
        path('M19 76 C32 82 88 82 101 76 C103 86 99 96 91 102 C82 108 70 112 60 118 C50 112 38 108 29 102 C21 96 17 86 19 76 Z', col) +
        line('M30 92 C42 98 52 100 60 104 M90 92 C78 98 68 100 60 104', dark(col, 0.25), 1.4, { opacity: 0.7 }) +
        [[30, 84], [44, 88], [60, 90], [76, 88], [90, 84], [38, 97], [52, 102], [68, 102], [82, 97], [60, 110]]
          .map(([x, y]) => el('circle', { cx: x, cy: y, r: 1.7, fill: '#FFFFFF', opacity: 0.9 }))
          .join('') +
        path('M101 77 C108 74 114 76 117 80 C112 82 107 82 102 81 Z', col, { 'stroke-width': 1.8 }) +
        path('M102 81 C108 84 112 89 112 94 C107 92 103 88 101 84 Z', dark(col, 0.12), { 'stroke-width': 1.8 }) +
        el('circle', { cx: 101.5, cy: 80, r: 3, fill: dark(col, 0.1), stroke: INK, 'stroke-width': 1.6 }),
    },
  },

  // ----- верх -----
  'top.hoodie': {
    cat: 'top', name: 'Худи', def: 'blueberry', palette: 'cloth', sleeve: 'full',
    layers: {
      body: ({ col }) =>
        path(HOODIE, col) + path(P.pocket, dark(col, 0.14), { 'stroke-width': 1.4 }) + line(P.strings, '#FFFFFF', 1.6, { opacity: 0.9 }),
    },
  },
  'top.tee': {
    cat: 'top', name: 'Футболка', def: 'lemon', palette: 'cloth', sleeve: 'short',
    layers: {
      body: ({ col, skin }) =>
        path(HOODIE, col) + path('M51 97.4 Q60 106 69 97.4 Q60 96 51 97.4 Z', skin, { 'stroke-width': 1.4 }) +
        el('path', { d: 'M55 117 l2.5 -5 l2.5 5 l2.5 -5 l2.5 5', fill: 'none', stroke: '#FFFFFF', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.85 }),
    },
  },
  'top.sweater': {
    cat: 'top', name: 'Свитер с сердечком', def: 'lavender', palette: 'cloth', sleeve: 'full',
    layers: {
      body: ({ col }) =>
        path(HOODIE, col) +
        line('M50 98 Q60 102 70 98', dark(col, 0.3), 1.6) +
        line('M37.5 131.5 C50 133.6 70 133.6 82.5 131.5', dark(col, 0.3), 1.4, { opacity: 0.8 }) +
        g(path(FACE_PATHS.heart, contrast(col), { 'stroke-width': 1.2 }), { transform: 'translate(60 116.5) scale(1.35)' }),
    },
  },
  'top.dress': {
    cat: 'top', name: 'Платье', def: 'strawberry', palette: 'cloth', sleeve: 'full', coversBottom: true,
    layers: {
      body: ({ col }) => path(DRESS, col) + line(P.hem, '#FFFFFF', 2.2, { opacity: 0.85 }) + path(P.collar, '#FFFFFF', { 'stroke-width': 1.4 }),
    },
  },
  'top.apron': {
    cat: 'top', name: 'Фартук художника', def: 'sky', palette: 'cloth', sleeve: 'short', sleeveColor: 'milk', code: true,
    layers: {
      body: ({ col, skin }) =>
        path(HOODIE, CLOTH.milk[1]) +
        path('M51 97.4 Q60 106 69 97.4 Q60 96 51 97.4 Z', skin, { 'stroke-width': 1.4 }) +
        path('M46.5 106 H73.5 L76 133 C76 135.5 74.5 137 72 137 L48 137 C45.5 137 44 135.5 44 133 Z', col, { 'stroke-width': 1.8 }) +
        line('M47.5 106 L44 98 M72.5 106 L76 98', dark(col, 0.2), 2.2) +
        path('M53 124 H67 V131 H53 Z', dark(col, 0.12), { 'stroke-width': 1.4 }) +
        el('circle', { cx: 52, cy: 113, r: 2.6, fill: '#E5566B' }) +
        el('circle', { cx: 68, cy: 116, r: 2.2, fill: '#FFD966' }) +
        el('circle', { cx: 62, cy: 110, r: 1.6, fill: '#5ED3A0' }) +
        el('circle', { cx: 56, cy: 119, r: 1.3, fill: '#7F8CFF' }),
    },
  },
  'top.blackdress': {
    cat: 'top', name: 'Чёрное платье', def: 'coal', palette: 'cloth', sleeve: 'full', coversBottom: true, code: true, cuff: '#F4F0FF',
    layers: {
      body: ({ col }) =>
        path(DRESS, col) +
        path('M39.6 110 C46 112 74 112 80.4 110 L81.2 114.5 C74 116.5 46 116.5 38.8 114.5 Z', light(col, 0.12), { 'stroke-width': 1.4 }) +
        line('M50 118 L46 137 M60 118 V138 M70 118 L74 137', light(col, 0.18), 1.2, { opacity: 0.7 }) +
        line('M36 131 C48 134.5 72 134.5 84 131', light(col, 0.25), 1.6, { opacity: 0.8 }) +
        path('M47 99.5 q3.25 5 6.5 0 q3.25 5 6.5 0 q3.25 5 6.5 0 q3.25 5 6.5 0 Q60 97.5 47 99.5 Z', '#F4F0FF', { 'stroke-width': 1.3 }) +
        g(path(P.bowLoops, '#F4F0FF', { 'stroke-width': 1.3 }) + el('circle', { cx: 0, cy: -0.4, r: 2.2, fill: '#F4F0FF', stroke: INK, 'stroke-width': 1.2 }), {
          transform: 'translate(60 112.5) scale(0.62)',
        }),
    },
  },

  // ----- низ -----
  'bottom.pants': {
    cat: 'bottom', name: 'Брюки', def: 'coal', palette: 'cloth',
    layers: {
      leg: ({ col, x }) => el('rect', { x, y: 124, width: 11, height: 24, rx: 5, fill: col, stroke: INK, 'stroke-width': SW }) + line(`M${x! + 1.5} 145 H${x! + 9.5}`, dark(col, 0.3), 1.2, { opacity: 0.7 }),
    },
  },
  'bottom.shorts': {
    cat: 'bottom', name: 'Шорты', def: 'sky', palette: 'cloth',
    layers: {
      under: ({ col }) => path('M37 128 H83 L85 139 C85 141 83 142 81 142 L63 142 L60 138.5 L57 142 L39 142 C37 142 35 141 35 139 Z', col),
    },
  },
  'bottom.skirt': {
    cat: 'bottom', name: 'Юбка', def: 'lavender', palette: 'cloth',
    layers: {
      under: ({ col }) =>
        path('M38 126 H82 L88 143 C88.5 145 87 146 85 146 L35 146 C33 146 31.5 145 32 143 Z', col) +
        line('M48 132 L45 145 M60 132 V145 M72 132 L75 145', dark(col, 0.2), 1.3, { opacity: 0.6 }),
    },
  },

  // ----- обувь -----
  'shoes.kedy': {
    cat: 'shoes', name: 'Кеды', def: 'milk', palette: 'cloth',
    layers: {
      shoe: ({ col, side }) => {
        const d = side === 'L' ? P.shoeL : P.shoeR;
        const sole = side === 'L' ? 'M45 153.2 H59' : 'M61 153.2 H75';
        const lace = side === 'L' ? 'M50 146.5 h5' : 'M65 146.5 h5';
        return path(d, col) + line(sole, '#B9B2CC', 1.6) + line(lace, dark(col, 0.35), 1.3);
      },
    },
  },
  'shoes.boots': {
    cat: 'shoes', name: 'Ботинки', def: 'coal', palette: 'cloth',
    layers: {
      shoe: ({ col, side, x }) => {
        const d = side === 'L' ? P.shoeL : P.shoeR;
        return el('rect', { x: x! - 0.6, y: 136, width: 12.2, height: 13, rx: 3, fill: col, stroke: INK, 'stroke-width': SW }) +
          path(d, col) + line(side === 'L' ? 'M45 153.4 H59' : 'M61 153.4 H75', light(col, 0.3), 1.6) +
          line(`M${x! + 2} 140 h7 M${x! + 2} 143.5 h7`, light(col, 0.4), 1.1, { opacity: 0.8 });
      },
    },
  },
  'shoes.sapozhki': {
    cat: 'shoes', name: 'Сапожки', def: 'cherry', palette: 'cloth',
    layers: {
      shoe: ({ col, side, x }) => {
        const d = side === 'L' ? P.shoeL : P.shoeR;
        return el('rect', { x: x! - 1, y: 131, width: 13, height: 18, rx: 4, fill: col, stroke: INK, 'stroke-width': SW }) +
          el('rect', { x: x! - 1.8, y: 128.5, width: 14.6, height: 6.5, rx: 3.2, fill: light(col, 0.4), stroke: INK, 'stroke-width': 1.8 }) +
          path(d, col);
      },
    },
  },

  // ----- спина -----
  'back.backpack': {
    cat: 'back', name: 'Рюкзак', def: 'apricot', palette: 'cloth',
    layers: {
      back: ({ col }) => path('M31 102 C31 95 37 91 45 91 H75 C83 91 89 95 89 102 V129 C89 135 85 139 79 139 H41 C35 139 31 135 31 129 Z', col),
      front: ({ col }) =>
        line('M48 99 C46 108 45.5 118 45.5 129 M72 99 C74 108 74.5 118 74.5 129', INK, 5.2) +
        line('M48 99 C46 108 45.5 118 45.5 129 M72 99 C74 108 74.5 118 74.5 129', dark(col, 0.1), 3),
    },
  },
  'back.wings': {
    cat: 'back', name: 'Крылья ангела', code: true, hover: true,
    layers: {
      back: () => {
        const wing =
          path('M46 104 C40 92 28 82 12 80 C2 79 -8 84 -10 92 C-4 92 0 94 0 98 C-6 99 -9 103 -8 108 C-2 106 3 107 5 111 C0 113 -1 117 2 120 C8 117 14 117 18 120 C17 124 19 127 24 128 C30 124 36 124 40 126 C46 120 48 112 46 104 Z', '#FFFFFF') +
          line('M40 100 C30 92 18 89 4 92 M40 106 C30 102 18 101 6 104 M41 112 C33 110 24 111 16 116 M43 118 C38 117 32 119 28 124', '#C9B6FF', 1.5, { opacity: 0.9 }) +
          line('M14 84 C22 84 30 88 36 94', '#FFFFFF', 0, {});
        return g(wing) + g(wing, { transform: 'translate(120 0) scale(-1 1)' });
      },
    },
  },

  // ----- в руках -----
  'hand.balloon': {
    cat: 'hand', name: 'Шарик-сердце', def: 'cherry', palette: 'cloth',
    layers: {
      handR: ({ col }) =>
        line('M81 126 C96 112 124 88 139 70', INK, 1.3) +
        g(path(FACE_PATHS.heart, col, { 'stroke-width': 0.95 }) + el('ellipse', { cx: -2.6, cy: -3.4, rx: 1.4, ry: 0.9, fill: '#FFFFFF', opacity: 0.7 }), {
          transform: 'translate(141 57) scale(2.2)',
        }),
    },
  },
  'hand.cocoa': {
    cat: 'hand', name: 'Чашка какао', def: 'mint', palette: 'cloth',
    layers: {
      handR: ({ col }) =>
        line('M98.4 120.5 a3.6 3.6 0 0 1 0 7.2', INK, 2.2) +
        path('M83.5 117 H98.5 V127 A3.5 3.5 0 0 1 95 130.5 H87 A3.5 3.5 0 0 1 83.5 127 Z', col) +
        el('ellipse', { cx: 91, cy: 117.8, rx: 6.2, ry: 1.6, fill: '#7A4A33' }) +
        line('M88 112 q-2 -3 0 -6 M94 112 q-2 -3 0 -6', '#FFFFFF', 1.5, { opacity: 0.85 }),
    },
  },
  'hand.bouquet': {
    cat: 'hand', name: 'Букет', def: 'lavender', palette: 'cloth',
    layers: {
      handR: ({ col }) => {
        const flower = (x: number, y: number, c: string) =>
          [0, 72, 144, 216, 288]
            .map((a) => el('circle', { cx: (x + 3.2 * Math.sin((a * Math.PI) / 180)).toFixed(2), cy: (y - 3.2 * Math.cos((a * Math.PI) / 180)).toFixed(2), r: 2.6, fill: c, stroke: INK, 'stroke-width': 0.9 }))
            .join('') + el('circle', { cx: x, cy: y, r: 1.8, fill: '#FFB347' });
        return line('M81 124 L77 104 M82 124 L84 100 M83 124 L90 106', '#3E9A62', 1.8) +
          flower(77, 103, '#FF8FB3') + flower(84, 98, '#FFD966') + flower(90.5, 105, '#F4F0FF') +
          path('M74.5 112 L90.5 112 L84 131 L81 131 Z', col, { 'stroke-width': 1.8 });
      },
    },
  },
  'hand.brush': {
    cat: 'hand', name: 'Кисть с палитрой', code: true,
    layers: {
      handR: () =>
        line('M76 135 L95.6 106.6', INK, 5.2) + line('M76 135 L95.6 106.6', '#D79A5A', 3) + line('M77.4 132.4 L94 108', '#F0C08A', 1, { opacity: 0.8 }) +
        line('M95 107.4 L98.6 102.2', INK, 5.6) + line('M95 107.4 L98.6 102.2', '#D9D4E8', 3.6) +
        path('M97.2 102.6 C95.6 98 98.4 92.4 105 88.4 C105.8 94 104.2 99.2 100.8 104.4 Z', '#4A3A2E', { 'stroke-width': 1.7 }) +
        path('M101.6 94.6 C102.4 91.6 103.6 89.8 105 88.4 C105.2 91.2 104.6 93.6 103.4 96 Z', '#E5566B', { 'stroke-width': 0 }) + el('circle', { cx: 104.6, cy: 99.6, r: 1.3, fill: '#E5566B' }),
      handL: () =>
        path('M17 127 C16 119 24 113.5 32.5 114.5 C41 115.5 46 121 45 127.5 C44 133.5 37 137.5 29.5 136.5 C26.5 136 26.5 132.5 23.5 132.5 C19.5 132.5 17.2 130.5 17 127 Z', '#E9C48A', { 'stroke-width': 1.9 }) +
        line('M21 125 C22 120 27 117 32 117', '#FFFFFF', 1.4, { opacity: 0.45 }) +
        el('circle', { cx: 24, cy: 123, r: 2.4, fill: '#E5566B', stroke: INK, 'stroke-width': 0.8 }) +
        el('circle', { cx: 30, cy: 119.5, r: 2.4, fill: '#FFD966', stroke: INK, 'stroke-width': 0.8 }) +
        el('circle', { cx: 37, cy: 119.5, r: 2.4, fill: '#7CC8FF', stroke: INK, 'stroke-width': 0.8 }) +
        el('circle', { cx: 26.5, cy: 130, r: 2.2, fill: '#5ED3A0', stroke: INK, 'stroke-width': 0.8 }),
    },
  },
  'hand.uzi': {
    cat: 'hand', name: 'Узи', code: true,
    layers: {
      handR: () =>
        el('rect', { x: 82, y: 127, width: 6, height: 11, rx: 2, fill: '#3A3346', stroke: INK, 'stroke-width': 1.8 }) +
        el('rect', { x: 91.5, y: 128, width: 4.6, height: 10, rx: 1.6, fill: '#2E2438', stroke: INK, 'stroke-width': 1.8 }) +
        el('rect', { x: 78.5, y: 120.5, width: 23, height: 8.5, rx: 2.6, fill: '#4A4258', stroke: INK, 'stroke-width': 1.9 }) +
        el('rect', { x: 101, y: 122.6, width: 5.5, height: 3.6, rx: 1.2, fill: '#3A3346', stroke: INK, 'stroke-width': 1.6 }) +
        line('M81.5 123 H98', '#8E8AA6', 1.1, { opacity: 0.8 }),
    },
  },
};

export const CAT_ORDER: Cat[] = ['hair', 'eyes', 'hat', 'top', 'bottom', 'shoes', 'back', 'hand'];

export type Look = {
  skin: number;
  hair: Slot;
  eyes: Slot;
  hat?: Slot | null;
  top: Slot;
  bottom?: Slot | null;
  shoes: Slot;
  back?: Slot | null;
  hand?: Slot | null;
  face?: Slot | null;
};

export const LOOKS: Record<string, Look> = {
  boy: { skin: 1, hair: { id: 'hair.vikhor' }, eyes: { id: 'eyes.classic' }, top: { id: 'top.hoodie' }, bottom: { id: 'bottom.pants' }, shoes: { id: 'shoes.kedy' } },
  girl: { skin: 1, hair: { id: 'hair.long' }, eyes: { id: 'eyes.lashes' }, hat: { id: 'hat.bow' }, top: { id: 'top.dress' }, shoes: { id: 'shoes.sapozhki', c: 'coal' } },
  nb: { skin: 1, hair: { id: 'hair.fluffy' }, eyes: { id: 'eyes.classic' }, top: { id: 'top.hoodie', c: 'mint' }, bottom: { id: 'bottom.pants' }, shoes: { id: 'shoes.kedy' } },
};

function colorOf(slot: Slot | null | undefined): string {
  if (!slot) return '#000';
  const it = ITEMS[slot.id];
  const key = slot.c ?? it?.def ?? 'coal';
  const pal = it?.palette === 'hair' ? HAIR : CLOTH;
  return pal[key]?.[1] ?? CLOTH[key]?.[1] ?? '#888';
}

export type Pose = 'idle' | 'wave' | 'hug' | 'fallen' | 'run' | 'cheer';
export type Opts = { emotion?: FaceKey; value?: number; pose?: Pose; look?: number; mog?: boolean; eyesClosed?: boolean; noShadow?: boolean };

// ---------- лицо ----------
function face(look: Look, o: Opts, skin: string): string {
  const emotion = o.emotion ?? 'joy';
  const value = o.value ?? 40;
  const ek = look.eyes.id === 'eyes.azure' ? 1.5 : 1.3;
  const f = faceModel(emotion, value, { bare: true, eyes: ek, look: o.look ?? 0, blink: o.eyesClosed });
  const p = faceParams(emotion, value);
  const k = ek;
  const style = look.eyes.id.split('.')[1];
  const eyeCol = style === 'azure' ? '#4F9BFF' : colorOf(look.eyes);
  const isInk = eyeCol === CLOTH.coal[1] && style !== 'azure';
  let out = '';
  // румянец
  out += g(
    el('ellipse', { cx: f.cheekL, cy: f.cheekY, rx: 7.5, ry: 4.4, fill: '#FF4F86', opacity: Math.max(f.blushOp, 0.18) }) +
      el('ellipse', { cx: f.cheekR, cy: f.cheekY, rx: 7.5, ry: 4.4, fill: '#FF4F86', opacity: Math.max(f.blushOp, 0.18) }),
    { transform: `rotate(${f.rot} 50 56)` },
  );
  // глаза
  if (f.eyesOp > 0 && isNewEye(style)) {
    out += g(eyeArt(style, f, eyeCol, uid('ey')), { opacity: f.eyesOp, transform: `rotate(${f.rot} 50 56)` });
  }
  if (f.eyesOp > 0 && !isNewEye(style)) {
    const cx0 = 50 + (o.look ?? 0);
    const edx = p.edx * 1.1;
    const w = p.ew * k;
    const topMid = p.ey + 0.375 * (p.eto + p.eti) * k;
    const botMid = p.ey + 0.375 * (p.ebo + p.ebi) * k;
    const h = botMid - topMid;
    const gid = uid('az');
    let eyes = '';
    if (style === 'azure') {
      eyes += el('defs', {}, el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, el('stop', { offset: 0, 'stop-color': '#C9F1FF' }) + el('stop', { offset: 1, 'stop-color': '#3A7BFF' })));
    }
    const fill = style === 'azure' ? `url(#${gid})` : isInk ? INK : eyeCol;
    eyes += el('path', { d: f.eyeL, fill, stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' });
    eyes += el('path', { d: f.eyeR, fill, stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' });
    if (style === 'azure' && h > 3) {
      eyes = '';
      eyes += el('defs', {}, el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
        el('stop', { offset: 0, 'stop-color': '#3B4A66' }) + el('stop', { offset: 0.55, 'stop-color': '#6E86A8' }) + el('stop', { offset: 1, 'stop-color': '#CFDCEB' })));
      [-1, 1].forEach((sd) => {
        const cx = cx0 + sd * edx;
        const d = sd === -1 ? f.eyeL : f.eyeR;
        eyes += el('path', { d, fill: `url(#${gid})`, stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' });
        eyes += el('ellipse', { cx: cx.toFixed(2), cy: (topMid + h * 0.48).toFixed(2), rx: (w * 0.46).toFixed(2), ry: (h * 0.38).toFixed(2), fill: '#121033' });
        eyes += el('circle', { cx: (cx - w * 0.34).toFixed(2), cy: (topMid + h * 0.3).toFixed(2), r: Math.max(1.8, w * 0.32).toFixed(2), fill: '#FFFFFF' });
        eyes += el('circle', { cx: (cx + w * 0.32).toFixed(2), cy: (topMid + h * 0.72).toFixed(2), r: (w * 0.15).toFixed(2), fill: '#FFFFFF', opacity: 0.9 });
        const xo = cx + sd * w, xi = cx - sd * w, cy = p.ey;
        eyes += line(`M${xo.toFixed(2)} ${cy} C${xo.toFixed(2)} ${(cy + p.eto * k).toFixed(2)} ${xi.toFixed(2)} ${(cy + p.eti * k).toFixed(2)} ${xi.toFixed(2)} ${cy}`, INK, 3);
        eyes += line(`M${(xo - sd * 0.5).toFixed(2)} ${(cy - 2).toFixed(2)} l${(sd * 3.4).toFixed(2)} -2.6`, INK, 2);
      });
    } else {
    if (!isInk && h > 3) {
      [cx0 - edx, cx0 + edx].forEach((cx) => {
        eyes += el('ellipse', { cx: cx.toFixed(2), cy: (topMid + h * 0.56).toFixed(2), rx: (w * 0.48).toFixed(2), ry: (h * 0.34).toFixed(2), fill: INK });
      });
    }
    const big = style === 'sparkle' ? 1.4 : 1;
    eyes += el('circle', { cx: f.hl.lx, cy: f.hl.y, r: (f.hl.r * big).toFixed(2), fill: '#FFFFFF', opacity: f.hl.op });
    eyes += el('circle', { cx: f.hl.rx, cy: f.hl.y, r: (f.hl.r * big).toFixed(2), fill: '#FFFFFF', opacity: f.hl.op });
    if (style === 'sparkle') {
      eyes += el('circle', { cx: f.s2.lx, cy: f.s2.y, r: 1.5, fill: '#FFFFFF', opacity: f.hl.op });
      eyes += el('circle', { cx: f.s2.rx, cy: f.s2.y, r: 1.5, fill: '#FFFFFF', opacity: f.hl.op });
    }
    }
    if (style === 'lashes') {
      [-1, 1].forEach((s) => {
        const cx = cx0 + s * edx;
        const xo = cx + s * w;
        eyes += line(`M${(xo - s * 1.2).toFixed(2)} ${(topMid + h * 0.15).toFixed(2)} l${(s * 3.2).toFixed(2)} -3.2 M${(xo - s * 3.6).toFixed(2)} ${(topMid - 0.4).toFixed(2)} l${(s * 2).toFixed(2)} -3.4`, INK, 1.8);
      });
    }
    if (style === 'sleepy' && h > 3) {
      [-1, 1].forEach((s) => {
        const cx = cx0 + s * edx;
        const lid = topMid + h * 0.42;
        eyes += el('path', { d: `M${(cx - w - 2).toFixed(2)} ${(topMid - 3).toFixed(2)} H${(cx + w + 2).toFixed(2)} V${lid.toFixed(2)} H${(cx - w - 2).toFixed(2)} Z`, fill: skin });
        eyes += line(`M${(cx - w - 0.6).toFixed(2)} ${lid.toFixed(2)} Q${cx.toFixed(2)} ${(lid + 1.4).toFixed(2)} ${(cx + w + 0.6).toFixed(2)} ${lid.toFixed(2)}`, INK, 2.2);
      });
    }
    out += g(eyes, { opacity: f.eyesOp, transform: `rotate(${f.rot} 50 56)` });
  }
  if (f.heartEyes.op > 0) {
    out += g(
      [f.heartEyes.lx, f.heartEyes.rx]
        .map((x) => el('path', { d: FACE_PATHS.heart, transform: `translate(${x} ${f.heartEyes.y}) scale(${f.heartEyes.scale})`, fill: '#F0325F', stroke: INK, 'stroke-width': 1.3 }))
        .join(''),
      { opacity: f.heartEyes.op },
    );
  }
  if (f.browOp > 0) {
    out += g(line(f.browL, INK, 2.6) + line(f.browR, INK, 2.6), { opacity: f.browOp, transform: `rotate(${f.rot} 50 56)` });
  }
  out += g(
    el('path', { d: f.mouth, fill: '#7A2940', stroke: INK, 'stroke-width': 2.3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }) +
      (f.tongue.op > 0 ? el('ellipse', { cx: f.tongue.x, cy: f.tongue.y, rx: f.tongue.rx, ry: f.tongue.ry, fill: '#FF7D93', opacity: f.tongue.op }) : ''),
    { transform: `rotate(${f.rot} 50 56)` },
  );
  FACE_SPOTS.hearts.forEach(([x, y, s], i) => {
    if (f.hearts[i] > 0) out += el('path', { d: FACE_PATHS.heart, transform: `translate(${x} ${y}) scale(${s})`, fill: '#FF4D7A', stroke: INK, 'stroke-width': 1.3, opacity: f.hearts[i] });
  });
  FACE_SPOTS.sparkles.forEach(([x, y, s], i) => {
    if (f.sparkles[i] > 0) out += el('path', { d: FACE_PATHS.sparkle, transform: `translate(${x} ${y}) scale(${s})`, fill: '#FFF6C2', stroke: '#E0A93A', 'stroke-width': 0.9, opacity: f.sparkles[i] });
  });
  FACE_SPOTS.zzz.forEach(([x, y, s], i) => {
    if (f.zzz[i] > 0) out += el('path', { d: FACE_PATHS.z, transform: `translate(${x} ${y}) scale(${s})`, fill: 'none', stroke: '#D4CCFF', 'stroke-width': 2.2, 'stroke-linecap': 'round', opacity: f.zzz[i] });
  });
  return g(out, { transform: 'translate(12.5 24.5) scale(0.95)' });
}

// ---------- сам чибик (группа в координатах 120×170) ----------
export function chibi(look: Look, o: Opts = {}): string {
  const items = (['back', 'hair', 'hat', 'face', 'top', 'bottom', 'shoes', 'hand'] as const)
    .map((k) => look[k] as Slot | null | undefined)
    .filter(Boolean) as Slot[];
  const skin = items.map((s) => ITEMS[s.id]?.skin).find(Boolean) ?? SKIN[look.skin] ?? SKIN[1];
  // Живые слои (качание, мерцание) в макете помечены классом — их оживляет CSS страницы
  const ANIMATED = new Set(['back', 'backFx', 'handFx']);
  const layer = (name: string, extra: Partial<Ctx> = {}) =>
    items
      .map((s) => {
        const it = ITEMS[s.id];
        const fn = it?.layers[name];
        if (!fn) return '';
        const art = fn({ col: colorOf(s), skin, ...extra });
        if (!it.anim || !ANIMATED.has(name) || (name === 'back' && it.anim !== 'sway')) return art;
        const [px, py] = it.pivot ?? [60, 100];
        return g(art, { class: `a-${it.anim}`, style: `transform-origin:${px}px ${py}px;transform-box:view-box` });
      })
      .join('');
  const top = ITEMS[look.top.id];
  const covers = Boolean(top?.coversBottom);
  const bottom = covers ? null : look.bottom ? ITEMS[look.bottom.id] : null;
  const bottomCol = colorOf(look.bottom);
  const hover = items.some((s) => ITEMS[s.id]?.hover);
  const pose = o.pose ?? 'idle';

  // ноги
  const leg = (side: 'L' | 'R') => {
    const L = side === 'L' ? P.legL : P.legR;
    let s = '';
    if (bottom?.layers.leg) s += bottom.layers.leg({ col: bottomCol, skin, x: L.x });
    else s += el('rect', { x: L.x, y: L.y, width: L.w, height: L.h, rx: 5, fill: skin, stroke: INK, 'stroke-width': SW });
    const sh = ITEMS[look.shoes.id];
    s += sh?.layers.shoe ? sh.layers.shoe({ col: colorOf(look.shoes), skin, side, x: L.x }) : '';
    const lift = pose === 'run' ? (side === 'L' ? -5 : 1) : 0;
    return g(s, lift ? { transform: `translate(0 ${lift})` } : {});
  };

  // руки
  const sleeveCol = top?.sleeveColor ? CLOTH[top.sleeveColor][1] : colorOf(look.top);
  const arm = (side: 'L' | 'R') => {
    const x = side === 'L' ? 33.5 : 75.5;
    const hx = side === 'L' ? 39 : 81;
    const base = side === 'L' ? 'rotate(16 39 103)' : 'rotate(-16 81 103)';
    let rot = 0;
    if (pose === 'wave' && side === 'R') rot = -112;
    if (pose === 'hug') rot = side === 'L' ? 70 : -70;
    if (pose === 'cheer') rot = side === 'L' ? 140 : -140;
    if (pose === 'run') rot = side === 'L' ? -28 : 30;
    let s = el('rect', { x, y: 100, width: 11, height: 24, rx: 5.5, fill: skin, stroke: INK, 'stroke-width': SW });
    if (top?.sleeve === 'short') s += el('rect', { x, y: 100, width: 11, height: 11.5, rx: 5, fill: sleeveCol, stroke: INK, 'stroke-width': SW });
    else s += el('rect', { x, y: 100, width: 11, height: 24, rx: 5.5, fill: sleeveCol, stroke: INK, 'stroke-width': SW });
    if (top?.cuff && top.sleeve !== 'short') s += el('rect', { x: x - 0.4, y: 117.5, width: 11.8, height: 5.5, rx: 2.6, fill: top.cuff, stroke: INK, 'stroke-width': 1.6 });
    s += layer(side === 'L' ? 'handL' : 'handR');
    if (side === 'R') s += layer('handFx');
    s += el('circle', { cx: hx, cy: 126, r: 5.2, fill: skin, stroke: INK, 'stroke-width': 2 });
    const pivot = side === 'L' ? '39 103' : '81 103';
    return g(g(s, { transform: base }), rot ? { transform: `rotate(${rot} ${pivot})` } : {});
  };

  let body = '';
  body += layer('back');
  body += layer('backFx');
  body += layer('hairBack');
  body += leg('L') + leg('R');
  body += bottom?.layers.under ? bottom.layers.under({ col: bottomCol, skin }) : '';
  body += layer('body');
  body += layer('front');
  body += arm('L') + arm('R');
  // голова
  body += el('circle', { cx: 18, cy: 70, r: 6.5, fill: skin, stroke: INK, 'stroke-width': SW });
  body += el('circle', { cx: 102, cy: 70, r: 6.5, fill: skin, stroke: INK, 'stroke-width': SW });
  body += line('M15.6 70.5 a2.6 2.6 0 0 1 3.4 -2.6 M104.4 70.5 a2.6 2.6 0 0 0 -3.4 -2.6', dark(skin, 0.2), 1.4);
  body += el('ellipse', { cx: 60, cy: 64, rx: 43, ry: 40, fill: skin, stroke: INK, 'stroke-width': SW });
  body += face(look, o, skin);
  body += layer('mask');
  if (o.mog) {
    body += el('path', { d: 'M21 76 C28 93 43 101 60 103.4 C77 101 92 93 99 76 C93 90 79 98.5 60 100 C41 98.5 27 90 21 76 Z', fill: INK, opacity: 0.28 }) +
      el('path', { d: 'M25 68 C29 77 35 82 43 84 C35 80 30 75 27 67 Z M95 68 C91 77 85 82 77 84 C85 80 90 75 93 67 Z', fill: INK, opacity: 0.38 }) +
      line('M30 88 L43 98 M90 88 L77 98', INK, 1.6, { opacity: 0.55 });
  }
  body += layer('hairFront');
  body += layer('hat');
  body += layer('over');

  const lift = hover ? -9 : 0;
  let inner = g(body, lift ? { transform: `translate(0 ${lift})` } : {});
  if (pose === 'run') inner = g(inner, { transform: 'rotate(8 60 150)' });
  if (pose === 'fallen') inner = g(inner, { transform: 'translate(47 -40) rotate(-90 60 156)' });
  const shadow = o.noShadow
    ? ''
    : el('ellipse', { cx: 60, cy: 163, rx: hover ? 20 : 27, ry: hover ? 3.6 : 4.5, fill: '#1B1426', opacity: hover ? 0.16 : 0.22 });
  return shadow + inner;
}

// Отдельная картинка чибика
export function chibiSvg(look: Look, o: Opts = {}, size = 200): string {
  const vb = '-22 -30 164 210';
  const h = Math.round((size * 196) / 164);
  return el('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: vb, width: size, height: h }, chibi(look, o));
}

// Только одна вещь (для плиток гардероба)
export function itemSvg(id: string, c?: string, size = 96): string {
  const it = ITEMS[id];
  const col = colorOf({ id, c });
  const skin = SKIN[1];
  let s = '';
  let vb = '0 0 120 170';
  const ghostHead = el('ellipse', { cx: 60, cy: 64, rx: 43, ry: 40, fill: 'rgba(255,255,255,0.08)', stroke: 'rgba(255,255,255,0.18)', 'stroke-width': 1.5, 'stroke-dasharray': '4 4' });
  if (it.cat === 'hat') {
    vb = id === 'hat.halo' ? '20 -24 80 60' : id === 'hat.bow' ? '60 -4 56 56' : '0 -6 120 72';
    s = (id === 'hat.halo' ? '' : ghostHead) + (it.layers.hat?.({ col, skin }) ?? '') + (it.layers.over?.({ col, skin }) ?? '');
  }
  return el('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: vb, width: size, height: size, preserveAspectRatio: 'xMidYMid meet' }, s);
}

// Только голова (для иконок): уши, голова, лицо, волосы, шляпа
export function head(look: Look, o: Opts = {}): string {
  const skin = SKIN[look.skin] ?? SKIN[1];
  const items = (['hair', 'hat', 'face'] as const).map((k) => look[k] as Slot | null | undefined).filter(Boolean) as Slot[];
  const layer = (name: string) =>
    items.map((s) => { const fn = ITEMS[s.id]?.layers[name]; return fn ? fn({ col: colorOf(s), skin }) : ''; }).join('');
  let b = layer('hairBack');
  b += el('circle', { cx: 18, cy: 70, r: 6.5, fill: skin, stroke: INK, 'stroke-width': SW });
  b += el('circle', { cx: 102, cy: 70, r: 6.5, fill: skin, stroke: INK, 'stroke-width': SW });
  b += el('ellipse', { cx: 60, cy: 64, rx: 43, ry: 40, fill: skin, stroke: INK, 'stroke-width': SW });
  b += face(look, o, skin);
  b += layer('mask');
  b += layer('hairFront') + layer('hat') + layer('over');
  return b;
}
