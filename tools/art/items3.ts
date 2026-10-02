// Вещи 0.2.2: шляпа грибника (секрет: грибы в лесу) и награды за победы в мини-играх комнаты.
// Подключается к ITEMS из chibi.ts (import './items3.ts'), как items2.ts.
import { ITEMS, path, line, el, g, dark, light, SW, shine, type Item } from './chibi.ts';
import './items2.ts';

const INK = '#2B2035';
const circle = (cx: number, cy: number, r: number, fill: string, sw = SW, o: Record<string, string | number> = {}) =>
  el('circle', { cx, cy, r, fill, stroke: sw ? INK : undefined, 'stroke-width': sw || undefined, ...o });
const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string, o: Record<string, string | number> = {}) =>
  el('ellipse', { cx, cy, rx, ry, fill, ...o });
const rect = (x: number, y: number, w: number, h: number, rx: number, fill: string, sw = SW) =>
  el('rect', { x, y, width: w, height: h, rx, fill, stroke: sw ? INK : undefined, 'stroke-width': sw || undefined });
const mirror = (s: string) => g(s, { transform: 'translate(120 0) scale(-1 1)' });

const CAP = '#E5484D';
const GILLS = '#F3DDBE';
const GOLD = '#FFC94D';
const GOLD_D = '#E09A2E';

// Маленький гриб: x, y — низ ножки
const shroom = (x: number, y: number, s: number, cap: string) =>
  g(
    path('M-3.2 0 C-3.6 -5 -3 -9 -2.4 -11 L2.4 -11 C3 -9 3.6 -5 3.2 0 Z', '#FFF6E6', { 'stroke-width': 1.5 }) +
      path('M-9 -10 C-9 -19 9 -19 9 -10 C5 -8 -5 -8 -9 -10 Z', cap, { 'stroke-width': 1.5 }) +
      circle(-3.6, -14, 1.4, '#FFFFFF', 0) +
      circle(2.6, -15.4, 1.1, '#FFFFFF', 0),
    { transform: `translate(${x} ${y}) scale(${s})` },
  );

const NEW: Record<string, Item> = {
  'hat.mushroom': {
    cat: 'hat', name: 'Шляпа грибника', code: true, anim: 'sway', pivot: [60, 40], spores: true,
    layers: {
      hat: () =>
        // нижняя сторона шляпки (пластинки) и сама шляпка
        path('M8 42 C26 52 94 52 112 42 C110 50 94 57 60 57 C26 57 10 50 8 42 Z', GILLS, { 'stroke-width': 1.8 }) +
        line('M24 49 L27 54 M38 51 L40 56 M52 52 L53 57 M68 52 L67 57 M82 51 L80 56 M96 49 L93 54', dark(GILLS, 0.2), 1.2) +
        path('M4 44 C0 14 28 -8 60 -8 C92 -8 120 14 116 44 C98 52 22 52 4 44 Z', CAP) +
        ellipse(32, 12, 9, 6.5, '#FFFFFF', { stroke: INK, 'stroke-width': 1.4 }) +
        ellipse(62, 3, 7, 5, '#FFFFFF', { stroke: INK, 'stroke-width': 1.4 }) +
        ellipse(90, 16, 8, 6, '#FFFFFF', { stroke: INK, 'stroke-width': 1.4 }) +
        ellipse(16, 34, 5, 4, '#FFFFFF', { stroke: INK, 'stroke-width': 1.2 }) +
        ellipse(52, 30, 6, 4.4, '#FFFFFF', { stroke: INK, 'stroke-width': 1.2 }) +
        ellipse(104, 36, 4.6, 3.6, '#FFFFFF', { stroke: INK, 'stroke-width': 1.2 }) +
        shine('M20 18 C28 6 40 0 50 -2'),
      over: () =>
        // грибок и листик сверху
        path('M92 -2 C88 -12 92 -20 100 -22 C98 -14 99 -8 104 -2 C100 0 96 0 92 -2 Z', '#7CC46A', { 'stroke-width': 1.5 }) +
        line('M95 -4 C96 -10 98 -15 100 -20', dark('#7CC46A', 0.25), 1) +
        shroom(78, 0, 0.95, '#B07BFF'),
    },
  },
  'hat.champion': {
    cat: 'hat', name: 'Корона чемпиона', code: true,
    layers: {
      hat: () =>
        path('M30 30 L24 2 L42 16 L52 -6 L60 12 L68 -6 L78 16 L96 2 L90 30 Z', GOLD, { 'stroke-linejoin': 'round' }) +
        path('M28 26 C48 30 72 30 92 26 L91 34 C72 38 48 38 29 34 Z', GOLD_D, { 'stroke-width': 1.8 }) +
        circle(24, 2, 3.2, '#FF6B8A', 1.4) + circle(52, -6, 3.2, '#8FA2FF', 1.4) + circle(68, -6, 3.2, '#8FA2FF', 1.4) + circle(96, 2, 3.2, '#FF6B8A', 1.4) +
        el('path', { d: 'M60 18 L64 24 L60 30 L56 24 Z', fill: '#5ED3A0', stroke: INK, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }) +
        shine('M36 14 L40 26 M80 14 L78 24'),
    },
  },
  'back.champion': {
    cat: 'back', name: 'Плащ чемпиона', code: true, anim: 'sway', pivot: [60, 98],
    layers: {
      back: () =>
        path('M41 97 C30 110 23 131 19 156 C33 161 47 160 60 158 C73 160 87 161 101 156 C97 131 90 110 79 97 Z', '#7A3FC4') +
        path('M21 150 C34 155 47 154 60 152 C73 154 86 155 99 150 L101 156 C87 161 73 160 60 158 C47 160 33 161 19 156 Z', GOLD, { 'stroke-width': 1.4 }) +
        line('M36 118 C32 130 29 142 28 150 M84 118 C88 130 91 142 92 150', dark('#7A3FC4', 0.3), 1.6, { opacity: 0.6 }),
      front: () => {
        const collar = path('M46 98 C38 96 30 92 26 86 C34 88 42 91 54 96 Z', GOLD, { 'stroke-width': 1.6 });
        return collar + mirror(collar) + circle(60, 101, 3.4, '#FF6B8A', 1.6);
      },
    },
  },
  'hand.trophy': {
    cat: 'hand', name: 'Кубок победителя', code: true,
    layers: {
      handR: () =>
        line('M84 133 C78 133 77 141 84 142 M98 133 C104 133 105 141 98 142', INK, 4.2) +
        line('M84 133 C78 133 77 141 84 142 M98 133 C104 133 105 141 98 142', GOLD, 2.2) +
        path('M82 128 H100 C100 140 96 146 91 146 C86 146 82 140 82 128 Z', GOLD) +
        rect(88.5, 145, 5, 6, 1.4, GOLD_D, 1.5) +
        rect(84, 150, 14, 5, 2, light(GOLD_D, 0.1), 1.6) +
        el('path', { d: 'M91 131.5 L92.3 134.6 L95.6 134.8 L93 136.9 L93.9 140 L91 138.3 L88.1 140 L89 136.9 L86.4 134.8 L89.7 134.6 Z', fill: '#FFF4C2', stroke: INK, 'stroke-width': 0.9, 'stroke-linejoin': 'round' }) +
        line('M85 131 C85 136 86 140 88 142', '#FFFFFF', 1.6, { opacity: 0.45 }),
    },
  },
};

Object.assign(ITEMS, NEW);
export const NEW3_IDS = Object.keys(NEW);
