// Вещи 0.2.1: новые причёски, глаза, шляпы, «Лицо», одежда, обувь, спина, предметы и костюмы Хэллоуина.
// Подключается к ITEMS из chibi.ts (import './items2.ts'); каталог и макет берут их оттуда же.
// Костюмы (code: true) выдаются секретными кодами — сами коды только в базе.
import { FACE_PATHS } from '../../src/lib/face.ts';
import { ITEMS, path, line, el, g, dark, light, contrast, P, HOODIE, DRESS, GIRL_FRONT, SW, shine, type Item } from './chibi.ts';

const INK = '#2B2035';
const circle = (cx: number, cy: number, r: number, fill: string, sw = SW, o: Record<string, string | number> = {}) =>
  el('circle', { cx, cy, r, fill, stroke: sw ? INK : undefined, 'stroke-width': sw || undefined, ...o });
const rect = (x: number, y: number, w: number, h: number, rx: number, fill: string, sw = SW) =>
  el('rect', { x, y, width: w, height: h, rx, fill, stroke: sw ? INK : undefined, 'stroke-width': sw || undefined });
const mirror = (s: string) => g(s, { transform: 'translate(120 0) scale(-1 1)' });
const shoeOf = (side?: 'L' | 'R') => (side === 'L' ? P.shoeL : P.shoeR);
const soleOf = (side?: 'L' | 'R', y = 153.2) => (side === 'L' ? `M45 ${y} H59` : `M61 ${y} H75`);
const flower = (x: number, y: number, c: string, r = 2.6) =>
  [0, 72, 144, 216, 288]
    .map((a) => circle(+(x + 1.25 * r * Math.sin((a * Math.PI) / 180)).toFixed(2), +(y - 1.25 * r * Math.cos((a * Math.PI) / 180)).toFixed(2), r, c, 0.9))
    .join('') + circle(x, y, r * 0.7, '#FFB347', 0);
const star5 = (x: number, y: number, s: number, fill: string, sw = 1) =>
  el('path', { d: 'M0 -6 L1.8 -1.8 L6 -1.6 L2.8 1.2 L3.8 5.6 L0 3.2 L-3.8 5.6 L-2.8 1.2 L-6 -1.6 L-1.8 -1.8 Z', fill, stroke: INK, 'stroke-width': sw, 'stroke-linejoin': 'round', transform: `translate(${x} ${y}) scale(${s})` });
const sparkle = (x: number, y: number, s: number, fill: string, o: Record<string, string | number> = {}) =>
  el('path', { d: FACE_PATHS.sparkle, fill, transform: `translate(${x} ${y}) scale(${s})`, ...o });

const ORANGE = '#FF9A3D';
const STEM = '#4E8A3E';
const CAPE_BACK = 'M41 97 C31 110 25 130 22 153 C34 158 48 157 60 155 C72 157 86 158 98 153 C95 130 89 110 79 97 Z';

const NEW: Record<string, Item> = {
  // ----- причёски -----
  'hair.bun': {
    cat: 'hair', name: 'Пучок', def: 'chestnut', palette: 'hair',
    layers: {
      hairBack: ({ col }) =>
        path('M14 68 C10 36 32 16 60 16 C88 16 110 36 106 68 C106 76 104 82 100 86 L20 86 C16 82 14 76 14 68 Z', col) +
        circle(60, 11, 12.5, col) + line('M52 6 C56 2 63 1 67 4', '#FFFFFF', 2.2, { opacity: 0.3 }) +
        el('ellipse', { cx: 60, cy: 22, rx: 9, ry: 3.2, fill: '#FF6B8A', stroke: INK, 'stroke-width': 1.6 }),
      hairFront: ({ col }) => path(GIRL_FRONT, col) + shine('M31 31 C39 23 50 20 60 20'),
    },
  },
  'hair.braids': {
    cat: 'hair', name: 'Косички', def: 'caramel', palette: 'hair',
    layers: {
      hairBack: ({ col }) => {
        const braid = [[17, 84], [15, 95], [14, 106], [14, 116]].map(([x, y]) => el('ellipse', { cx: x, cy: y, rx: 7.2, ry: 6.4, fill: col, stroke: INK, 'stroke-width': SW })).join('') +
          path('M10 124 C10 130 12 134 14 136 C16 134 18 130 18 124 Z', col, { 'stroke-width': 1.8 }) +
          el('ellipse', { cx: 14, cy: 122.5, rx: 5, ry: 3, fill: '#5ED3A0', stroke: INK, 'stroke-width': 1.6 });
        return path('M14 68 C10 36 32 16 60 16 C88 16 110 36 106 68 C106 74 104 78 101 80 L19 80 C16 78 14 74 14 68 Z', col) + braid + mirror(braid);
      },
      hairFront: ({ col }) => path(GIRL_FRONT, col) + shine('M31 31 C39 23 50 20 60 20'),
    },
  },
  'hair.curly': {
    cat: 'hair', name: 'Кудри', def: 'chocolate', palette: 'hair',
    layers: {
      hairBack: ({ col }) =>
        [[22, 50, 14], [17, 70, 13], [21, 90, 11], [98, 50, 14], [103, 70, 13], [99, 90, 11], [36, 26, 15], [60, 17, 16], [84, 26, 15]]
          .map(([x, y, r]) => circle(x, y, r, col)).join(''),
      hairFront: ({ col }) =>
        path('M17 58 C14 32 34 17 60 17 C86 17 106 32 103 58 Z', col, { stroke: 'none' }) +
        [[22, 52, 8], [32, 42, 9.5], [46, 37, 10], [60, 35, 10], [74, 37, 10], [88, 42, 9.5], [98, 52, 8]].map(([x, y, r]) => circle(x, y, r, col)).join('') +
        line('M40 26 C46 22 54 21 60 22', '#FFFFFF', 2.4, { opacity: 0.3 }),
    },
  },
  'hair.buzz': {
    cat: 'hair', name: 'Ёжик', def: 'coal', palette: 'hair',
    layers: {
      hairFront: ({ col }) =>
        path('M18 54 C17 32 35 20 60 20 C85 20 103 32 102 54 C99 48 95 46 91 48 L87 41 L82 47 L77 39 L72 46 L66 38 L60 45 L54 38 L48 46 L43 39 L38 47 L33 41 L29 48 C25 46 21 48 18 54 Z', col) +
        line('M34 30 C42 25 50 23 58 23', '#FFFFFF', 2.2, { opacity: 0.28 }),
    },
  },
  'hair.wavy': {
    cat: 'hair', name: 'Волнистые', def: 'ginger', palette: 'hair',
    layers: {
      hairBack: ({ col }) =>
        path('M14 66 C10 34 32 15 60 15 C88 15 110 34 106 66 C108 80 112 90 108 100 C104 108 110 116 106 124 C102 132 92 133 88 127 L32 127 C28 133 18 132 14 124 C10 116 16 108 12 100 C8 90 12 80 14 66 Z', col) +
        line('M20 100 C16 108 20 114 18 120 M100 100 C104 108 100 114 102 120', dark(col, 0.25), 1.4, { opacity: 0.6 }),
      hairFront: ({ col }) =>
        path('M15 66 C11 36 32 15 60 15 C88 15 109 36 105 66 C103 58 100 52 96 48 C88 52 76 50 66 41 C58 50 44 54 30 52 C24 56 18 60 15 66 Z', col) +
        path('M16 62 C11 74 15 84 13 94 C12 100 15 106 19 108 C22 100 25 92 24 84 C24 76 24 68 23 60 Z', col) +
        path('M104 62 C109 74 105 84 107 94 C108 100 105 106 101 108 C98 100 95 92 96 84 C96 76 96 68 97 60 Z', col) +
        shine('M30 32 C38 24 48 20 58 20'),
    },
  },
  'hair.vamp': {
    cat: 'hair', name: 'Зачёс вампира', def: 'coal', palette: 'hair', code: true,
    layers: {
      hairBack: ({ col }) => path('M14 66 C10 34 32 15 60 15 C88 15 110 34 106 66 C106 74 104 80 100 84 L20 84 C16 80 14 74 14 66 Z', col),
      hairFront: ({ col }) =>
        path('M16 62 C12 34 32 15 60 15 C88 15 108 34 104 62 C101 52 95 45 86 42 C76 39 67 41 60 51 C53 41 44 39 34 42 C25 45 19 52 16 62 Z', col) +
        line('M28 36 C38 27 48 24 57 26 M63 26 C72 24 82 27 92 36', light(col, 0.3), 1.5, { opacity: 0.6 }),
    },
  },
  'hair.frank': {
    cat: 'hair', name: 'Плоская стрижка', def: 'coal', palette: 'hair', code: true,
    layers: {
      hairFront: ({ col }) =>
        path('M17 52 L16 22 C16 16 20 12 26 12 L94 12 C100 12 104 16 104 22 L103 52 C100 47 96 47 93 50 L89 44 L84 51 L79 44 L74 51 L68 44 L62 51 L56 44 L50 51 L44 44 L38 51 L32 44 L27 50 C24 47 20 47 17 52 Z', col) +
        line('M24 18 H96', light(col, 0.3), 1.6, { opacity: 0.55 }),
    },
  },

  // ----- глаза (стиль рисует src/lib/eyes.ts) -----
  'eyes.cat': { cat: 'eyes', name: 'Кошачьи', def: 'mint', palette: 'cloth', layers: {} },
  'eyes.star': { cat: 'eyes', name: 'Звёздочки', def: 'sky', palette: 'cloth', layers: {} },
  'eyes.happy': { cat: 'eyes', name: 'Весёлые', def: 'coal', palette: 'cloth', layers: {} },
  'eyes.wink': { cat: 'eyes', name: 'Подмигивание', def: 'coal', palette: 'cloth', layers: {} },
  'eyes.heart': { cat: 'eyes', name: 'Сердечки', def: 'coal', palette: 'cloth', layers: {} },
  'eyes.vamp': { cat: 'eyes', name: 'Глаза вампира', code: true, layers: {} },

  // ----- шляпы -----
  'hat.ears': {
    cat: 'hat', name: 'Ушки котика', def: 'coal', palette: 'cloth',
    layers: {
      hat: ({ col }) => {
        const ear = path('M23 38 L20 6 L48 22 Z', col) + path('M27 30 L26 14 L40 22 Z', '#FF9EBB', { stroke: 'none' });
        return ear + mirror(ear) + line('M19 46 C22 26 40 15 60 15 C80 15 98 26 101 46', INK, 6.4) + line('M19 46 C22 26 40 15 60 15 C80 15 98 26 101 46', col, 3.6);
      },
    },
  },
  'hat.wreath': {
    cat: 'hat', name: 'Венок', def: 'strawberry', palette: 'cloth',
    layers: {
      hat: ({ col }) => {
        const pts: [number, number, number][] = [[20, 46, -60], [26, 33, -40], [36, 24, -25], [48, 19, -10], [60, 17, 0], [72, 19, 10], [84, 24, 25], [94, 33, 40], [100, 46, 60]];
        const leaves = pts.map(([x, y, a]) => el('ellipse', { cx: x, cy: y, rx: 7, ry: 3.6, fill: '#5ED3A0', stroke: INK, 'stroke-width': 1.5, transform: `rotate(${a + 90} ${x} ${y})` })).join('');
        const fl = [[23, 40, col], [42, 21, '#FFFFFF'], [60, 16, col], [78, 21, '#FFD966'], [97, 40, col]] as const;
        return leaves + fl.map(([x, y, c]) => flower(x, y, c, 3.2)).join('');
      },
    },
  },
  'hat.tophat': {
    cat: 'hat', name: 'Цилиндр', def: 'coal', palette: 'cloth',
    layers: {
      hat: ({ col }) =>
        g(
          path('M37 34 L39 -4 C39 -7 42 -9 45 -9 L75 -9 C78 -9 81 -7 81 -4 L83 34 Z', col) +
            path('M38 21 L82 21 L82.7 30 L37.4 30 Z', contrast(col), { 'stroke-width': 1.6 }) +
            path('M12 37 C12 31 34 29 60 29 C86 29 108 31 108 37 C108 43 86 45 60 45 C34 45 12 43 12 37 Z', dark(col, 0.12)) +
            line('M44 -4 V18', light(col, 0.3), 2, { opacity: 0.45 }),
          { transform: 'rotate(-6 60 30)' },
        ),
    },
  },
  'hat.ushanka': {
    cat: 'hat', name: 'Ушанка', def: 'blueberry', palette: 'cloth',
    layers: {
      hat: ({ col }) => {
        const fur = '#F4F0FF';
        const flap = path('M14 48 C11 62 13 76 19 86 C25 86 30 80 31 70 L32 48 Z', fur);
        return flap + mirror(flap) +
          path('M18 46 C16 22 36 7 60 7 C84 7 104 22 102 46 Z', col) +
          line('M60 8 V36', dark(col, 0.22), 1.4, { opacity: 0.6 }) +
          path('M15 46 C15 37 30 33 60 33 C90 33 105 37 105 46 C105 55 90 57 60 57 C30 57 15 55 15 46 Z', fur) +
          line('M24 42 l3 3 M36 39 l3 3 M50 38 l3 3 M66 38 l3 3 M80 39 l3 3 M93 42 l3 3', '#C9C0E0', 1.3);
      },
    },
  },
  'hat.pumpkin': {
    cat: 'hat', name: 'Шапка-тыква', code: true,
    layers: {
      hat: () =>
        path('M60 9 C62 2 66 -3 72 -4 C70 0 67 4 66 10 Z', STEM, { 'stroke-width': 1.8 }) +
        path('M66 4 C72 -2 82 -2 86 4 C80 8 72 8 66 4 Z', '#6FC067', { 'stroke-width': 1.6 }) +
        path('M16 50 C12 24 34 8 60 8 C86 8 108 24 104 50 C96 55 86 53 80 49 C72 55 48 55 40 49 C34 53 24 55 16 50 Z', ORANGE) +
        line('M40 13 C34 24 33 38 36 50 M60 9 V51 M80 13 C86 24 87 38 84 50', dark(ORANGE, 0.22), 1.6, { opacity: 0.7 }) +
        line('M28 22 C34 16 42 13 50 12', '#FFFFFF', 2.6, { opacity: 0.35 }),
    },
  },
  'hat.witch': {
    cat: 'hat', name: 'Шляпа ведьмы', code: true,
    layers: {
      hat: () =>
        path('M8 40 C8 32 32 29 60 29 C88 29 112 32 112 40 C112 47 88 49 60 49 C32 49 8 47 8 40 Z', '#3A2E5A') +
        path('M30 38 C40 28 46 6 56 -12 C60 -19 71 -24 82 -18 C73 -16 67 -10 65 0 C63 14 78 28 92 38 Z', '#4A3A6E') +
        path('M33 31 C50 34 72 34 88 31 L91 37 C72 41 50 41 30 37 Z', '#9B6BFF', { 'stroke-width': 1.6 }) +
        rect(55, 30.5, 9, 8, 1.6, '#FFD45E', 1.6) +
        star5(48, 12, 0.6, '#FFD966', 0.9),
    },
  },

  // ----- лицо -----
  'face.glasses': {
    cat: 'face', name: 'Круглые очки', def: 'coal', palette: 'cloth',
    layers: {
      mask: ({ col }) => {
        const fr = 'M35 68 a9.5 9.5 0 1 0 19 0 a9.5 9.5 0 1 0 -19 0 Z M66 68 a9.5 9.5 0 1 0 19 0 a9.5 9.5 0 1 0 -19 0 Z';
        const arms = 'M54 67 Q60 63 66 67 M35 67 L21 64 M85 67 L99 64';
        return el('path', { d: fr, fill: '#FFFFFF', 'fill-opacity': 0.14 }) +
          line(fr + ' ' + arms, INK, 4.4) + line(fr + ' ' + arms, col, 2.2) +
          line('M39 63 l4 -3 M70 63 l4 -3', '#FFFFFF', 1.6, { opacity: 0.8 });
      },
    },
  },
  'face.sunglasses': {
    cat: 'face', name: 'Солнечные очки', def: 'cherry', palette: 'cloth',
    layers: {
      mask: ({ col }) => {
        const lens = 'M33 63 C33 60 35 59 38 59 H52 C55 59 56 60 56 63 C56 72 52 77 45 77 C38 77 33 72 33 63 Z';
        return line('M56 63 Q60 60 64 63 M33 62 L20 60 M87 62 L100 60', INK, 4.4) + line('M56 63 Q60 60 64 63 M33 62 L20 60 M87 62 L100 60', col, 2.2) +
          path(lens, '#2E2438', { stroke: col, 'stroke-width': 2.6 }) + mirror(path(lens, '#2E2438', { stroke: col, 'stroke-width': 2.6 })) +
          line('M38 64 l6 -2.4 M69 64 l6 -2.4', '#FFFFFF', 2, { opacity: 0.55 });
      },
    },
  },
  'face.freckles': {
    cat: 'face', name: 'Веснушки',
    layers: {
      mask: () => {
        const dots = [[30, 79], [35, 82], [33, 76], [39, 79], [36, 86]].map(([x, y]) => circle(x, y, 1.15, '#B5653F', 0, { opacity: 0.75 })).join('');
        return dots + mirror(dots);
      },
    },
  },
  'face.plaster': {
    cat: 'face', name: 'Пластырь',
    layers: {
      mask: () =>
        g(rect(-9, -3.6, 18, 7.2, 3.4, '#FFD3A8', 1.6) + rect(-3.4, -2.6, 6.8, 5.2, 1.2, '#F4B98A', 0) +
          [[-1.6, -1], [1.6, -1], [-1.6, 1.2], [1.6, 1.2]].map(([x, y]) => circle(x, y, 0.5, '#C98E68', 0)).join(''),
          { transform: 'translate(87 83) rotate(-28)' }),
    },
  },
  'face.stickers': {
    cat: 'face', name: 'Звёздочки на щеках', def: 'lemon', palette: 'cloth',
    layers: {
      mask: ({ col }) => star5(31, 84, 0.75, col, 1.1) + star5(89, 84, 0.75, col, 1.1) + sparkle(25, 76, 0.35, '#FFFFFF') + sparkle(95, 76, 0.35, '#FFFFFF'),
    },
  },
  'face.sleepmask': {
    cat: 'face', name: 'Маска для сна', def: 'lavender', palette: 'cloth',
    layers: {
      hat: ({ col }) => {
        const lobe = 'M60 34 C54 30 44 29 37 31 C30 33 28 40 32 45 C37 50 50 49 57 45 Z';
        return line('M18 42 C30 36 90 36 102 42', INK, 5) + line('M18 42 C30 36 90 36 102 42', dark(col, 0.15), 3) +
          path(lobe, col) + mirror(path(lobe, col)) +
          line('M38 40 Q44 44 50 40 M70 40 Q76 44 82 40', INK, 1.6) +
          line('M40 42 l-1 2.4 M44 43 v2.6 M48 42 l1 2.4 M72 42 l-1 2.4 M76 43 v2.6 M80 42 l1 2.4', INK, 1.1);
      },
    },
  },
  'face.fangs': {
    cat: 'face', name: 'Клыки вампира', code: true, skin: '#EDE6FA',
    layers: {
      mask: () => path('M54 84.6 L56 90 L58 84.8 Z M62 84.8 L64 90 L66 84.6 Z', '#FFFFFF', { 'stroke-width': 1.3 }),
    },
  },
  'face.frank': {
    cat: 'face', name: 'Швы и болты', code: true, skin: '#A9D99B',
    layers: {
      back: () => {
        const bolt = rect(8, 80, 14, 7, 2, '#9A94AE', 1.8) + rect(4, 77.5, 6, 12, 2, '#C9C3DA', 1.8);
        return bolt + mirror(bolt);
      },
      mask: () =>
        line('M74 88 L92 80', INK, 1.6) + line('M77 83.6 l2 4.4 M82 81.6 l2 4.4 M87 79.6 l2 4.4', INK, 1.4) +
        line('M28 56 L40 54', INK, 1.4) + line('M31 52.6 l1 4.6 M36 52 l1 4.6', INK, 1.2),
    },
  },

  // ----- верх -----
  'top.flannel': {
    cat: 'top', name: 'Клетчатая рубашка', def: 'cherry', palette: 'cloth', sleeve: 'full',
    layers: {
      body: ({ col }) =>
        path(HOODIE, col) +
        line('M48 101 V136 M72 101 V136', dark(col, 0.3), 2.6, { opacity: 0.55 }) +
        line('M40.5 110 H79.5 M38.6 124 H81.4', dark(col, 0.3), 2.6, { opacity: 0.55 }) +
        line('M54 98 V136 M66 98 V136 M39.5 117 H80.5', light(col, 0.35), 1, { opacity: 0.7 }) +
        line('M60 103 V136', INK, 1.4, { opacity: 0.6 }) +
        [110, 120, 130].map((y) => circle(60, y, 1.3, '#F4F0FF', 0)).join('') +
        path('M47 98 L54 106 L60 100 L66 106 L73 98 C66 96.5 54 96.5 47 98 Z', light(col, 0.2), { 'stroke-width': 1.5 }),
    },
  },
  'top.puffer': {
    cat: 'top', name: 'Пуховик', def: 'sky', palette: 'cloth', sleeve: 'full',
    layers: {
      body: ({ col }) =>
        path('M37 105 C36 98 46 94 60 94 C74 94 84 98 83 105 L86 130 C87 137 82 141 76 141 L44 141 C38 141 33 137 34 130 Z', col) +
        line('M37 113 C50 116 70 116 83 113 M35.5 124 C50 127 70 127 84.5 124', dark(col, 0.25), 1.5, { opacity: 0.7 }) +
        line('M60 100 V140', dark(col, 0.35), 1.6) +
        path('M46 96 C50 101 70 101 74 96 L74 92 C68 95 52 95 46 92 Z', light(col, 0.25), { 'stroke-width': 1.6 }) +
        line('M42 108 C44 105 47 104 50 104', '#FFFFFF', 2, { opacity: 0.45 }),
    },
  },
  'top.cardigan': {
    cat: 'top', name: 'Кардиган', def: 'mint', palette: 'cloth', sleeve: 'full',
    layers: {
      body: ({ col }) =>
        path(HOODIE, col) +
        path('M50 97.5 L60 124 L70 97.5 C66 96.6 54 96.6 50 97.5 Z', '#F4F0FF', { 'stroke-width': 1.5 }) +
        line('M50 98 L60 125 V137 M70 98 L60 125', dark(col, 0.3), 1.6) +
        [118, 126, 133].map((y) => circle(56.5, y, 1.7, light(col, 0.5), 1.1)).join('') +
        path('M41 122 H52 V130 H41 Z', dark(col, 0.12), { 'stroke-width': 1.3 }) +
        line('M38 133 C50 135 70 135 82 133', dark(col, 0.25), 1.3, { opacity: 0.7 }),
    },
  },
  'top.pajama': {
    cat: 'top', name: 'Пижама', def: 'sky', palette: 'cloth', sleeve: 'full', cuff: '#F4F0FF',
    layers: {
      body: ({ col }) =>
        path(HOODIE, col) +
        path(P.collar, '#F4F0FF', { 'stroke-width': 1.4 }) +
        line('M60 104 V136', light(col, 0.5), 1.4) +
        [110, 120, 130].map((y) => circle(60, y, 1.3, '#F4F0FF', 0.9)).join('') +
        star5(47, 114, 0.55, '#FFD966', 0.8) + star5(71, 124, 0.5, '#FFD966', 0.8) + star5(49, 129, 0.4, '#F4F0FF', 0.7) + star5(73, 108, 0.4, '#F4F0FF', 0.7),
    },
  },
  'top.pumpkin': {
    cat: 'top', name: 'Костюм тыквы', code: true, sleeve: 'full', sleeveColor: 'mint',
    layers: {
      body: () =>
        path('M35 108 C31 97 46 92 60 94 C74 92 89 97 85 108 C92 118 90 135 80 141 C70 146 50 146 40 141 C30 135 28 118 35 108 Z', ORANGE) +
        line('M46 97 C40 110 40 130 46 143 M60 95 V145 M74 97 C80 110 80 130 74 143', dark(ORANGE, 0.22), 1.6, { opacity: 0.7 }) +
        path('M49 113 L54 107 L58 113 Z M62 113 L66 107 L71 113 Z', '#5A2A12', { 'stroke-width': 1.2 }) +
        path('M46 124 L50 121 L53 125 L57 121 L60 125 L63 121 L67 125 L70 121 L74 124 C70 132 50 132 46 124 Z', '#5A2A12', { 'stroke-width': 1.2 }) +
        path('M52 96 C55 100 65 100 68 96 L66 92 C62 94 58 94 54 92 Z', STEM, { 'stroke-width': 1.5 }),
    },
  },
  'top.vamp': {
    cat: 'top', name: 'Камзол с жабо', def: 'coal', palette: 'cloth', sleeve: 'full', cuff: '#F4F0FF', code: true,
    layers: {
      body: ({ col }) =>
        path(HOODIE, col) +
        path('M49 97.4 L60 124 L71 97.4 C66 96.5 54 96.5 49 97.4 Z', '#F4F0FF', { 'stroke-width': 1.5 }) +
        path('M55 101 C52 104 57 106 54 109 C52 112 58 113 56 116 L64 116 C62 113 68 112 66 109 C63 106 68 104 65 101 Z', '#FFFFFF', { 'stroke-width': 1.3 }) +
        circle(60, 102, 2.6, '#E5304F', 1.3) +
        path('M49 97.4 L60 124 L56 126 L44 100 Z M71 97.4 L60 124 L64 126 L76 100 Z', light(col, 0.12), { 'stroke-width': 1.4 }) +
        [128, 133].map((y) => circle(60, y, 1.3, '#FFD45E', 0.9)).join(''),
    },
  },
  'top.witch': {
    cat: 'top', name: 'Платье ведьмы', def: 'coal', palette: 'cloth', sleeve: 'full', coversBottom: true, cuff: '#9B6BFF', code: true,
    layers: {
      body: ({ col }) =>
        path('M41 103 C41 98.5 48 96 60 96 C72 96 79 98.5 79 103 L86 133 L82 140 L76 135 L70 141 L64 135 L58 141 L52 135 L46 141 L40 135 L35 140 L34 133 Z', col) +
        path('M39.5 112 H80.5 L81.6 118 H38.4 Z', ORANGE, { 'stroke-width': 1.5 }) +
        rect(56, 111, 8, 8, 1.4, '#FFD45E', 1.3) +
        path('M47 99 Q60 108 73 99 Q60 96 47 99 Z', '#9B6BFF', { 'stroke-width': 1.4 }) +
        star5(48, 128, 0.45, '#FFD966', 0.7) + star5(71, 125, 0.38, '#FFD966', 0.7),
    },
  },
  'top.frank': {
    cat: 'top', name: 'Пиджак с заплатками', def: 'coal', palette: 'cloth', sleeve: 'full', code: true,
    layers: {
      body: ({ col }) =>
        path('M40 104 C40 99 47 96 60 96 C73 96 80 99 80 104 L84 128 L85 137 L80 134 L75 138 L70 134 L64 138 L58 134 L52 138 L46 134 L41 138 L35 136 L36 128 Z', col) +
        path('M50 97.4 L60 116 L70 97.4 C66 96.6 54 96.6 50 97.4 Z', '#E9E4F5', { 'stroke-width': 1.4 }) +
        line('M50 97.5 L56 112 L52 120 M70 97.5 L64 112 L68 120', light(col, 0.25), 1.6) +
        rect(42, 118, 9, 9, 1.5, '#7F8CFF', 1.4) + line('M43 116.5 v2 M46.5 116.5 v2 M50 116.5 v2', INK, 1) +
        rect(70, 108, 8, 7, 1.5, '#FFAA6B', 1.4) + line('M69 111.5 h-2 M79 111.5 h2', INK, 1),
    },
  },

  // ----- низ -----
  'bottom.jeans': {
    cat: 'bottom', name: 'Джинсы', def: 'blueberry', palette: 'cloth',
    layers: {
      leg: ({ col, x }) =>
        rect(x!, 124, 11, 24, 5, col) + rect(x! - 0.4, 141, 11.8, 5, 2, light(col, 0.3), 1.6) + line(`M${x! + 7.5} 126 V140`, light(col, 0.35), 1, { opacity: 0.7 }),
    },
  },
  'bottom.joggers': {
    cat: 'bottom', name: 'Спортивки', def: 'lavender', palette: 'cloth',
    layers: {
      leg: ({ col, x, side }) =>
        rect(x!, 124, 11, 24, 5, col) + line(side === 'L' ? `M${x! + 2.2} 126 V141` : `M${x! + 8.8} 126 V141`, '#FFFFFF', 1.8, { opacity: 0.9 }) +
        rect(x! + 0.4, 141.5, 10.2, 5, 2.4, dark(col, 0.2), 1.6),
    },
  },
  'bottom.tutu': {
    cat: 'bottom', name: 'Юбка-пачка', def: 'strawberry', palette: 'cloth',
    layers: {
      under: ({ col }) =>
        path('M38 125 H82 L92 137 L86 135 L82 141 L76 136 L70 142 L64 137 L60 143 L56 137 L50 142 L44 136 L38 141 L34 135 L28 137 Z', light(col, 0.35)) +
        path('M38 125 H82 L88 134 L82 132 L77 137 L70 133 L64 138 L60 133 L56 138 L50 133 L43 137 L38 132 L32 134 Z', col) +
        path('M37.5 124 H82.5 V128.5 H37.5 Z', dark(col, 0.12), { 'stroke-width': 1.6 }),
    },
  },
  'bottom.plaid': {
    cat: 'bottom', name: 'Клетчатая юбка', def: 'cherry', palette: 'cloth',
    layers: {
      under: ({ col }) =>
        path('M38 126 H82 L88 143 C88.5 145 87 146 85 146 L35 146 C33 146 31.5 145 32 143 Z', col) +
        line('M47 127 L44 145 M60 127 V145 M73 127 L76 145', dark(col, 0.32), 2.4, { opacity: 0.55 }) +
        line('M36 134 H84 M34 141 H86', dark(col, 0.32), 2.4, { opacity: 0.55 }) +
        line('M53 127 L52 145 M67 127 L68 145 M35 137.5 H85', '#FFD966', 1, { opacity: 0.75 }),
    },
  },
  'bottom.overalls': {
    cat: 'bottom', name: 'Комбинезон', def: 'blueberry', palette: 'cloth',
    layers: {
      leg: ({ col, x }) => rect(x!, 124, 11, 24, 5, col) + rect(x! - 0.4, 142, 11.8, 4.6, 2, light(col, 0.25), 1.5),
      under: ({ col }) => path('M37 124 H83 L84 132 H36 Z', col),
      front: ({ col }) =>
        line('M46 99 L50 112 M74 99 L70 112', INK, 5) + line('M46 99 L50 112 M74 99 L70 112', col, 3) +
        path('M48 110 H72 L73 128 H47 Z', col) + path('M53 114 H67 V121 H53 Z', dark(col, 0.12), { 'stroke-width': 1.3 }) +
        circle(50.5, 113, 1.8, '#FFD966', 1.1) + circle(69.5, 113, 1.8, '#FFD966', 1.1),
    },
  },
  'bottom.pjpants': {
    cat: 'bottom', name: 'Пижамные штаны', def: 'sky', palette: 'cloth',
    layers: {
      leg: ({ col, x }) =>
        rect(x!, 124, 11, 24, 5, col) + circle(x! + 3.5, 130, 1.2, '#F4F0FF', 0) + circle(x! + 7.5, 136, 1.2, '#FFD966', 0) + circle(x! + 4, 142, 1.2, '#F4F0FF', 0),
    },
  },
  'bottom.capri': {
    cat: 'bottom', name: 'Бриджи', def: 'mint', palette: 'cloth',
    layers: {
      leg: ({ col, skin, x }) => rect(x!, 124, 11, 24, 5, skin) + rect(x!, 124, 11, 15, 5, col) + rect(x! - 0.4, 135, 11.8, 4.4, 2, light(col, 0.3), 1.5),
    },
  },
  'bottom.frank': {
    cat: 'bottom', name: 'Рваные брюки', def: 'lavender', palette: 'cloth', code: true,
    layers: {
      leg: ({ col, x, side }) =>
        path(`M${x} 128 C${x} 125 ${x! + 2} 124 ${x! + 5.5} 124 C${x! + 9} 124 ${x! + 11} 125 ${x! + 11} 128 L${x! + 11} 142 L${x! + 8} 140 L${x! + 5.5} 143 L${x! + 3} 140 L${x} 142 Z`, col) +
        (side === 'L' ? rect(x! + 2, 129, 6, 5, 1, '#FFAA6B', 1.2) : line(`M${x! + 3} 131 l5 3 M${x! + 3} 134 l5 -3`, INK, 1)),
    },
  },

  // ----- обувь -----
  'shoes.sneakers': {
    cat: 'shoes', name: 'Кроссовки', def: 'cherry', palette: 'cloth',
    layers: {
      shoe: ({ col, side }) =>
        path(shoeOf(side), col) + line(soleOf(side, 154), '#FFFFFF', 3) + line(soleOf(side, 154), INK, 0.8, { opacity: 0.5, transform: 'translate(0 1.6)' }) +
        line(side === 'L' ? 'M47 150 C51 147 55 147 58 149' : 'M73 150 C69 147 65 147 62 149', '#FFFFFF', 1.8),
    },
  },
  'shoes.bunny': {
    cat: 'shoes', name: 'Тапочки-зайчики', def: 'milk', palette: 'cloth',
    layers: {
      shoe: ({ col, side }) => {
        const s = side === 'L' ? 1 : -1;
        const cx = side === 'L' ? 49 : 71;
        const ear = (dx: number) => el('ellipse', { cx: cx + s * dx, cy: 141, rx: 2.4, ry: 6, fill: col, stroke: INK, 'stroke-width': 1.6, transform: `rotate(${s * (dx - 2) * 6} ${cx + s * dx} 146)` }) +
          el('ellipse', { cx: cx + s * dx, cy: 141.5, rx: 1, ry: 3.6, fill: '#FF9EBB', transform: `rotate(${s * (dx - 2) * 6} ${cx + s * dx} 146)` });
        return ear(0) + ear(4) + path(shoeOf(side), col) + circle(cx - s * 1, 149.5, 0.9, INK, 0) + circle(cx + s * 3, 149.5, 0.9, INK, 0) + circle(cx + s * 1, 152, 1.1, '#FF9EBB', 0);
      },
    },
  },
  'shoes.rainboots': {
    cat: 'shoes', name: 'Резиновые сапоги', def: 'lemon', palette: 'cloth',
    layers: {
      shoe: ({ col, side, x }) =>
        rect(x! - 1, 132, 13, 17, 3.5, col) + path(shoeOf(side), col) + line(soleOf(side, 153.6), dark(col, 0.3), 1.8) +
        line(`M${x! + 2} 135 V146`, '#FFFFFF', 1.8, { opacity: 0.6 }),
    },
  },
  'shoes.maryjanes': {
    cat: 'shoes', name: 'Туфельки', def: 'cherry', palette: 'cloth',
    layers: {
      shoe: ({ col, side, x }) =>
        rect(x!, 136, 11, 10, 3, '#F4F0FF', 1.8) +
        path(shoeOf(side), col) + line(side === 'L' ? 'M46 147 H58' : 'M62 147 H74', INK, 3.4) + line(side === 'L' ? 'M46 147 H58' : 'M62 147 H74', dark(col, 0.2), 1.6) +
        circle(side === 'L' ? 55 : 65, 147, 1.3, '#FFD966', 0.9) + line(side === 'L' ? 'M47.5 150.5 l3 -1' : 'M72.5 150.5 l-3 -1', '#FFFFFF', 1.4, { opacity: 0.7 }),
    },
  },
  'shoes.sandals': {
    cat: 'shoes', name: 'Сандалии', def: 'apricot', palette: 'cloth',
    layers: {
      shoe: ({ col, skin, side }) =>
        path(shoeOf(side), skin) + line(soleOf(side, 155), col, 3.2) +
        line(side === 'L' ? 'M46 149 H59 M52 144 V149' : 'M61 149 H74 M68 144 V149', INK, 3.2) + line(side === 'L' ? 'M46 149 H59 M52 144 V149' : 'M61 149 H74 M68 144 V149', col, 1.6),
    },
  },
  'shoes.uggs': {
    cat: 'shoes', name: 'Угги', def: 'apricot', palette: 'cloth',
    layers: {
      shoe: ({ col, side, x }) =>
        rect(x! - 1.6, 133, 14.2, 16, 5, col) + path(shoeOf(side), col) +
        rect(x! - 2.4, 130, 15.8, 6.4, 3.2, '#F4F0FF', 1.8) + line(soleOf(side, 153.6), dark(col, 0.25), 1.6) +
        line(`M${x! + 1} 141 h9`, dark(col, 0.18), 1.1, { opacity: 0.7 }),
    },
  },
  'shoes.hightops': {
    cat: 'shoes', name: 'Высокие кеды', def: 'coal', palette: 'cloth',
    layers: {
      shoe: ({ col, side, x }) =>
        rect(x! - 0.4, 137, 11.8, 12, 3, col) + path(shoeOf(side), col) +
        path(side === 'L' ? 'M44 150 C44 147 45.5 146 48 146 L50 146 L50 155.5 C46.5 155 44 153.5 44 150 Z' : 'M76 150 C76 147 74.5 146 72 146 L70 146 L70 155.5 C73.5 155 76 153.5 76 150 Z', '#F4F0FF', { 'stroke-width': 1.6 }) +
        line(soleOf(side, 153.8), '#F4F0FF', 2) + line(`M${x! + 3} 140 h5 M${x! + 3} 143.5 h5`, '#F4F0FF', 1.2) +
        circle(side === 'L' ? x! + 1.6 : x! + 9.4, 141, 2, '#F4F0FF', 1),
    },
  },
  'shoes.witch': {
    cat: 'shoes', name: 'Чулки и туфли ведьмы', code: true,
    layers: {
      shoe: ({ side, x }) => {
        const toe = side === 'L' ? 'M43 151 C40 148 37 149 36 146 C40 145 44 145 47 146 L58 146 C60 148 60 152 57 154 L47 154 C45 154 44 153 43 151 Z' : 'M77 151 C80 148 83 149 84 146 C80 145 76 145 73 146 L62 146 C60 148 60 152 63 154 L73 154 C75 154 76 153 77 151 Z';
        return rect(x!, 124, 11, 24, 5, '#F4F0FF') +
          [128, 134, 140].map((y) => el('rect', { x: x! + 1.1, y, width: 8.8, height: 3, fill: '#9B6BFF' })).join('') +
          path(toe, '#2E2438') + rect(side === 'L' ? 50.5 : 65.5, 146.4, 4, 3.4, 0.8, '#FFD45E', 1);
      },
    },
  },
  'shoes.frank': {
    cat: 'shoes', name: 'Тяжёлые ботинки', code: true,
    layers: {
      shoe: ({ side, x }) =>
        rect(x! - 1.6, 134, 14.2, 15, 3, '#4A4258') +
        path(side === 'L' ? 'M41 152 C41 146 45 144 52 144 C58 144 61 147 61 152 L61 155 L41 155 Z' : 'M79 152 C79 146 75 144 68 144 C62 144 59 147 59 152 L59 155 L79 155 Z', '#4A4258') +
        rect(side === 'L' ? 40 : 58, 154, 22, 5, 1.6, '#2E2438', 1.8) +
        line(`M${x! + 1} 138 h9 M${x! + 1} 142 h9`, '#8E8AA6', 1.2),
    },
  },

  // ----- спина -----
  'back.cape': {
    cat: 'back', name: 'Плащ', def: 'cherry', palette: 'cloth', anim: 'sway', pivot: [60, 98],
    layers: {
      back: ({ col }) => path(CAPE_BACK, col) + line('M36 120 C32 132 30 142 30 152 M84 120 C88 132 90 142 90 152', dark(col, 0.25), 1.6, { opacity: 0.6 }),
      front: ({ col }) => line('M44 98 L54 102 M76 98 L66 102', INK, 4.4) + line('M44 98 L54 102 M76 98 L66 102', col, 2.4) + circle(60, 102, 3.2, '#FFD45E', 1.6),
    },
  },
  'back.fairy': {
    cat: 'back', name: 'Крылья феи', def: 'sky', palette: 'cloth', hover: true,
    layers: {
      back: ({ col }) => {
        const w = path('M48 104 C40 86 22 70 10 76 C0 82 6 100 22 106 C30 109 40 108 48 106 Z', light(col, 0.45), { 'fill-opacity': 0.85 }) +
          path('M48 108 C38 112 24 120 22 132 C22 140 32 140 40 132 C45 126 48 118 48 108 Z', light(col, 0.3), { 'fill-opacity': 0.85 }) +
          line('M46 104 C36 94 24 84 14 82 M46 110 C38 118 32 126 28 134', col, 1.4, { opacity: 0.8 }) +
          sparkle(20, 90, 0.4, '#FFFFFF');
        return w + mirror(w);
      },
    },
  },
  'back.guitar': {
    cat: 'back', name: 'Гитара', def: 'apricot', palette: 'cloth',
    layers: {
      back: ({ col }) =>
        g(
          rect(56, 50, 7, 70, 2, '#7A4A33') + rect(54, 40, 11, 14, 3, '#5A3A2A') +
            line('M57 44 h-3 M57 49 h-3 M62 44 h3 M62 49 h3', INK, 1.6) +
            path('M59.5 112 C48 112 44 120 47 128 C42 134 44 148 59.5 148 C75 148 77 134 72 128 C75 120 71 112 59.5 112 Z', col) +
            circle(59.5, 128, 4.6, '#3A2A24', 1.6) + rect(53, 138, 13, 3.4, 1, '#5A3A2A', 1.4),
          { transform: 'translate(30 128) rotate(55) translate(-59.5 -130)' },
        ),
      front: ({ col }) => line('M76 99 L40 132', INK, 5.2) + line('M76 99 L40 132', dark(col, 0.25), 3.2),
    },
  },
  'back.scarf': {
    cat: 'back', name: 'Шарф', def: 'cherry', palette: 'cloth', anim: 'sway', pivot: [78, 102],
    layers: {
      back: ({ col }) =>
        path('M76 98 C88 94 100 100 112 92 L114 101 C104 110 90 107 78 106 Z', col) +
        line('M112 92 l4 -2 M113 96 l4 -1 M114 100 l4 0', col, 2) +
        line('M90 98 L92 106 M100 97 L101 105', light(col, 0.4), 2.4, { opacity: 0.9 }),
      front: ({ col }) =>
        path('M66 104 L74 104 L76 125 L67 125 Z', col) + line('M67.6 112 H74.8 M68.2 119 H75.4', light(col, 0.4), 2.4) +
        line('M68 125 v3 M71 125 v3 M74 125 v3', col, 1.8) +
        path('M42 95 C48 102 72 102 78 95 L80 103 C72 110 48 110 40 103 Z', col) +
        line('M50 101 L49 107 M60 103 V109 M70 101 L71 107', light(col, 0.4), 2.4, { opacity: 0.9 }),
    },
  },
  'back.tail': {
    cat: 'back', name: 'Хвост котика', def: 'coal', palette: 'hair', anim: 'sway', pivot: [70, 132],
    layers: {
      back: ({ col }) => {
        const d = 'M66 132 C86 142 102 134 102 118 C102 106 108 99 115 103';
        return line(d, INK, 10.4) + line(d, col, 6.2) + circle(115, 103, 4.4, light(col, 0.35), 1.8);
      },
    },
  },
  'back.bear': {
    cat: 'back', name: 'Мишка-рюкзак', def: 'apricot', palette: 'cloth',
    layers: {
      back: ({ col }) =>
        path('M31 104 C31 96 37 92 45 92 H75 C83 92 89 96 89 104 V130 C89 136 85 140 79 140 H41 C35 140 31 136 31 130 Z', col) +
        circle(81, 80, 5.6, col) + circle(103, 80, 5.6, col) + circle(81, 80, 2.6, light(col, 0.4), 0) + circle(103, 80, 2.6, light(col, 0.4), 0) +
        circle(92, 92, 13.5, col) + el('ellipse', { cx: 92, cy: 97, rx: 6, ry: 4.6, fill: light(col, 0.45), stroke: INK, 'stroke-width': 1.4 }) +
        circle(87, 89, 1.5, INK, 0) + circle(97, 89, 1.5, INK, 0) + el('ellipse', { cx: 92, cy: 95.4, rx: 1.8, ry: 1.3, fill: INK }) +
        circle(84, 95, 1.8, '#FF9EBB', 0, { opacity: 0.8 }) + circle(100, 95, 1.8, '#FF9EBB', 0, { opacity: 0.8 }),
      front: ({ col }) =>
        line('M48 99 C46 108 45.5 118 45.5 129 M72 99 C74 108 74.5 118 74.5 129', INK, 5.2) +
        line('M48 99 C46 108 45.5 118 45.5 129 M72 99 C74 108 74.5 118 74.5 129', dark(col, 0.1), 3),
    },
  },
  'back.jetpack': {
    cat: 'back', name: 'Ранец-ракета', def: 'milk', palette: 'cloth', hover: true, anim: 'flicker',
    layers: {
      back: ({ col }) => {
        const tank = rect(24, 100, 14, 32, 6, col) + path('M24 106 C24 98 27 92 31 90 C35 92 38 98 38 106 Z', '#E5566B') +
          rect(26.5, 131, 9, 5, 1.5, '#8E8AA6', 1.6) + line('M28 110 V126', '#FFFFFF', 2, { opacity: 0.6 });
        return tank + mirror(tank);
      },
      backFx: () => {
        const fl = path('M31 136 C26 142 27 150 31 156 C35 150 36 142 31 136 Z', '#FFB347', { 'stroke-width': 1.4 }) + path('M31 139 C29 143 29.5 148 31 151 C32.5 148 33 143 31 139 Z', '#FFF2A8', { stroke: 'none' });
        return fl + mirror(fl);
      },
    },
  },
  'back.vampcape': {
    cat: 'back', name: 'Плащ вампира', code: true, anim: 'sway', pivot: [60, 98],
    layers: {
      back: () => {
        const collar = path('M48 101 C32 99 14 88 4 68 C20 72 38 82 57 96 Z', '#2E2438') + path('M46 98 C32 96 18 87 10 74 C24 78 38 85 52 95 Z', '#C9304A', { stroke: 'none' });
        return path(CAPE_BACK, '#2E2438') + path('M44 100 C36 112 31 130 29 150 C40 153 52 152 60 151 C68 152 80 153 91 150 C89 130 84 112 76 100 Z', '#C9304A', { 'stroke-width': 1.4 }) +
          collar + mirror(collar);
      },
      front: () => circle(60, 101, 3, '#E5304F', 1.6),
    },
  },

  // ----- в руках -----
  'hand.flashlight': {
    cat: 'hand', name: 'Фонарик', def: 'lemon', palette: 'cloth', anim: 'pulse',
    layers: {
      handR: ({ col }) => g(rect(78, 121, 20, 9, 3, col) + rect(96, 119, 7, 13, 2.4, dark(col, 0.15)) + circle(85, 125.5, 1.5, '#E5566B', 1), { transform: 'rotate(-24 81 126)' }),
      handFx: () =>
        g(
          path('M103 120 L140 104 C145 114 145 136 140 146 L103 131 Z', '#FFE9A0', { stroke: 'none', opacity: 0.6 }) +
            path('M103 122 L132 114 C135 120 135 131 132 137 L103 129 Z', '#FFFBE8', { stroke: 'none', opacity: 0.85 }),
          { transform: 'rotate(-24 81 126)' },
        ),
    },
  },
  'hand.umbrella': {
    cat: 'hand', name: 'Зонтик', def: 'strawberry', palette: 'cloth',
    layers: {
      back: ({ col }) =>
        g(
          path('M42 46 C44 20 64 6 88 6 C112 6 132 20 134 46 C128 42 122 42 117 46 C111 42 104 42 98 46 C93 42 84 42 78 46 C73 42 64 42 59 46 C53 42 47 42 42 46 Z', col) +
            line('M88 6 C78 18 76 32 78 46 M88 6 C98 18 100 32 98 46 M88 6 C70 14 60 28 59 46 M88 6 C106 14 116 28 117 46', dark(col, 0.25), 1.4, { opacity: 0.7 }) +
            path('M86 6 L88 -2 L90 6 Z', INK, { 'stroke-width': 1.2 }),
          { transform: 'rotate(12 88 46)' },
        ),
      handR: () => line('M80 128 C81 118 82 100 84 60', INK, 4.4) + line('M80 128 C81 118 82 100 84 60', '#8E8AA6', 2.4) + line('M80 128 C79 133 74 134 73 130', INK, 3),
    },
  },
  'hand.icecream': {
    cat: 'hand', name: 'Мороженое', def: 'strawberry', palette: 'cloth',
    layers: {
      handR: ({ col }) =>
        path('M84 133 L79 115 L97 113 Z', '#E9B66A', { 'stroke-width': 1.8 }) + line('M82 118 L94 116 M83 123 L92 121 M88 128 L84 118', '#C98A4B', 1, { opacity: 0.8 }) +
        path('M78 115 C76 106 82 99 89 100 C96 99 101 106 98 114 C96 117 94 113 92 116 C90 113 87 118 85 115 C83 118 80 113 78 115 Z', col) +
        circle(90, 98, 2.6, '#E5304F', 1.3) + line('M82 105 C84 103 86 102 88 102', '#FFFFFF', 1.8, { opacity: 0.6 }),
    },
  },
  'hand.book': {
    cat: 'hand', name: 'Книжка', def: 'blueberry', palette: 'cloth',
    layers: {
      handR: ({ col }) =>
        g(rect(80, 110, 19, 24, 2.4, col) + rect(97.5, 111.5, 3, 21, 1, '#F4F0FF', 1.4) + line('M84 117 h10 M84 121 h7', light(col, 0.5), 1.6) + circle(89, 127, 2.4, contrast(col), 1.1), { transform: 'rotate(-8 88 122)' }),
    },
  },
  'hand.sparkler': {
    cat: 'hand', name: 'Бенгальский огонь', anim: 'flicker',
    layers: {
      handR: () => line('M81 128 L101 95', INK, 3.6) + line('M81 128 L101 95', '#B9B2CC', 1.8) + line('M92 110 L101 95', '#4A4258', 2.2),
      handFx: () =>
        circle(101, 94, 12, '#FFE9A0', 0, { opacity: 0.6 }) +
        line('M101 94 l12 -12 M101 94 l15 2 M101 94 l-4 -16 M101 94 l10 12 M101 94 l-13 -6', '#FFE38A', 1.4) +
        sparkle(101, 94, 2, '#FFF6C2', { stroke: INK, 'stroke-width': 0.5 }) + sparkle(115, 82, 0.7, '#FFFFFF') + sparkle(94, 77, 0.6, '#FFE38A') +
        sparkle(117, 97, 0.55, '#FFFFFF') + circle(111, 107, 1.3, '#FFD966', 0) + circle(88, 89, 1.2, '#FFFFFF', 0),
    },
  },
  'hand.kite': {
    cat: 'hand', name: 'Воздушный змей', def: 'cherry', palette: 'cloth',
    layers: {
      handR: ({ col }) =>
        line('M81 126 C100 110 120 80 136 52', INK, 1.2) +
        line('M136 52 C130 62 140 68 134 78 C128 88 138 92 132 100', INK, 1) +
        [[133, 70], [134, 86]].map(([x, y]) => g(path(P.bowLoops, '#FFD966', { 'stroke-width': 1.2 }), { transform: `translate(${x} ${y}) scale(0.4)` })).join('') +
        path('M136 52 L124 34 L136 10 L148 34 Z', col) + path('M136 10 L148 34 L136 34 Z', light(col, 0.35), { 'stroke-width': 1.4 }) +
        path('M124 34 L136 52 L136 34 Z', dark(col, 0.12), { 'stroke-width': 1.4 }) + line('M136 10 V52 M124 34 H148', INK, 1.2, { opacity: 0.6 }),
    },
  },
  'hand.jack': {
    cat: 'hand', name: 'Фонарь Джека', code: true, anim: 'flicker',
    layers: {
      handR: () =>
        circle(91, 143, 17, '#FFC266', 0, { opacity: 0.4 }) +
        line('M81 126 L86 132 M81 126 L96 132', INK, 1.8) +
        path('M80 142 C78 134 84 130 91 131 C98 130 104 134 102 142 C104 150 98 155 91 154 C84 155 78 150 80 142 Z', ORANGE) +
        line('M86 132 C84 138 84 148 86 153 M96 132 C98 138 98 148 96 153', dark(ORANGE, 0.25), 1.3, { opacity: 0.7 }) +
        path('M90 131 L91 127 L93 127 L92 131 Z', STEM, { 'stroke-width': 1.2 }) +
        path('M84.5 140 L87 136.5 L89 140 Z M93 140 L95 136.5 L97.5 140 Z M84 145 L87 147 L89 145 L91 147 L93 145 L95 147 L98 145 C96 150 86 150 84 145 Z', '#5A2A12', { 'stroke-width': 1 }),
      handFx: () =>
        path('M85.5 139.6 L87 137.6 L88.2 139.6 Z M93.8 139.6 L95 137.6 L96.6 139.6 Z M86 146 L87.4 147 L89 146 L91 147 L93 146 L94.6 147 L96 146 C94 148.6 88 148.6 86 146 Z', '#FFE38A'),
    },
  },
  'hand.broom': {
    cat: 'hand', name: 'Метла', code: true, hover: true,
    layers: {
      handR: () =>
        line('M90 82 L74 150', INK, 5) + line('M90 82 L74 150', '#9C5B3B', 3) +
        path('M70 146 C66 152 62 160 60 168 C66 168 76 168 84 166 C82 158 80 152 78 147 Z', '#E9C48A', { 'stroke-width': 1.8 }) +
        line('M68 156 L65 166 M73 155 L72 167 M77 155 L79 166', '#C98A4B', 1.2) +
        path('M69.4 145 L78.8 147 L78 150.6 L68.6 148.6 Z', '#9B6BFF', { 'stroke-width': 1.4 }),
    },
  },
};

Object.assign(ITEMS, NEW);
export const NEW_IDS = Object.keys(NEW);
