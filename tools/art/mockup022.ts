// Макет 0.2.2 «Комната на троих»: большая площадка, меню, реакции, способности на троих, колесо и 4 игры,
// пьедестал и рекорды, грибы и шляпа грибника, отражённый «Мог», комната разработчиков — одна HTML-страница.
// Запуск: node tools/art/mockup022.ts <файл.html>
import { writeFileSync } from 'node:fs';
import { chibi, el, g, ITEMS, type Look, type Opts } from './chibi.ts';
import './items3.ts';
import { meadow } from './scenes.ts';
import { locationSvg, CRYSTALS } from '../../src/lib/locations.ts';

const out = process.argv[2] ?? 'mockup022.html';
const INK = '#2B2035';
const C = { bg: '#0B0A14', accent: '#FF6B8A', me: '#8FA2FF', partner: '#FF9EBB', good: '#5ED3A0', warn: '#FFC266', sleep: '#9B8CFF', text: '#F6F3FF', muted: '#B9B2CC', third: '#5ED3A0' };
type A = Record<string, string | number>;
const rect = (x: number, y: number, w: number, h: number, fill: string, o: A = {}) => el('rect', { x, y, width: w, height: h, fill, ...o });
const circ = (cx: number, cy: number, r: number, fill: string, o: A = {}) => el('circle', { cx, cy, r, fill, ...o });
const pth = (d: string, fill: string, o: A = {}) => el('path', { d, fill, ...o });
const stroke = (d: string, color: string, w: number, o: A = {}) => el('path', { d, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...o });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const txt = (x: number, y: number, s: string, size: number, o: A = {}) =>
  el('text', { x, y, 'font-size': size, fill: C.text, 'font-family': 'Nunito, system-ui, sans-serif', 'font-weight': 800, 'text-anchor': 'middle', ...o }, esc(s));
const head = (x: number, y: number, s: string, size: number, o: A = {}) => txt(x, y, s, size, { 'font-family': 'Unbounded, sans-serif', 'font-weight': 700, 'paint-order': 'stroke', ...o });
const textW = (s: string, size: number) => s.length * size * 0.56;

// ---------- люди в комнате ----------
const GASTER: Look = { skin: 1, hair: { id: 'hair.vikhor', c: 'coal' }, eyes: { id: 'eyes.classic' }, top: { id: 'top.hoodie', c: 'blueberry' }, bottom: { id: 'bottom.pants', c: 'coal' }, shoes: { id: 'shoes.kedy' } };
const SONYA: Look = { skin: 1, hair: { id: 'hair.long', c: 'chocolate' }, eyes: { id: 'eyes.lashes' }, hat: { id: 'hat.bow' }, top: { id: 'top.dress', c: 'strawberry' }, shoes: { id: 'shoes.sapozhki', c: 'coal' } };
const BOT: Look = { skin: 2, hair: { id: 'hair.ponytail', c: 'pink' }, eyes: { id: 'eyes.classic' }, top: { id: 'top.tee', c: 'mint' }, bottom: { id: 'bottom.pants' }, shoes: { id: 'shoes.kedy' } };
type Who = { look: Look; name: string; role: string; color: string };
const G: Who = { look: GASTER, name: 'Gaster', role: 'владелец', color: C.me };
const S: Who = { look: SONYA, name: 'Соня', role: 'друг', color: C.partner };
const B: Who = { look: BOT, name: 'Тестик', role: 'бот', color: C.third };

// Чибик ногами в точке (x, y), масштаб s (1 = 120 px в ширину), flip — смотрит влево
function put(look: Look, o: Opts, x: number, y: number, s: number, flip = false, extra: A = {}) {
  const t = flip ? `translate(${x + 60 * s} ${y - 163 * s}) scale(${-s} ${s})` : `translate(${x - 60 * s} ${y - 163 * s}) scale(${s})`;
  return g(chibi(look, o), { transform: t, ...extra });
}
// Плашка «имя · роль» над головой
function tag(x: number, y: number, w: Who, online = true) {
  const label = `${w.name} · ${w.role}`;
  const width = textW(label, 12.5) + 30;
  return g(
    rect(x - width / 2, y - 13, width, 24, 'rgba(24,18,40,0.72)', { rx: 12, stroke: 'rgba(255,255,255,0.14)' }) +
      circ(x - width / 2 + 12, y - 1, 3.6, online ? C.good : '#7D7690') +
      txt(x + 6, y + 3.6, label, 12.5, { fill: C.text }),
  );
}
// Человек на сцене: чибик + плашка. Масштаб зависит от глубины (дальше — меньше)
const depth = (y: number) => 0.6 + ((y - 520) / 300) * 0.32;
function person(w: Who, x: number, y: number, o: Opts = {}, flip = false, online = true, extra: A = {}) {
  const s = depth(y);
  return g(put(w.look, o, x, y, s, flip) + tag(x, y - 150 * s - 10, w, online), extra);
}

// ---------- значки (24×24, рисуем сами — не эмодзи) ----------
const ICON: Record<string, (c: string) => string> = {
  back: (c) => stroke('M15 5 L8 12 L15 19', c, 2.6),
  exit: (c) => stroke('M10 4 H5.5 C4.7 4 4 4.7 4 5.5 V18.5 C4 19.3 4.7 20 5.5 20 H10 M14 8 L18 12 L14 16 M18 12 H9', c, 2.2),
  heart: (c) => pth('M12 20 C6 15.5 3 12.4 3 8.6 C3 6 5 4 7.6 4 C9.5 4 11 5 12 6.6 C13 5 14.5 4 16.4 4 C19 4 21 6 21 8.6 C21 12.4 18 15.5 12 20 Z', c),
  hand: (c) => stroke('M8 13 V6.5 a1.5 1.5 0 0 1 3 0 V11 M11 11 V5 a1.5 1.5 0 0 1 3 0 V11 M14 11 V6 a1.5 1.5 0 0 1 3 0 V13 M17 11 a1.5 1.5 0 0 1 3 0 V14 C20 18 17 21 13 21 C10 21 8.4 19.6 6.8 17.4 L4.4 14 a1.6 1.6 0 0 1 2.6 -1.8 L8 13.4', c, 1.9),
  wheel: (c) => circ(12, 12, 8.5, 'none', { stroke: c, 'stroke-width': 2.2 }) + stroke('M12 3.5 V20.5 M3.5 12 H20.5 M6 6 L18 18 M18 6 L6 18', c, 1.4) + circ(12, 12, 2.4, c),
  pin: (c) => pth('M12 21 C8 16.5 5.5 13 5.5 9.6 C5.5 6 8.4 3 12 3 C15.6 3 18.5 6 18.5 9.6 C18.5 13 16 16.5 12 21 Z', 'none', { stroke: c, 'stroke-width': 2.2 }) + circ(12, 9.6, 2.6, c),
  smile: (c) => circ(12, 12, 8.6, 'none', { stroke: c, 'stroke-width': 2.2 }) + stroke('M8.4 14 C10 16.4 14 16.4 15.6 14', c, 2) + circ(9, 10, 1.3, c) + circ(15, 10, 1.3, c),
  flame: (c) => pth('M12 21 C7.6 21 5 18 5 14.6 C5 11 7.6 8.8 9 6 C9.6 8 10.6 9 12 9.4 C11.8 7 12.6 4.6 14.6 3 C15 6.4 19 9.4 19 14.4 C19 18 16.4 21 12 21 Z', c),
  user: (c) => circ(12, 8, 4, 'none', { stroke: c, 'stroke-width': 2.2 }) + stroke('M4.5 20 C5.5 16 8.4 14 12 14 C15.6 14 18.5 16 19.5 20', c, 2.2),
  trophy: (c) => stroke('M7 4 H17 V9 C17 12 15 14 12 14 C9 14 7 12 7 9 Z M7 6 H4.5 C4.5 9 5.6 10.4 7.4 10.8 M17 6 H19.5 C19.5 9 18.4 10.4 16.6 10.8 M12 14 V17.5 M8 20 H16 M9.5 20 V17.5 H14.5 V20', c, 1.9),
  locate: (c) => circ(12, 12, 6, 'none', { stroke: c, 'stroke-width': 2.2 }) + circ(12, 12, 2.2, c) + stroke('M12 2.5 V5.5 M12 18.5 V21.5 M2.5 12 H5.5 M18.5 12 H21.5', c, 2.2),
};
const icon = (name: string, x: number, y: number, size: number, color: string) =>
  g(ICON[name](color), { transform: `translate(${x - size / 2} ${y - size / 2}) scale(${size / 24})` });

// Реакции: цветные значки в белом облачке
const REACT: Record<string, string> = {
  heart: pth('M0 9 C-7 3.6 -10.4 0 -10.4 -4.4 C-10.4 -7.4 -8.2 -9.8 -5.2 -9.8 C-3 -9.8 -1.2 -8.6 0 -6.8 C1.2 -8.6 3 -9.8 5.2 -9.8 C8.2 -9.8 10.4 -7.4 10.4 -4.4 C10.4 0 7 3.6 0 9 Z', C.accent, { stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }),
  laugh: circ(0, 0, 10.5, '#FFD45E', { stroke: INK, 'stroke-width': 1.6 }) + stroke('M-6 -2.6 L-3.4 -4.4 L-6 -5.8 M6 -2.6 L3.4 -4.4 L6 -5.8', INK, 1.5) + pth('M-6 1 C-5 7 5 7 6 1 Z', '#FFFFFF', { stroke: INK, 'stroke-width': 1.4 }),
  wow: circ(0, 0, 10.5, '#FFD45E', { stroke: INK, 'stroke-width': 1.6 }) + circ(-3.6, -2.6, 1.8, INK) + circ(3.6, -2.6, 1.8, INK) + el('ellipse', { cx: 0, cy: 4.4, rx: 2.6, ry: 3.4, fill: INK }),
  fire: pth('M0 10.5 C-6 10.5 -8.6 6.4 -8.6 2.4 C-8.6 -2.4 -5 -5 -3.4 -9 C-2.4 -6.4 -1 -5 0.6 -4.6 C0.4 -7.6 1.6 -10.4 4.4 -12 C4.8 -7.6 8.6 -4 8.6 2 C8.6 6.6 5.4 10.5 0 10.5 Z', '#FF8A3D', { stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }) + pth('M0 9 C-3 9 -4 6.6 -4 4.8 C-4 2.4 -2 1 -1 -1.4 C0 0.6 1 1.4 2.4 1.6 C3.4 3 4 4.4 4 5.6 C4 7.6 2.6 9 0 9 Z', '#FFE38A'),
  tear: pth('M0 -11 C4 -5 7.4 -0.6 7.4 3.4 C7.4 7.6 4 10.6 0 10.6 C-4 10.6 -7.4 7.6 -7.4 3.4 C-7.4 -0.6 -4 -5 0 -11 Z', '#7CC8FF', { stroke: INK, 'stroke-width': 1.6 }) + el('ellipse', { cx: -2.6, cy: 3, rx: 1.8, ry: 3, fill: '#FFFFFF', opacity: 0.7 }),
  star: pth('M0 -11 L3.2 -3.6 L11 -3.2 L5 1.8 L7 9.6 L0 5.4 L-7 9.6 L-5 1.8 L-11 -3.2 L-3.2 -3.6 Z', '#FFD45E', { stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }),
};
const bubble = (x: number, y: number, kind: string, r = 19) =>
  g(circ(0, 0, r, '#FFFFFF', { stroke: INK, 'stroke-width': 1.8 }) + pth(`M-5 ${r - 1.6} L0 ${r + 6} L5 ${r - 1.6} Z`, '#FFFFFF') + g(REACT[kind], { transform: `scale(${r / 19})` }), { transform: `translate(${x} ${y})` });

// ---------- интерфейс комнаты ----------
function topBar(title: string, sub: string) {
  return (
    circ(36, 66, 20, 'rgba(24,18,40,0.66)', { stroke: 'rgba(255,255,255,0.14)' }) + icon('back', 36, 66, 20, C.text) +
    head(195, 62, title, 16) + txt(195, 82, sub, 12, { fill: C.muted, 'font-weight': 700 }) +
    rect(296, 48, 78, 36, 'rgba(24,18,40,0.66)', { rx: 18, stroke: 'rgba(255,255,255,0.14)' }) + icon('exit', 316, 66, 18, C.text) + txt(347, 70.5, 'Выйти', 13)
  );
}
function bottomBar(active = '') {
  const items: [string, string, string][] = [['smile', 'Реакции', 'r'], ['hand', 'Все — пять', 'f'], ['wheel', 'Играть', 'p'], ['pin', 'Место', 'm']];
  let s = rect(16, 756, 358, 66, 'rgba(24,18,40,0.82)', { rx: 33, stroke: 'rgba(255,255,255,0.13)' });
  items.forEach(([ic, label, key], i) => {
    const x = 16 + 358 * ((i + 0.5) / 4);
    const on = key === active || (key === 'p' && !active);
    if (key === 'p') s += rect(x - 40, 762, 80, 54, on ? 'rgba(255,107,138,0.22)' : 'none', { rx: 27 });
    s += icon(ic, x, 780, 22, key === 'p' ? C.accent : C.text) + txt(x, 806, label, 11.5, { fill: key === 'p' ? C.accent : C.muted });
  });
  return s;
}
const meButton = () => rect(286, 700, 88, 38, 'rgba(24,18,40,0.72)', { rx: 19, stroke: 'rgba(255,255,255,0.14)' }) + icon('locate', 306, 719, 18, C.text) + txt(340, 723.5, 'К себе', 12.5);
const edgeArrow = (w: Who, y: number, side: 'L' | 'R') => {
  const label = w.name;
  const width = textW(label, 12.5) + 44;
  const x = side === 'R' ? 390 - width - 6 : 6;
  const arrow = side === 'R' ? stroke(`M${x + width - 18} ${y - 6} L${x + width - 12} ${y} L${x + width - 18} ${y + 6}`, C.text, 2.2) : stroke(`M${x + 18} ${y - 6} L${x + 12} ${y} L${x + 18} ${y + 6}`, C.text, 2.2);
  return rect(x, y - 16, width, 32, 'rgba(24,18,40,0.72)', { rx: 16, stroke: w.color, 'stroke-width': 1.5 }) + circ(side === 'R' ? x + 14 : x + width - 14, y, 3.6, C.good) + txt(x + width / 2, y + 4.4, label, 12.5) + arrow;
};
const pill = (x: number, y: number, label: string, o: { fill?: string; color?: string; size?: number; stroke?: string } = {}) => {
  const size = o.size ?? 13;
  const w = textW(label, size) + 30;
  return rect(x - w / 2, y - size - 4, w, size + 16, o.fill ?? 'rgba(24,18,40,0.8)', { rx: (size + 16) / 2, stroke: o.stroke ?? 'rgba(255,255,255,0.14)' }) + txt(x, y + 1, label, size, { fill: o.color ?? C.text });
};
const dim = (op = 0.5) => rect(0, 0, 390, 844, `rgba(8,5,18,${op})`);
const card = (x: number, y: number, w: number, h: number, body: string) =>
  rect(x, y, w, h, 'rgba(28,23,48,0.94)', { rx: 22, stroke: 'rgba(255,255,255,0.13)' }) + body;
const btn = (x: number, y: number, w: number, label: string, primary = false) =>
  rect(x, y, w, 44, primary ? C.accent : 'rgba(255,255,255,0.08)', { rx: 22, stroke: primary ? 'none' : 'rgba(255,255,255,0.14)' }) + txt(x + w / 2, y + 27.5, label, 14, { fill: primary ? '#1A0F1F' : C.text });

// Искры и звёзды
const spark = (x: number, y: number, s: number, fill: string, o: A = {}) =>
  pth('M0 -10 C1 -3 3 -1 10 0 C3 1 1 3 0 10 C-1 3 -3 1 -10 0 C-3 -1 -1 -3 0 -10 Z', fill, { transform: `translate(${x} ${y}) scale(${s})`, ...o });
const star = (x: number, y: number, s: number, fill: string) =>
  pth('M0 -11 L3.2 -3.6 L11 -3.2 L5 1.8 L7 9.6 L0 5.4 L-7 9.6 L-5 1.8 L-11 -3.2 L-3.2 -3.6 Z', fill, { stroke: INK, 'stroke-width': 1.5, 'stroke-linejoin': 'round', transform: `translate(${x} ${y}) scale(${s})` });
const SKULL = 'M0 -14 C-9 -14 -15 -8 -15 0 C-15 5 -12 8.5 -9 10 V15 H-4.5 V12 H-1.5 V15 H1.5 V12 H4.5 V15 H9 V10 C12 8.5 15 5 15 0 C15 -8 9 -14 0 -14 Z';
const skull = (x: number, y: number, s: number, rot = 0, op = 1) =>
  g(pth(SKULL, '#F4F0FF', { stroke: INK, 'stroke-width': 1.6 }) + circ(-5.5, 0, 4, INK) + circ(5.5, 0, 4, INK) + pth('M0 5 L-1.8 8 H1.8 Z', INK), { transform: `translate(${x} ${y}) rotate(${rot}) scale(${s})`, opacity: op });

// ---------- телефон ----------
let clipN = 0;
function phone(content: string, caption: string, note = '', cls = '') {
  const id = `ph${++clipN}`;
  const svg = el('svg', { viewBox: '0 0 390 844', class: 'screen' }, el('defs', {}, el('clipPath', { id }, rect(0, 0, 390, 844, '#000', { rx: 38 }))) + g(content, { 'clip-path': `url(#${id})` }));
  return `<figure class="phone ${cls}">${svg}<figcaption>${caption}${note ? `<small>${note}</small>` : ''}</figcaption></figure>`;
}
const forest = (t: 'day' | 'evening' | 'night') => locationSvg('forest', t);

// 1. Комната: большая площадка, видно себя и Соню, Тестик за краем
const roomMain = phone(
  forest('evening') +
    person(G, 120, 560, { emotion: 'joy', value: 55 }, false) +
    person(S, 250, 690, { emotion: 'love', value: 60 }, true) +
    bubble(250, 482, 'heart') +
    edgeArrow(B, 600, 'R') +
    stroke('M196 560 C210 600 240 640 252 676', 'rgba(255,255,255,0.0)', 0) +
    topBar('Комната', '3 из 3 · Лес с костром') + meButton() + bottomBar(),
  'Комната',
  'Площадка шире экрана. Камера идёт за тобой, свайп — осмотреться. Тестик за краем — стрелка с именем',
);

// 2. Меню на чужом чибике
const menuX = 208;
const roomMenu = phone(
  forest('evening') +
    person(G, 110, 600, { emotion: 'joy', value: 40 }) +
    person(B, 268, 640, { emotion: 'calm', value: 50 }, true) +
    card(menuX - 6, 312, 186, 196,
      head(menuX + 87, 344, 'Тестик · бот', 13) +
      [['hand', 'Дай пять', C.text, ''], ['heart', 'Объятия', C.partner, ''], ['flame', 'Мог', C.warn, '12 с']]
        .map(([ic, label, col, cd], i) => {
          const y = 362 + i * 46;
          return rect(menuX + 6, y, 162, 40, 'rgba(255,255,255,0.06)', { rx: 20 }) + icon(ic, menuX + 28, y + 20, 20, col) + txt(menuX + 46, y + 25, label, 14, { 'text-anchor': 'start', opacity: cd ? 0.55 : 1 }) + (cd ? txt(menuX + 156, y + 25, cd, 12, { 'text-anchor': 'end', fill: C.warn }) : '');
        })
        .join('')) +
    pth(`M${menuX + 70} 508 L${menuX + 82} 522 L${menuX + 94} 508 Z`, 'rgba(28,23,48,0.94)') +
    topBar('Комната', '3 из 3 · Лес с костром') + bottomBar(),
  'Меню на чибике',
  'Нажал на чужого: «Дай пять» и все твои способности. Перезарядка в комнате — 15 с',
);

// 3. Реакции над своим чибиком
const kinds = ['heart', 'laugh', 'wow', 'fire', 'tear', 'star'];
const roomReact = phone(
  forest('evening') +
    person(S, 315, 730, { emotion: 'joy', value: 70 }, true) + bubble(315, 548, 'laugh') +
    person(G, 140, 640, { emotion: 'joy', value: 50 }) +
    card(14, 408, 264, 64, kinds.map((k, i) => bubble(42 + i * 42, 440, k, 17)).join('')) +
    topBar('Комната', '3 из 3 · Лес с костром') + bottomBar('r'),
  'Реакции',
  'Нажал на своего чибика или «Реакции». Облачко висит 3 с, видят все',
);

// 4. Все — дай пять
const burst = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2;
  return spark(195 + Math.cos(a) * 96, 470 + Math.sin(a) * 70, 0.9 + (i % 3) * 0.3, ['#FFD45E', '#FF9EBB', '#8FA2FF', '#5ED3A0'][i % 4]);
}).join('');
const roomFive = phone(
  forest('night') +
    circ(195, 520, 120, '#FFD45E', { opacity: 0.12 }) + burst +
    put(G.look, { emotion: 'joy', value: 90, pose: 'cheer' }, 140, 640, 0.8) +
    put(B.look, { emotion: 'joy', value: 90, pose: 'cheer' }, 250, 640, 0.8, true) +
    put(S.look, { emotion: 'joy', value: 90, pose: 'cheer' }, 195, 690, 0.86) +
    head(195, 420, 'Хлоп!', 30, { fill: '#FFD45E', stroke: INK, 'stroke-width': 1.2 }) +
    topBar('Комната', '3 из 3 · Лес с костром') + bottomBar('f'),
  'Все — дай пять!',
  'Все, кто в сети, сбегаются в центр: общий прыжок и салют',
);

// 5. «Мог» в комнате: третий смотрит
const skulls = [[150, 470, 1.2, -14], [250, 450, 1.4, 10], [320, 540, 1, 18], [90, 560, 1.1, -20], [210, 380, 0.9, 4]].map(([x, y, s, r]) => skull(x, y, s, r)).join('');
const roomMog = phone(
  forest('evening') +
    dim(0.62) + skulls +
    put(G.look, { emotion: 'passion', value: 80, mog: true }, 170, 660, 0.9) +
    put(B.look, { emotion: 'sadness', value: 60, pose: 'fallen' }, 270, 690, 0.8, true) +
    spark(262, 600, 1.2, '#FFD45E') + spark(296, 590, 0.8, '#FFD45E') +
    put(S.look, { emotion: 'anxiety', value: 50 }, 330, 560, 0.62, true, { opacity: 0.9 }) +
    head(195, 300, 'МОГ', 54, { fill: C.text, stroke: INK, 'stroke-width': 2, 'letter-spacing': 4 }) +
    rect(0, 0, 390, 70, '#000') + rect(0, 774, 390, 70, '#000') +
    pill(195, 112, 'Gaster → Тестик: Мог', { fill: 'rgba(255,194,102,0.18)', color: C.warn, stroke: C.warn }),
  'Способность на любого',
  'Сцена у всех: затемнение на всю комнату, Соня смотрит. Плашка — кто и на кого',
);

// 6. Комната занята
const busyRow = (w: Who, y: number, note: string, online: boolean) =>
  circ(52, y, 18, w.color, { opacity: 0.25 }) + icon('user', 52, y, 18, w.color) +
  txt(80, y - 2, `${w.name} · ${w.role}`, 14, { 'text-anchor': 'start' }) + txt(80, y + 16, note, 12, { 'text-anchor': 'start', fill: online ? C.good : C.muted, 'font-weight': 700 }) +
  rect(268, y - 17, 86, 34, 'rgba(255,107,138,0.16)', { rx: 17, stroke: 'rgba(255,107,138,0.4)' }) + txt(311, y + 4.6, 'Вывести', 12.5, { fill: C.accent });
const roomBusy = phone(
  forest('day') + dim(0.7) +
    card(20, 230, 350, 380,
      head(195, 278, 'Комната занята', 18) + txt(195, 304, '3 из 3 мест', 13, { fill: C.muted, 'font-weight': 700 }) +
      busyRow(G, 360, 'в сети', true) + busyRow(S, 424, 'в сети', true) + busyRow(B, 488, 'позвал Gaster', false) +
      btn(40, 540, 310, 'Назад')),
  '«Комната занята»',
  'Кто внутри и кто в сети. «Вывести» — только у владельца',
);

// 7. Колесо
const WHEEL = [['Горячая тыква', '#FF9A3D'], ['Звездопад', '#9B8CFF'], ['Реакция', '#5ED3A0'], ['Камень, ножницы, бумага', '#8FA2FF']];
function wheel(cx: number, cy: number, r: number, rot: number) {
  let s = circ(cx, cy, r + 10, '#2B2035', { stroke: '#FFD45E', 'stroke-width': 3 });
  WHEEL.forEach(([, col], i) => {
    const a0 = ((i * 90 - 90 + rot) * Math.PI) / 180;
    const a1 = (((i + 1) * 90 - 90 + rot) * Math.PI) / 180;
    s += pth(`M${cx} ${cy} L${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z`, col, { stroke: INK, 'stroke-width': 2 });
  });
  const labels = ['Тыква', 'Звездопад', 'Реакция', 'КНБ'];
  labels.forEach((label, i) => {
    const a = i * 90 + 45 + rot;
    s += g(head(0, -r * 0.58, label, 13, { fill: INK }), { transform: `translate(${cx} ${cy}) rotate(${a})` });
  });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    s += circ(cx + (r + 5) * Math.cos(a), cy + (r + 5) * Math.sin(a), 2.6, '#FFF4C2');
  }
  s += circ(cx, cy, 26, '#2B2035', { stroke: '#FFD45E', 'stroke-width': 3 }) + icon('wheel', cx, cy, 24, '#FFD45E');
  s += pth(`M${cx - 16} ${cy - r - 22} L${cx + 16} ${cy - r - 22} L${cx} ${cy - r + 8} Z`, C.accent, { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' });
  return s;
}
const chips = (y: number, list: [Who, string][]) => {
  const w = 108;
  const x0 = 195 - (list.length * w + (list.length - 1) * 8) / 2;
  return list.map(([who, note], i) => {
    const x = x0 + i * (w + 8);
    return rect(x, y, w, 46, 'rgba(24,18,40,0.8)', { rx: 16, stroke: who.color, 'stroke-width': 1.4 }) + txt(x + w / 2, y + 20, who.name, 13) + txt(x + w / 2, y + 37, note, 11.5, { fill: C.muted, 'font-weight': 700 });
  }).join('');
};
const roomWheel = phone(
  forest('evening') + dim(0.66) +
    head(195, 150, 'Во что играем?', 20) + txt(195, 176, 'Колесо крутит Gaster', 13, { fill: C.muted, 'font-weight': 700 }) +
    wheel(195, 400, 140, 20) +
    chips(600, [[G, 'играет'], [S, 'играет'], [B, 'бот']]) +
    txt(195, 690, 'Одна и та же игра два раза подряд не выпадает', 12.5, { fill: C.muted, 'font-weight': 700 }),
  'Колесо',
  '4 с, щелчки. Игру выбирает сервер, у всех крутится одинаково',
);

// 8. Горячая тыква
const pumpkin = (x: number, y: number, s: number) =>
  g(
    circ(0, 0, 26, '#FFB347', { opacity: 0.35 }) +
      pth('M-11 0 C-13 -9 -6 -13 0 -12 C6 -13 13 -9 11 0 C13 9 6 13 0 12 C-6 13 -13 9 -11 0 Z', '#FF9A3D', { stroke: INK, 'stroke-width': 1.8 }) +
      stroke('M-5 -11 C-7 -4 -7 4 -5 11 M5 -11 C7 -4 7 4 5 11', '#D9772A', 1.3) +
      pth('M-1.6 -12 L-1 -16 L1.4 -16 L1.6 -12 Z', '#4E8A3E', { stroke: INK, 'stroke-width': 1.2 }) +
      stroke('M1 -16 C4 -20 8 -19 9 -23', '#8A5A44', 1.8) +
      spark(10, -25, 0.55, '#FFE38A') + circ(10, -25, 5, '#FFD45E', { opacity: 0.45 }),
    { transform: `translate(${x} ${y}) scale(${s})` },
  );
const soot = (x: number, y: number, s: number) =>
  g(circ(-14, -4, 6, '#2B2035', { opacity: 0.35 }) + circ(12, 2, 5, '#2B2035', { opacity: 0.3 }) + circ(0, 10, 4, '#2B2035', { opacity: 0.3 }), { transform: `translate(${x} ${y}) scale(${s})` });
const roomPumpkin = phone(
  forest('night') +
    person(S, 120, 620, { emotion: 'anxiety', value: 70 }) +
    pumpkin(120, 470, 1.5) +
    person(B, 290, 600, { emotion: 'calm', value: 40 }, true) +
    stroke('M150 460 C200 400 250 420 286 470', '#FFD45E', 2.4, { 'stroke-dasharray': '6 7' }) +
    pth('M280 462 L290 474 L276 476 Z', '#FFD45E') +
    g(person(G, 210, 740, { emotion: 'sadness', value: 60 }, false, true) + soot(210, 610, 1.4), { opacity: 0.6 }) +
    pill(210, 812, 'Gaster выбыл', { color: C.muted, size: 12 }) +
    pill(195, 130, 'Горячая тыква · раунд 2', { size: 14 }) +
    txt(195, 172, 'Нажми на соседа — передай тыкву', 13, { fill: C.warn }),
  'Горячая тыква',
  'Фитиль 8–20 с, длину никто не видит. Бахнуло — держащий в саже и выбывает',
);

// 9. Звездопад
const shadow = (x: number, y: number, r: number) => el('ellipse', { cx: x, cy: y, rx: r, ry: r * 0.32, fill: '#FFD45E', opacity: 0.3, stroke: '#FFD45E', 'stroke-width': 1.2, 'stroke-dasharray': '3 4' });
const falling = (x: number, y: number, s: number, fill: string) => stroke(`M${x - 6} ${y - 50} L${x} ${y - 14}`, fill, 3, { opacity: 0.35 }) + star(x, y, s, fill);
const cloud = (x: number, y: number) =>
  g(pth('M-26 8 C-34 8 -36 -2 -28 -5 C-28 -15 -14 -18 -8 -11 C-4 -20 12 -21 16 -11 C24 -15 34 -8 30 2 C34 6 30 10 24 10 Z', '#6E6890', { stroke: INK, 'stroke-width': 1.6 }) + pth('M-2 10 L-8 22 L-1 22 L-6 34 L8 18 L1 18 L6 10 Z', '#FFD45E', { stroke: INK, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }), { transform: `translate(${x} ${y})` });
const scoreBar = (list: [Who, string][]) => {
  let x = 24;
  return list.map(([w, n]) => {
    const label = `${w.name} ${n}`;
    const width = textW(label, 13) + 28;
    const s = rect(x, 108, width, 32, 'rgba(24,18,40,0.78)', { rx: 16, stroke: w.color, 'stroke-width': 1.4 }) + txt(x + width / 2, 129, label, 13);
    x += width + 8;
    return s;
  }).join('');
};
const roomStars = phone(
  forest('night') +
    falling(90, 300, 1.3, '#FFD45E') + shadow(90, 640, 18) +
    falling(300, 360, 2, '#FFB800') + shadow(300, 700, 26) +
    falling(200, 250, 1.1, '#FFD45E') + shadow(200, 600, 16) +
    falling(320, 190, 1.2, '#FFD45E') +
    cloud(150, 420) + shadow(150, 760, 22) +
    person(S, 270, 690, { emotion: 'joy', value: 70, pose: 'run' }, false) +
    person(G, 120, 620, { emotion: 'passion', value: 60, pose: 'run' }, true) +
    person(B, 230, 590, { emotion: 'calm', value: 40, pose: 'run' }) +
    head(195, 70, '0:18', 22) +
    scoreBar([[S, '7'], [G, '5'], [B, '4']]) +
    txt(195, 818, 'Золотая — 3 очка · тучка оглушает на 1 с', 12.5, { fill: C.muted, 'font-weight': 700 }),
  'Звездопад',
  '30 с. На земле видна тень, куда упадёт звезда, — беги туда',
);

// 10. Реакция
const lamp = (x: number, y: number, on: boolean) =>
  rect(x - 6, y + 40, 12, 170, '#3A3346', { stroke: INK, 'stroke-width': 2 }) +
  circ(x, y, 90, on ? '#5ED3A0' : '#E5566B', { opacity: 0.22 }) +
  circ(x, y, 44, on ? '#5ED3A0' : '#E5566B', { stroke: INK, 'stroke-width': 3 }) +
  circ(x - 14, y - 14, 10, '#FFFFFF', { opacity: 0.4 });
const timeTag = (x: number, y: number, t: string, col: string) => pill(x, y, t, { fill: 'rgba(24,18,40,0.82)', color: col, stroke: col, size: 13 });
const roomReaction = phone(
  forest('evening') + dim(0.25) +
    pill(195, 120, 'Реакция · раунд 3 из 5', { size: 14 }) +
    lamp(195, 250, true) +
    put(G.look, { emotion: 'joy', value: 60 }, 90, 660, 0.72) + timeTag(90, 520, '0,36 с', C.text) +
    put(S.look, { emotion: 'joy', value: 90, pose: 'cheer' }, 195, 700, 0.8) + timeTag(195, 548, '0,31 с · очко', C.good) +
    put(B.look, { emotion: 'sadness', value: 50 }, 300, 660, 0.72, true) + timeTag(300, 520, 'фальстарт', C.warn) +
    txt(195, 790, 'Жми, когда загорится зелёный', 14, { fill: C.muted }),
  'Реакция',
  'Время меряет твой телефон — задержка связи не мешает',
);

// 11. Камень, ножницы, бумага
const RPS: Record<string, string> = {
  rock: pth('M-11 2 C-12 -6 -6 -11 0 -11 C7 -11 12 -6 11 2 C11 9 6 12 0 12 C-7 12 -11 8 -11 2 Z', '#FFDCC4', { stroke: INK, 'stroke-width': 1.8 }) + stroke('M-6 -4 C-6 0 -6 2 -5 4 M0 -5 V3 M6 -4 C6 0 6 2 5 4', INK, 1.4),
  paper: pth('M-10 12 V-4 C-10 -6 -7 -6 -7 -4 V-12 C-7 -14 -4 -14 -4 -12 V-14 C-4 -16 -1 -16 -1 -14 V-12 C-1 -14 2 -14 2 -12 V-10 C2 -12 5 -12 5 -10 V2 L8 -2 C9 -4 12 -2 11 0 L5 10 C4 12 2 12 0 12 Z', '#FFDCC4', { stroke: INK, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }),
  scissors: pth('M-8 12 C-10 6 -9 2 -6 -1 L-9 -13 C-9.6 -15.6 -6 -16.4 -5.2 -14 L-2 -4 L2 -15 C3 -17.4 6.4 -16.4 5.8 -14 L3 -1 C7 1 8 6 6 12 Z', '#FFDCC4', { stroke: INK, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }),
};
const handBubble = (x: number, y: number, k: string) => g(circ(0, 0, 26, '#FFFFFF', { stroke: INK, 'stroke-width': 2 }) + g(RPS[k], { transform: 'scale(1.3)' }), { transform: `translate(${x} ${y})` });
const roomRps = phone(
  forest('day') +
    head(195, 170, 'Раз!', 46, { fill: '#FFFFFF', stroke: INK, 'stroke-width': 1.6 }) +
    put(G.look, { emotion: 'joy', value: 70 }, 90, 640, 0.74) + handBubble(90, 470, 'rock') +
    put(S.look, { emotion: 'joy', value: 70 }, 195, 680, 0.8) + handBubble(195, 500, 'rock') +
    put(B.look, { emotion: 'sadness', value: 70 }, 300, 640, 0.74, true) + handBubble(300, 470, 'scissors') +
    card(30, 720, 330, 72, txt(195, 750, 'Камень бьёт ножницы', 15) + txt(195, 774, 'Тестик выбыл · Gaster и Соня — дальше', 13, { fill: C.muted, 'font-weight': 700 })),
  'Камень, ножницы, бумага',
  '5 с на выбор. Все одинаково или все три разных — переигровка',
);

// 12. Пьедестал
const podium = (x: number, top: number, w: number, n: string, col: string) =>
  rect(x - w / 2, top, w, 640 - top + 40, col, { rx: 10, stroke: INK, 'stroke-width': 2 }) + head(x, top + 40, n, 28, { fill: INK });
const SONYA_WIN: Look = { ...SONYA, hand: { id: 'hand.trophy' } };
const roomPodium = phone(
  forest('evening') + dim(0.5) +
    Array.from({ length: 14 }, (_, i) => rect(30 + ((i * 53) % 330), 150 + ((i * 97) % 220), 6, 12, ['#FFD45E', '#FF9EBB', '#8FA2FF', '#5ED3A0'][i % 4], { rx: 2, transform: `rotate(${(i * 37) % 90} ${33 + ((i * 53) % 330)} ${156 + ((i * 97) % 220)})` })).join('') +
    head(195, 120, 'Победа — Соня!', 22) + pill(195, 160, 'Новый рекорд!', { fill: 'rgba(94,211,160,0.18)', color: C.good, stroke: C.good, size: 13 }) +
    podium(195, 470, 104, '1', '#FFD45E') + podium(90, 520, 96, '2', '#D9D4E8') + podium(300, 550, 96, '3', '#E0A070') +
    put(SONYA_WIN, { emotion: 'joy', value: 95, pose: 'cheer' }, 195, 470, 0.72) +
    put(GASTER, { emotion: 'joy', value: 50 }, 90, 520, 0.64) +
    put(BOT, { emotion: 'calm', value: 50 }, 300, 550, 0.6, true) +
    card(20, 640, 350, 180,
      el('svg', { x: 30, y: 652, width: 74, height: 90, viewBox: '70 116 44 44' }, ITEMS['hand.trophy'].layers.handR!({ col: '', skin: '' })) +
      txt(112, 684, 'Кубок победителя', 16, { 'text-anchor': 'start' }) + txt(112, 708, 'Первая победа · уже в инвентаре', 12.5, { 'text-anchor': 'start', fill: C.muted, 'font-weight': 700 }) +
      btn(36, 754, 150, 'Закрыть') + btn(198, 754, 156, 'Ещё раз', true)),
  'Пьедестал',
  'Места, «Новый рекорд!» и награда. Награды и рекорды — если играли хотя бы 2 человека',
);

// 13. Рекорды
const recRow = (y: number, cells: string[], hl = false) =>
  (hl ? rect(26, y - 22, 338, 34, 'rgba(143,162,255,0.14)', { rx: 12 }) : '') +
  txt(46, y, cells[0], 14, { 'text-anchor': 'middle', fill: C.muted }) + txt(68, y, cells[1], 14, { 'text-anchor': 'start' }) + txt(256, y, cells[2], 14, { 'text-anchor': 'end' }) + txt(346, y, cells[3], 14, { 'text-anchor': 'end', fill: C.good });
const tabs = ['Тыква', 'Звездопад', 'Реакция', 'КНБ'];
const roomRecords = phone(
  forest('evening') + dim(0.55) +
    rect(0, 230, 390, 640, 'rgba(28,23,48,0.97)', { rx: 30, stroke: 'rgba(255,255,255,0.13)' }) + rect(171, 242, 48, 5, 'rgba(255,255,255,0.25)', { rx: 2.5 }) +
    icon('trophy', 44, 282, 24, '#FFD45E') + head(66, 290, 'Рекорды', 19, { 'text-anchor': 'start' }) +
    tabs.map((t, i) => { const x = 26 + i * 86; return rect(x, 318, 80, 34, i === 1 ? C.accent : 'rgba(255,255,255,0.07)', { rx: 17 }) + txt(x + 40, 340, t, 12.5, { fill: i === 1 ? '#1A0F1F' : C.text }); }).join('') +
    txt(68, 388, 'Игрок', 12, { 'text-anchor': 'start', fill: C.muted, 'font-weight': 700 }) + txt(256, 388, 'Побед', 12, { 'text-anchor': 'end', fill: C.muted, 'font-weight': 700 }) + txt(346, 388, 'Лучший', 12, { 'text-anchor': 'end', fill: C.muted, 'font-weight': 700 }) +
    recRow(424, ['1', 'Соня', '6', '11 ⭑'.replace('⭑', 'зв.')]) + recRow(466, ['2', 'Gaster', '4', '9 зв.'], true) + recRow(508, ['3', 'Тестик', '—', 'бот']) +
    rect(26, 548, 338, 1, 'rgba(255,255,255,0.1)') +
    head(26, 590, 'Мои награды', 14, { 'text-anchor': 'start' }) +
    [['Кубок', '1 победа', true], ['Корона', '10 побед', false], ['Плащ', '25 побед', false]].map(([n, p, got], i) => {
      const x = 26 + i * 116;
      return rect(x, 606, 106, 92, got ? 'rgba(255,212,94,0.14)' : 'rgba(255,255,255,0.05)', { rx: 18, stroke: got ? '#FFD45E' : 'rgba(255,255,255,0.12)' }) + txt(x + 53, 646, n as string, 14, { fill: got ? '#FFD45E' : C.text }) + txt(x + 53, 670, p as string, 12, { fill: C.muted, 'font-weight': 700 }) + txt(x + 53, 688, got ? 'есть' : 'впереди', 11.5, { fill: got ? C.good : C.muted });
    }).join(''),
  'Рекорды',
  'Топ комнаты по каждой игре, свои цифры и награды',
);

// ---------- грибы ----------
const MUSH: [string, string][] = [['#E5484D', 'красный'], ['#4F8BFF', 'синий'], ['#FFC94D', 'жёлтый'], ['#B07BFF', 'фиолетовый'], ['#F4F0FF', 'белый']];
const MUSH_AT = [[64, 700], [156, 586], [262, 640], [338, 566], [318, 772]];
const bigShroom = (x: number, y: number, col: string, s = 1, glowOp = 0, wilt = 0) =>
  g(
    (glowOp ? circ(0, -14, 30, col, { opacity: glowOp }) : '') +
      el('ellipse', { cx: 0, cy: 2, rx: 12, ry: 3.4, fill: '#000', opacity: 0.22 }) +
      pth('M-5 2 C-6 -6 -5 -12 -4 -15 L4 -15 C5 -12 6 -6 5 2 Z', '#FFF6E6', { stroke: INK, 'stroke-width': 1.8 }) +
      g(pth('M-17 -13 C-17 -32 17 -32 17 -13 C10 -10 -10 -10 -17 -13 Z', col, { stroke: INK, 'stroke-width': 1.8 }) + circ(-7, -21, 2.6, '#FFFFFF', { opacity: col === '#F4F0FF' ? 0 : 0.95 }) + circ(5, -24, 2, '#FFFFFF', { opacity: col === '#F4F0FF' ? 0 : 0.95 }) + circ(9, -16, 1.6, '#FFFFFF', { opacity: col === '#F4F0FF' ? 0 : 0.95 }) + (col === '#F4F0FF' ? circ(-6, -20, 2.4, '#D9D4E8') + circ(6, -23, 2, '#D9D4E8') : ''), wilt ? { transform: `rotate(${wilt} 0 -14) translate(0 ${Math.abs(wilt) / 6})` } : {}),
    { transform: `translate(${x} ${y}) scale(${s})` },
  );
const shrooms = (night: boolean, skip = -1, wilt = false) =>
  MUSH_AT.map(([x, y], i) => (i === skip ? '' : bigShroom(x, y, MUSH[i][0], 1.15, night ? 0.22 : 0, wilt ? (i % 2 ? 24 : -24) : 0))).join('');
const basket = (filled: number[], shake = false) => {
  let s = rect(87, 104, 216, 58, 'rgba(24,18,40,0.82)', { rx: 29, stroke: 'rgba(255,255,255,0.15)' });
  s += pth('M100 120 C100 108 120 104 124 116', 'none', { stroke: '#C98A4B', 'stroke-width': 3 });
  for (let i = 0; i < 5; i++) {
    const x = 132 + i * 34;
    s += circ(x, 133, 14, 'rgba(255,255,255,0.06)', { stroke: 'rgba(255,255,255,0.18)', 'stroke-dasharray': filled[i] === undefined ? '3 3' : '' });
    if (filled[i] !== undefined) s += g(bigShroom(0, 0, MUSH[filled[i]][0], 0.62), { transform: `translate(${x} ${147})` });
  }
  return shake ? g(s, { transform: 'rotate(-3 195 133)' }) + stroke('M76 118 L68 112 M76 140 L66 144 M314 118 L322 112 M314 140 L324 144', C.warn, 2.4) : s;
};
const mushPick = phone(
  forest('night') + shrooms(true, 3) +
    put(G.look, { emotion: 'joy', value: 70, pose: 'cheer' }, 320, 600, 0.68, true) +
    g(bigShroom(0, 0, MUSH[3][0], 1.1, 0.3), { transform: 'translate(250 420) rotate(-12)' }) +
    stroke('M262 410 C250 300 230 220 220 170', '#FFFFFF', 2, { 'stroke-dasharray': '4 7', opacity: 0.6 }) +
    head(330, 470, 'чпок', 15, { fill: '#FFF4C2' }) + spark(300, 470, 0.9, '#FFF4C2') +
    basket([0, 2, 3]),
  'Грибы в лесу',
  'Нажал на гриб — чибик бежит и срывает, гриб летит в корзинку. Ночью грибы светятся',
);
const mushWrong = phone(
  forest('evening') + shrooms(false, -1, true) +
    put(G.look, { emotion: 'sadness', value: 55 }, 200, 700, 0.8) +
    basket([0, 2, 3, 1, 4], true) +
    pill(195, 220, 'Не тот порядок · осталось 3 попытки', { color: C.warn, stroke: C.warn, size: 13 }),
  'Не тот порядок',
  'Корзинка трясётся, грибы вянут и вырастают снова. Попыток — 5 в сутки',
);
const HAT_LOOK: Look = { ...GASTER, hat: { id: 'hat.mushroom' } };
const spores = (cx: number, cy: number, n: number, rmax: number) =>
  Array.from({ length: n }, (_, i) => {
    const a = i * 0.7;
    const r = 20 + (i / n) * rmax;
    return circ(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, 2 + (i % 3), ['#C9FFB0', '#FFF4C2', '#D9C4FF'][i % 3], { opacity: 0.85 - (i / n) * 0.5 });
  }).join('');
const mushHat = phone(
  forest('night') + shrooms(true) + dim(0.55) +
    circ(195, 470, 150, '#C9FFB0', { opacity: 0.12 }) + spores(195, 440, 46, 150) +
    put(HAT_LOOK, { emotion: 'joy', value: 95, pose: 'cheer' }, 195, 610, 1.1) +
    card(30, 660, 330, 150,
      el('svg', { x: 40, y: 676, width: 96, height: 72, viewBox: '0 -26 120 86' }, ITEMS['hat.mushroom'].layers.hat!({ col: '', skin: '' }) + ITEMS['hat.mushroom'].layers.over!({ col: '', skin: '' })) +
      txt(148, 708, 'Шляпа грибника', 17, { 'text-anchor': 'start' }) + txt(148, 732, 'Секретная вещь', 12.5, { 'text-anchor': 'start', fill: C.good, 'font-weight': 700 }) +
      txt(195, 784, 'Надень — и «Мог» отскочит обратно', 13.5, { fill: C.muted })),
  'Шляпа грибника',
  'Верный порядок: грибы вспыхивают, вихрь спор, шляпа опускается на голову',
);

// Отражённый «Мог» — три кадра
const HAT_SONYA: Look = { ...SONYA, hat: { id: 'hat.mushroom' } };
const dome = (x: number, y: number) =>
  el('ellipse', { cx: x, cy: y - 70, rx: 92, ry: 104, fill: '#C9FFB0', opacity: 0.16, stroke: '#C9FFB0', 'stroke-width': 2.4, 'stroke-dasharray': '2 6' }) + spores(x, y - 80, 30, 80);
const antiMog1 = phone(
  forest('evening') + dim(0.6) +
    skull(140, 420, 1.2, -12) + skull(250, 400, 1.4, 10) + skull(200, 330, 1, 0) +
    put(G.look, { emotion: 'passion', value: 80, mog: true }, 185, 690, 0.9) +
    put(HAT_SONYA, { emotion: 'anxiety', value: 50 }, 300, 700, 0.9, true) +
    rect(0, 0, 390, 70, '#000') + rect(0, 774, 390, 70, '#000') +
    head(195, 250, 'МОГ', 48, { fill: C.text, stroke: INK, 'stroke-width': 2, 'letter-spacing': 4 }),
  '1. «Мог» как обычно',
  'Подбегает, затемнение, черепа',
  'mini',
);
const antiMog2 = phone(
  forest('evening') + dim(0.5) +
    dome(300, 700) +
    skull(120, 360, 1.2, -40, 0.9) + stroke('M190 420 L130 370', C.text, 2, { opacity: 0.5 }) +
    skull(330, 300, 1.2, 40, 0.9) + stroke('M280 400 L320 320', C.text, 2, { opacity: 0.5 }) +
    put(G.look, { emotion: 'anxiety', value: 70 }, 170, 700, 0.86) +
    put(HAT_SONYA, { emotion: 'calm', value: 60 }, 300, 700, 0.9, true) +
    rect(0, 0, 390, 70, '#000') + rect(0, 774, 390, 70, '#000'),
  '2. Купол из спор',
  'Шляпа светится, черепа отскакивают',
  'mini',
);
const antiMog3 = phone(
  forest('evening') +
    spores(190, 650, 18, 50) +
    put(G.look, { emotion: 'tiredness', value: 70, pose: 'fallen' }, 190, 740, 0.86) +
    g(rect(-58, -26, 116, 44, '#FFFFFF', { rx: 22, stroke: INK, 'stroke-width': 2 }) + pth('M-8 17 L0 30 L8 17 Z', '#FFFFFF') + head(0, 4, 'Апчхи!', 16, { fill: INK }), { transform: 'translate(200 580)' }) +
    put(HAT_SONYA, { emotion: 'joy', value: 90, pose: 'cheer' }, 315, 700, 0.9, true) +
    pill(195, 120, 'Шляпа грибника отразила «Мог»', { fill: 'rgba(94,211,160,0.18)', color: C.good, stroke: C.good, size: 13 }),
  '3. Падает применивший',
  'Чихает от спор и падает, цель радуется',
  'mini',
);

// Подсказка в пещере (порядок — для примера)
const caveHint = phone(
  locationSvg('cave', 'night') +
    CRYSTALS.slice(0, 5).map((c, i) => {
      const col = MUSH[[0, 3, 1, 2, 4][i]][0];
      const lit = i === 1;
      return circ(c.x, c.y - 30 * c.s, lit ? 60 : 30, col, { opacity: lit ? 0.55 : 0.18 }) +
        g(circ(0, 0, 11, 'rgba(24,18,40,0.85)', { stroke: col, 'stroke-width': 2 }) + txt(0, 4.6, String(i + 1), 12, { fill: C.text }), { transform: `translate(${Math.min(c.x + 20, 370)} ${c.y - 64 * c.s})` });
    }).join('') +
    pill(195, 120, 'Ночью кристаллы вспыхивают по очереди', { size: 13 }),
  'Подсказка в пещере',
  'Ночью кристаллы по очереди вспыхивают цветами грибов. Цвета и номера здесь для примера: настоящий порядок приходит с сервера',
);

// Главная: ходьба вглубь
const homeDepth = phone(
  meadow('day', true) +
    put(GASTER, { emotion: 'joy', value: 60, pose: 'run' }, 250, 720, 0.98, false) +
    put(SONYA, { emotion: 'calm', value: 50 }, 110, 548, 0.7) +
    circ(310, 770, 16, 'none', { stroke: '#FFFFFF', 'stroke-width': 2.4, opacity: 0.8 }) + circ(310, 770, 5, '#FFFFFF', { opacity: 0.8 }) +
    stroke('M190 560 C220 620 250 680 300 760', '#FFFFFF', 2, { 'stroke-dasharray': '4 8', opacity: 0.6 }),
  'Главная: вглубь и к себе',
  'Размер — прежний, один экран. Дальше — меньше и позади, ближе — крупнее',
);

// ---------- панорама: мир шире экрана ----------
const loc = forest('evening');
const tile = (i: number, t: string) => el('svg', { x: i * 390, y: 0, width: 390, height: 844, viewBox: '0 0 390 844', overflow: 'hidden' }, g(loc, { transform: t }));
const pano = el('svg', { viewBox: '0 300 1170 544', class: 'pano' },
  tile(0, 'translate(390 0) scale(-1 1)') + tile(1, '') + tile(2, 'translate(390 0) scale(-1 1)') +
  rect(390 + 40, 470, 310, 330, 'none', { stroke: '#FFD45E', 'stroke-width': 3, 'stroke-dasharray': '10 8', rx: 16 }) + head(585, 500, 'арена для игр', 15, { fill: '#FFD45E' }) +
  rect(392, 302, 386, 540, 'none', { stroke: C.accent, 'stroke-width': 5, rx: 30 }) + pill(585, 340, 'твой экран', { color: C.accent, stroke: C.accent }) +
  person(G, 560, 640, { emotion: 'joy', value: 55 }) + person(S, 700, 740, { emotion: 'love', value: 60 }, true) +
  person(B, 1000, 600, { emotion: 'calm', value: 40 }, true) +
  stroke('M20 820 H1150', 'rgba(255,255,255,0.4)', 2) + txt(585, 812, '≈ 3 экрана в ширину и в 1,5 раза глубже, чем главная', 15, { fill: '#FFFFFF' }));

// ---------- комната разработчиков (обычная вёрстка) ----------
const devRoom = `<figure class="phone html"><div class="dev">
  <div class="dev-h">Комната <small>Для разработчиков · ты: владелец</small></div>
  <section class="dc"><h4>Комната на троих</h4>
    <div class="row"><b>Мест</b><span class="step"><i>−</i>3<i>+</i></span></div>
    <div class="who"><span><em class="dot on"></em>Gaster · владелец</span></div>
    <div class="who"><span><em class="dot on"></em>Соня · друг</span><button>Вывести</button></div>
    <div class="who"><span><em class="dot"></em>Тестик · бот</span><button>Вывести</button></div>
    <div class="btns"><button class="pri">Войти</button><button>Сбросить рекорды</button></div>
  </section>
  <section class="dc"><h4>Люди и роли</h4>
    <div class="field">ID или email</div><div class="field">Название роли: друг</div>
    <div class="seg"><span>Разработчик</span><span class="on">Только комната</span></div>
    <div class="btns"><button class="pri">Выдать роль</button></div>
  </section>
  <section class="dc"><h4>Порядок грибов <small>только владелец</small></h4>
    <div class="slots">${[0, 1, 2, 3, 4].map((i) => `<span class="slot${i < 2 ? ' f' : ''}">${i < 2 ? '•' : ''}</span>`).join('')}</div>
    <div class="mush">${MUSH.map(([c, n]) => `<span title="${n}" style="--c:${c}"></span>`).join('')}</div>
    <p>После сохранения порядок не показывается никому. Точки вместо цветов — даже при вводе.</p>
    <div class="btns"><button class="pri">Сохранить</button><button>Сбросить</button></div>
  </section>
  <section class="dc"><h4>Способности вхолостую</h4>
    <div class="btns wrap"><button>Объятия</button><button>Мог</button><button>Мог в шляпу грибника</button><button>Шляпа: получение</button></div>
  </section>
</div><figcaption>Комната разработчиков<small>Новая карточка, уровень роли, порядок грибов, проверка вхолостую</small></figcaption></figure>`;

const html = `<title>Макет «Двое» 0.2.2</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&family=Unbounded:wght@600;700&display=swap" rel="stylesheet">
<style>
:root{color-scheme:dark;--bg:#0B0A14;--card:rgba(28,23,48,.74);--line:rgba(255,255,255,.13);--text:#F6F3FF;--muted:#B9B2CC;--accent:#FF6B8A;--good:#5ED3A0;--warn:#FFC266}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--text);font-family:Nunito,system-ui,sans-serif}
body{background:radial-gradient(60vmax 40vmax at 10% 0%,rgba(255,107,138,.16),transparent 60%),radial-gradient(60vmax 40vmax at 90% 10%,rgba(155,140,255,.16),transparent 60%),var(--bg);background-attachment:fixed}
main{max-width:1100px;margin:0 auto;padding:24px 16px 64px}
h1,h2,h4{font-family:Unbounded,sans-serif;font-weight:700;margin:0}
h1{font-size:24px}h2{font-size:17px;margin:36px 0 6px}
.lead{color:var(--muted);margin:8px 0 14px;line-height:1.5;max-width:70ch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}
.grid.three{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
figure{margin:0}
.phone svg.screen{width:100%;height:auto;display:block;border-radius:30px;border:1px solid var(--line);background:#000}
figcaption{font-weight:800;font-size:14.5px;margin-top:8px;line-height:1.3}
figcaption small{display:block;font-weight:700;font-size:12.5px;color:var(--muted);margin-top:3px}
.pano-wrap{overflow-x:auto;border-radius:22px;border:1px solid var(--line)}
svg.pano{display:block;width:100%;min-width:640px;height:auto}
.note{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:14px 16px;margin-top:22px;line-height:1.5;color:var(--muted)}
.note b{color:var(--text)}
.phone.html .dev{aspect-ratio:390/844;border-radius:30px;border:1px solid var(--line);background:radial-gradient(80% 40% at 20% 0%,rgba(143,162,255,.18),transparent),#0B0A14;padding:18px 12px;overflow:hidden;display:flex;flex-direction:column;gap:10px;font-size:12.5px}
.dev-h{font-family:Unbounded;font-size:15px}.dev-h small{display:block;font-family:Nunito;font-size:11px;color:var(--muted);margin-top:2px}
.dc{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:10px 12px;display:flex;flex-direction:column;gap:7px}
.dc h4{font-size:12px}.dc h4 small{font-family:Nunito;color:var(--muted);font-size:10.5px;margin-left:4px}
.dc p{margin:0;color:var(--muted);font-size:11px;line-height:1.35}
.row,.who{display:flex;justify-content:space-between;align-items:center;gap:6px}
.step{display:flex;align-items:center;gap:10px;font-family:Unbounded}.step i{font-style:normal;width:24px;height:24px;border-radius:12px;background:rgba(255,255,255,.08);display:grid;place-items:center}
.dot{display:inline-block;width:7px;height:7px;border-radius:4px;background:#7D7690;margin-right:6px}.dot.on{background:var(--good)}
button{font:inherit;font-weight:800;font-size:11.5px;color:var(--text);background:rgba(255,255,255,.08);border:1px solid var(--line);border-radius:14px;padding:5px 10px}
.who button{color:var(--accent);background:rgba(255,107,138,.14);border-color:rgba(255,107,138,.4)}
button.pri{background:var(--accent);color:#1A0F1F;border:none}
.btns{display:flex;gap:6px}.btns.wrap{flex-wrap:wrap}
.field{background:rgba(255,255,255,.06);border:1px solid var(--line);border-radius:12px;padding:6px 10px;color:var(--muted)}
.seg{display:flex;background:rgba(255,255,255,.06);border-radius:14px;padding:3px}.seg span{flex:1;font-size:10.5px;white-space:nowrap;text-align:center;padding:5px 0;border-radius:11px;color:var(--muted);font-weight:800}.seg span.on{background:var(--accent);color:#1A0F1F}
.slots{display:flex;gap:6px}.slot{width:26px;height:26px;border-radius:13px;border:1px dashed rgba(255,255,255,.25);display:grid;place-items:center;font-size:18px}.slot.f{border-style:solid;background:rgba(255,255,255,.08)}
.mush{display:flex;gap:8px}.mush span{width:30px;height:24px;border-radius:15px 15px 6px 6px;background:var(--c);border:2px solid #2B2035}
@media (max-width:560px){.grid,.grid.three{grid-template-columns:1fr;gap:22px}.grid figure{max-width:380px;width:100%;margin:0 auto}}
</style><main>
<h1>Двое 0.2.2 — «Комната на троих»</h1>
<p class="lead">Макет по ТЗ. Чибики, вещи и локации нарисованы тем же кодом, что в приложении. В приложении всё живое: чибики бегают, облачка всплывают, колесо крутится, звёзды падают.</p>

<h2>Большая площадка</h2>
<p class="lead">Мир комнаты шире экрана. Розовая рамка — то, что видно на телефоне; жёлтая — арена, где идут игры. Тестик ушёл вправо — у тебя на экране стрелка с его именем. В макете лес просто повторён; в приложении деревья, костры и прочее расставлены по всей ширине по-разному.</p>
<div class="pano-wrap">${pano}</div>

<h2>Комната</h2>
<div class="grid">${roomMain}${roomMenu}${roomReact}${roomFive}${roomMog}${roomBusy}</div>

<h2>Мини-игры</h2>
<div class="grid">${roomWheel}${roomPumpkin}${roomStars}${roomReaction}${roomRps}${roomPodium}${roomRecords}</div>

<h2>Грибы и шляпа грибника</h2>
<div class="grid">${mushPick}${mushWrong}${mushHat}${caveHint}</div>
<h2>Отражённый «Мог»</h2>
<p class="lead">Работает и на главной у пары, и в комнате, если шляпа надета.</p>
<div class="grid three">${antiMog1}${antiMog2}${antiMog3}</div>

<h2>Главная и комната разработчиков</h2>
<div class="grid">${homeDepth}${devRoom}</div>

<div class="note"><b>Что проверить:</b> нравится ли вид комнаты и панелей, понятны ли игры, шляпа и награды, удобно ли меню. Напиши номер экрана или название и что поменять — или «ок».</div>
</main>`;

writeFileSync(out, html);
console.log('ok', (html.length / 1024).toFixed(0), 'КБ');
