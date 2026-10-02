// Локации 0.2: статичная часть рисунка — SVG-строки в координатах сцены 390×844 (как луг),
// по палитре на день, вечер и ночь. Живые детали (сияние, снег, гирлянда, чайки, луч маяка) — в Location.tsx.
// Все локации устроены одинаково: полоса, где ходят чибики (y ≈ 520–560), плед для спящих (214–378 × 618–700).
// Новая локация = новая функция здесь + запись в public.locations; главную переделывать не нужно.
// Этап фиксации 0.2 — варианты для комнаты (мир шире экрана, земля плитками): 0 — главная, как было;
// 1 — середина комнаты (то же, но вещи отодвинуты от краёв плитки: на шве ничего не режется пополам);
// 2 и 3 — боковые плитки: та же земля, но свои вещи и горы — без второго костра, маяка, пледа и зеркальных двойников.
import type { DayTime } from './scene';

export type Variant = 0 | 1 | 2 | 3;
const roomV = (v: Variant) => v > 0;
const sideV = (v: Variant) => v >= 2;
const pick = <T,>(v: Variant, home: T, center: T, left: T, right: T): T => (v === 0 ? home : v === 1 ? center : v === 2 ? left : right);

export type LocationId = 'meadow' | 'aurora' | 'roof' | 'beach' | 'forest' | 'snow' | 'cafe' | 'moon' | 'sakura' | 'rain' | 'mountains' | 'cave';

export const LOCATIONS: { id: LocationId; name: string }[] = [
  { id: 'meadow', name: 'Луг у озера' },
  { id: 'aurora', name: 'Северное сияние' },
  { id: 'roof', name: 'Крыша города' },
  { id: 'beach', name: 'Пляж' },
  { id: 'forest', name: 'Лес с костром' },
  { id: 'snow', name: 'Снежная деревня' },
  { id: 'cafe', name: 'Кафе' },
  { id: 'moon', name: 'Луна' },
  { id: 'sakura', name: 'Сад сакуры' },
  { id: 'rain', name: 'Город под дождём' },
  { id: 'mountains', name: 'Горы' },
  { id: 'cave', name: 'Пещера с кристаллами' },
];

export const locationName = (id: string | null | undefined) => LOCATIONS.find((l) => l.id === id)?.name ?? 'Луг у озера';
export const isLocationId = (id: unknown): id is LocationId => LOCATIONS.some((l) => l.id === id);

const INK = '#2B2035';
// Граница неба и земли в рисунке: в комнате небо одно на экран, а земля повторяется по всей ширине
const LAND = '<!--land-->';
type A = Record<string, string | number>;

const el = (tag: string, attrs: A, children = '') =>
  `<${tag} ${Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ')}>${children}</${tag}>`;
const g = (children: string, o: A = {}) => el('g', o, children);
const rect = (x: number, y: number, w: number, h: number, fill: string, o: A = {}) => el('rect', { x, y, width: w, height: h, fill, ...o });
const circ = (cx: number, cy: number, r: number, fill: string, o: A = {}) => el('circle', { cx, cy, r, fill, ...o });
const pth = (d: string, fill: string, o: A = {}) => el('path', { d, fill, ...o });
const line = (d: string, color: string, w: number, o: A = {}) =>
  el('path', { d, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...o });

function sky(id: string, stops: string[], marks = [0, 0.34, 0.57]): string {
  const grad = el(
    'linearGradient',
    { id, x1: 0, y1: 0, x2: 0, y2: 1 },
    stops.map((c, i) => el('stop', { offset: marks[i], 'stop-color': c })).join(''),
  );
  return el('defs', {}, grad) + rect(-400, -400, 1190, 1300, `url(#${id})`);
}

function seeded(seed: number) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}
const rs = seeded(11);
const STARS = Array.from({ length: 30 }, () => ({ x: +(8 + rs() * 374).toFixed(1), y: +(24 + rs() * 380).toFixed(1), r: rs() < 0.25 ? 1.6 : 1.05 }));
const stars = (op: number) => (op > 0 ? g(STARS.map((s) => circ(s.x, s.y, s.r, '#FFFFFF')).join(''), { opacity: op }) : '');
const moon = (x: number, y: number) =>
  circ(x, y, 64, '#DCE3FF', { opacity: 0.12 }) + circ(x, y, 30, '#F6F1D8') + circ(x - 10, y - 8, 6, '#E6DFC2') + circ(x + 9, y + 10, 4.2, '#E6DFC2');
const sun = (x: number, y: number, r: number, color: string, glow: string) => circ(x, y, r * 2, glow, { opacity: 0.35 }) + circ(x, y, r, color);
const CLOUD = 'M14 42 C3 42 1 29 12 27 C12 14 29 10 37 19 C41 6 64 4 70 17 C78 8 95 12 95 25 C108 23 116 34 107 42 Z';
const cloud = (x: number, y: number, w: number, fill: string, op: number) =>
  pth(CLOUD, fill, { transform: `translate(${x} ${y}) scale(${(w / 110).toFixed(3)})`, opacity: op });
const blanket = (fill: string, lines: string) =>
  pth('M214 626 L360 618 L378 690 L200 700 Z', fill) +
  line('M250 624 L240 698 M288 622 L284 696 M326 620 L330 693 M209 650 L366 641 M204 675 L372 666', lines, 6, { opacity: 0.5, 'stroke-linecap': 'butt' });
// Гряда гор по точкам: края плитки (x = 0 и 390) у всех вариантов на той же высоте — швы сходятся.
// Снежные шапки — на вершинах, по склонам.
const ridge = (pts: number[][], bottom: number, fill: string, snow: string) => {
  let caps = '';
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const [xl, yl] = pts[i - 1];
    const [xr, yr] = pts[i + 1];
    if (!(y < yl && y < yr)) continue;
    const kl = Math.min(0.45, 24 / Math.max(1, yl - y));
    const kr = Math.min(0.45, 24 / Math.max(1, yr - y));
    const L = [x + (xl - x) * kl, y + (yl - y) * kl];
    const R = [x + (xr - x) * kr, y + (yr - y) * kr];
    const f = (n: number) => n.toFixed(1);
    caps += `M${x} ${y} L${f(R[0])} ${f(R[1])} L${f(x + (R[0] - x) * 0.4)} ${f(y + (R[1] - y) * 0.8)} L${f(x - 1)} ${f(y + Math.min(R[1], L[1]) - y + 4)} L${f(x + (L[0] - x) * 0.45)} ${f(y + (L[1] - y) * 0.75)} L${f(L[0])} ${f(L[1])} Z `;
  }
  return (
    pth(`M${pts.map(([x, y]) => `${x} ${y}`).join(' L')} L450 ${bottom} L-60 ${bottom} Z`, fill, { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }) +
    (caps ? pth(caps.trim(), snow, { stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }) : '')
  );
};
const lantern = (op: number) =>
  op > 0 ? g(rect(199, 612, 15, 19, '#FFE7A3', { rx: 4, stroke: INK, 'stroke-width': 1.6 }) + line('M202 612 Q206.5 603 211 612', INK, 1.6), { opacity: op }) : '';

// ---------- Северное сияние ----------
const AURORA = {
  day: {
    sky: ['#79AEE6', '#BCD7F4', '#F3EEF9'], stars: 0, back: '#9FB2DD', front: '#BBC9EC', snow: '#EEF3FF', snow2: '#E2E9FA', near: '#D2DCF3',
    pine: '#2F4A6E', wall: '#8A5E6E', roof: '#4A4470', win: '#D9CBB8', winGlow: 0, blanket: '#8D6BB8', lines: '#FFFFFF', lantern: 0,
  },
  evening: {
    sky: ['#3A2F6E', '#B66A9E', '#FFC2B0'], stars: 0.3, back: '#6E5E9E', front: '#8E7EB8', snow: '#CDB9DC', snow2: '#BEA9D1', near: '#AA96C4',
    pine: '#2A2C5A', wall: '#6B4A5E', roof: '#2E2A4E', win: '#FFC266', winGlow: 0.3, blanket: '#8D6BB8', lines: '#E6DDFF', lantern: 0.8,
  },
  night: {
    sky: ['#03071C', '#0B1640', '#1C2C60'], stars: 1, back: '#22336A', front: '#4B5C96', snow: '#8796C8', snow2: '#7383BA', near: '#5F6FA6',
    pine: '#1C2A52', wall: '#6B4A5E', roof: '#2E2A4E', win: '#FFC266', winGlow: 0.3, blanket: '#8D6BB8', lines: '#D9CCFF', lantern: 1,
  },
};

function aurora(time: DayTime, v: Variant = 0): string {
  const p = AURORA[time];
  let s = sky(`sky-aurora-${time}`, p.sky, [0, 0.4, 0.62]) + stars(p.stars);
  if (time === 'day') s += sun(92, 362, 30, '#FFE7B0', '#FFF6DE') + cloud(210, 120, 110, '#FFFFFF', 0.85) + cloud(40, 210, 80, '#FFFFFF', 0.7);
  if (time === 'evening') s += sun(300, 436, 34, '#FFB08A', '#FFD3BE');
  if (time === 'night') s += circ(320, 92, 14, '#F6F1D8', { opacity: 0.9 });
  s += LAND; // дальше — земля (в комнате тянется по всей площадке)
  if (!sideV(v)) {
    s += pth('M-60 430 L30 356 L80 392 L150 330 L230 400 L290 352 L360 404 L450 360 L450 520 L-60 520 Z', p.back);
    s += pth('M30 356 L48 371 L40 372 L30 366 L20 373 Z M150 330 L172 349 L160 352 L150 344 L138 352 L128 350 Z M290 352 L308 367 L298 369 L290 362 L280 368 Z', '#F2F5FF', { opacity: 0.9 });
  } else {
    // свои горы: края — на той же высоте, что у середины (381 слева, 389 справа)
    const pts = v === 2
      ? [[-60, 430], [0, 381], [64, 338], [118, 382], [196, 342], [256, 394], [326, 348], [390, 389], [450, 360]]
      : [[-60, 430], [0, 381], [46, 366], [110, 324], [180, 386], [238, 350], [300, 398], [350, 362], [390, 389], [450, 360]];
    let caps = '';
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y] = pts[i];
      if (y < pts[i - 1][1] && y < pts[i + 1][1]) caps += `M${x} ${y} L${x + 18} ${y + 16} L${x + 9} ${y + 17} L${x} ${y + 10} L${x - 10} ${y + 17} L${x - 18} ${y + 16} Z `;
    }
    s += pth(`M${pts.map(([x, y]) => `${x} ${y}`).join(' L')} L450 520 L-60 520 Z`, p.back) + pth(caps.trim(), '#F2F5FF', { opacity: 0.9 });
  }
  s += pth('M-60 470 C40 440 110 446 180 462 C250 440 330 436 450 456 L450 560 L-60 560 Z', p.front);
  const pine = (x: number, y: number, k: number) =>
    g(
      pth('M0 0 L-14 22 H-6 L-18 42 H-8 L-20 62 H20 L8 42 H18 L6 22 H14 Z', p.pine) +
        pth('M0 0 L-6 10 H6 Z M-8 24 L-2 28 L4 24 Z M-10 46 L0 50 L10 46 Z', '#E8EEFF', { opacity: 0.85 }) +
        rect(-3, 62, 6, 9, '#3A2E3E'),
      { transform: `translate(${x} ${y}) scale(${k})` },
    );
  const house = (x: number, w: number, wall: string, roofC: string, lit = true) =>
    g(
      rect(x + 10, 470, w, 50, wall, { stroke: INK, 'stroke-width': 2 }) +
        pth(`M${x} 474 L${x + 10 + w / 2} 436 L${x + 20 + w} 474 Z`, roofC, { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }) +
        pth(`M${x} 474 L${x + 10 + w / 2} 436 L${x + 20 + w} 474 L${x + 14 + w} 476 L${x + 10 + w / 2} 444 L${x + 6} 476 Z`, '#EEF3FF') +
        (lit && p.winGlow ? circ(x + 30, 492, 16, '#FFC266', { opacity: p.winGlow }) : '') +
        rect(x + 22, 484, 16, 16, p.win, { stroke: INK, 'stroke-width': 1.8, rx: 2 }) +
        line(`M${x + 30} 484 V500 M${x + 22} 492 H${x + 38}`, INK, 1.2) +
        rect(x + w - 8, 486, 14, 34, '#5A4050', { stroke: INK, 'stroke-width': 1.6, rx: 2 }),
    );
  if (v === 2) {
    // ельник и заснеженные камни
    s += pine(54, 440, 0.95) + pine(96, 456, 0.75) + pine(214, 432, 1.1) + pine(318, 450, 0.85);
    s += [[150, 512, 20], [262, 516, 14]].map(([x, y, r]) => el('ellipse', { cx: x, cy: y, rx: r, ry: r * 0.55, fill: p.snow2, stroke: INK, 'stroke-width': 1.6 }) + el('ellipse', { cx: x - r * 0.2, cy: y - r * 0.3, rx: r * 0.6, ry: r * 0.25, fill: '#FFFFFF', opacity: 0.8 })).join('');
  } else if (v === 3) {
    // сарайчик и пара елей
    s += pine(70, 452, 0.85) + pine(300, 436, 1.05) + pine(338, 458, 0.7);
    s += house(140, 64, '#5E6E9E', p.roof, false);
  } else {
    s += pine(330, 430, 1.05) + pine(362, 452, 0.8) + pine(22, 448, 0.85);
    s += g(
      rect(60, 470, 76, 50, p.wall, { stroke: INK, 'stroke-width': 2 }) +
        pth('M50 474 L98 436 L146 474 Z', p.roof, { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }) +
        pth('M50 474 L98 436 L146 474 L140 476 L98 444 L56 476 Z', '#EEF3FF') +
        (p.winGlow ? circ(80, 492, 16, '#FFC266', { opacity: p.winGlow }) + circ(112, 492, 16, '#FFC266', { opacity: p.winGlow }) : '') +
        rect(72, 484, 16, 16, p.win, { stroke: INK, 'stroke-width': 1.8, rx: 2 }) +
        rect(104, 484, 16, 16, p.win, { stroke: INK, 'stroke-width': 1.8, rx: 2 }) +
        line('M80 484 V500 M72 492 H88 M112 484 V500 M104 492 H120', INK, 1.2) +
        rect(118, 440, 8, 18, '#5A4050', { stroke: INK, 'stroke-width': 1.6 }),
    );
  }
  s += pth('M-60 520 C60 506 160 504 260 512 C330 517 380 512 450 506 L450 900 L-60 900 Z', p.snow);
  s += pth('M-60 610 C100 592 260 596 450 612 L450 900 L-60 900 Z', p.snow2);
  if (!sideV(v)) s += blanket(p.blanket, p.lines) + lantern(p.lantern);
  s += pth('M-60 748 C90 736 220 738 450 752 L450 900 L-60 900 Z', p.near);
  const r2 = seeded(5 + (sideV(v) ? v * 7 : 0));
  s += g(Array.from({ length: 40 }, () => circ(+(r2() * 390).toFixed(1), +(500 + r2() * 340).toFixed(1), r2() < 0.3 ? 2 : 1.2, '#FFFFFF')).join(''), { opacity: time === 'day' ? 0.9 : 0.6 });
  return s;
}

// ---------- Крыша города ----------
const ROOF = {
  day: {
    sky: ['#7EC3F5', '#B5DEFF', '#EAF4FF'], stars: 0, far: '#A7B4D8', farWin: '#E8F0FF', farWinOp: 0.5, near: '#7F89B4', nearWin: '#DDE9FF', nearWinOp: 0.55,
    roof: '#6E6A8E', roofLine: '#7E7AA0', edge: '#8A86AE', tank: '#9C7B6C', bulbs: 0, blanket: '#FF8FA8', lines: '#FFFFFF', winChance: 0.3,
  },
  evening: {
    sky: ['#2F2A6E', '#A15BA6', '#FFB48C'], stars: 0.35, far: '#4A3A78', farWin: '#FFD38A', farWinOp: 0.75, near: '#2E244F', nearWin: '#FFC266', nearWinOp: 0.85,
    roof: '#4A3F6B', roofLine: '#5A4E7E', edge: '#6A5C93', tank: '#8A6B5E', bulbs: 1, blanket: '#E77E97', lines: '#FFE3EA', winChance: 0.4,
  },
  night: {
    sky: ['#070B24', '#141C4A', '#2C3772'], stars: 1, far: '#1E2550', farWin: '#FFD38A', farWinOp: 0.85, near: '#151B3F', nearWin: '#FFC266', nearWinOp: 0.95,
    roof: '#2C2A4E', roofLine: '#38365E', edge: '#46437A', tank: '#5E4A4A', bulbs: 1, blanket: '#8D6BB8', lines: '#D9CCFF', winChance: 0.6,
  },
};

export const GARLAND = Array.from({ length: 12 }, (_, i) => {
  const t = i / 11;
  const x = -10 + 410 * t;
  const y = (1 - t) ** 3 * 430 + 3 * (1 - t) ** 2 * t * 470 + 3 * (1 - t) * t * t * 474 + t ** 3 * 430 + 5;
  return { x: +x.toFixed(1), y: +y.toFixed(1), color: ['#FFD966', '#FF8FB3', '#7CC8FF', '#5ED3A0', '#FFAA6B'][i % 5] };
});

function roof(time: DayTime, v: Variant = 0): string {
  const p = ROOF[time];
  let s = sky(`sky-roof-${time}`, p.sky, [0, 0.32, 0.55]) + stars(p.stars);
  if (time === 'day') s += sun(300, 150, 34, '#FFE38A', '#FFF4C2') + cloud(30, 100, 120, '#FFFFFF', 0.95) + cloud(220, 230, 90, '#FFFFFF', 0.9);
  if (time === 'evening') s += circ(300, 400, 90, '#FFC29A', { opacity: 0.35 }) + circ(300, 410, 46, '#FF9466');
  if (time === 'night') s += moon(300, 120);
  s += LAND; // дальше — земля (в комнате тянется по всей площадке)
  const r = seeded(sideV(v) ? 3 + v * 11 : 3);
  let far = '';
  let win = '';
  for (let x = -20; x < 410; x += 34) {
    const h = 60 + r() * 110;
    far += rect(x, +(470 - h).toFixed(1), 30, +(h + 60).toFixed(1), p.far);
    for (let wy = 470 - h + 10; wy < 460; wy += 14)
      for (let wx = x + 5; wx < x + 26; wx += 9) if (r() < p.winChance * 0.85) win += rect(wx, +wy.toFixed(1), 4, 6, p.farWin);
  }
  s += far + g(win, { opacity: p.farWinOp });
  let near = '';
  let win2 = '';
  const blocks = pick(
    v,
    [[-30, 380, 70], [44, 410, 54], [104, 360, 64], [176, 400, 50], [232, 372, 70], [308, 392, 60], [364, 350, 70]],
    [[-30, 380, 70], [44, 410, 54], [104, 360, 64], [176, 400, 50], [232, 372, 70], [308, 392, 60], [364, 350, 70]],
    [[-30, 396, 60], [34, 356, 76], [116, 404, 48], [168, 378, 66], [240, 342, 58], [302, 400, 52], [358, 370, 80]],
    [[-30, 366, 80], [54, 398, 58], [116, 352, 52], [172, 392, 72], [248, 410, 44], [296, 360, 66], [366, 396, 70]],
  );
  blocks.forEach(([x, y, w]) => {
    near += rect(x, y, w, 200, p.near);
    for (let wy = y + 12; wy < 500; wy += 18) for (let wx = x + 8; wx < x + w - 8; wx += 14) if (r() < p.winChance + 0.05) win2 += rect(wx, wy, 6, 8, p.nearWin);
  });
  s += near + g(win2, { opacity: p.nearWinOp });
  s += rect(-60, 506, 510, 400, p.roof);
  s += line('M-60 560 H450 M-60 620 H450 M-60 690 H450 M-60 770 H450', p.roofLine, 2);
  s += rect(-60, 500, 510, 14, p.edge, { stroke: INK, 'stroke-width': 2 });
  const antenna = (x: number) => line(`M${x} 500 V420 M${x - 14} 436 H${x + 14} M${x - 10} 452 H${x + 10} M${x - 6} 468 H${x + 6}`, INK, 3);
  const tank = (x: number) =>
    g(
      line(`M${x + 8} 500 L${x + 14} 452 M${x + 60} 500 L${x + 54} 452 M${x + 18} 480 H${x + 50}`, INK, 3) +
        rect(x, 404, 68, 50, p.tank, { stroke: INK, 'stroke-width': 2, rx: 4 }) +
        line(`M${x} 418 H${x + 68} M${x} 440 H${x + 68}`, '#6B5048', 2) +
        pth(`M${x - 4} 406 L${x + 34} 384 L${x + 72} 406 Z`, '#6B5048', { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }),
    );
  // вентиляция: короб с решёткой и трубой
  const vent = (x: number) =>
    rect(x, 470, 54, 32, '#8E8AA6', { stroke: INK, 'stroke-width': 2, rx: 4 }) + line(`M${x + 8} 480 H${x + 46} M${x + 8} 488 H${x + 46} M${x + 8} 496 H${x + 46}`, '#5E5A72', 2) +
    rect(x + 36, 444, 10, 28, '#9C98B6', { stroke: INK, 'stroke-width': 1.8 }) + rect(x + 32, 438, 18, 8, '#7A7694', { stroke: INK, 'stroke-width': 1.6, rx: 2 });
  if (v === 2) s += antenna(196) + vent(84);
  else if (v === 3) s += vent(250) + antenna(120);
  else s += antenna(44) + tank(292);
  // гирлянда: провод и лампочки (светятся вечером и ночью — свечение в Location.tsx); в комнате — над всей крышей
  s += line('M-10 430 C80 470 200 474 400 430', INK, 1.4);
  s += GARLAND.map((b) => circ(b.x, b.y, 4, p.bulbs ? b.color : '#D9D4E8', { stroke: INK, 'stroke-width': 1.2 })).join('');
  const pot = (x: number) =>
    rect(x, 560, 26, 22, '#C97C5D', { stroke: INK, 'stroke-width': 1.8, rx: 3 }) + circ(x + 13, 552, 15, '#5CBB78', { stroke: INK, 'stroke-width': 1.8 }) + circ(x + 6, 548, 7, '#7FD8A0');
  s += pick(v, pot(16) + pot(350), pot(30) + pot(334), pot(150) + pot(292), pot(60) + pot(196));
  if (!sideV(v)) s += blanket(p.blanket, p.lines);
  return s;
}

// ---------- Пляж ----------
const BEACH = {
  day: {
    sky: ['#79C6FF', '#B8E4FF', '#FFF0DA'], stars: 0, sea: '#4FB3E6', seaFar: '#3A9BD6', foam: '#FFFFFF', rock: '#8A7F99', sand: '#E8C98E', sand2: '#F6DDA8',
    lamp: '#FFE38A', blanket: '#7CC8FF', lines: '#FFFFFF', umbrella: '#FF8FB3',
  },
  evening: {
    sky: ['#2F2A6E', '#C2629A', '#FFB27A'], stars: 0.3, sea: '#9A6AA8', seaFar: '#7E5A9A', foam: '#FFD9C2', rock: '#5E5272', sand: '#C9997F', sand2: '#DDB08E',
    lamp: '#FFE38A', blanket: '#E77E97', lines: '#FFE3EA', umbrella: '#E77E97',
  },
  night: {
    sky: ['#070B24', '#141C4A', '#2C3772'], stars: 1, sea: '#1F2D63', seaFar: '#16224E', foam: '#C9D6FF', rock: '#3A3552', sand: '#55557A', sand2: '#64658A',
    lamp: '#FFF0B0', blanket: '#8D6BB8', lines: '#D9CCFF', umbrella: '#8D6BB8',
  },
};

function beach(time: DayTime, v: Variant = 0): string {
  const p = BEACH[time];
  let s = sky(`sky-beach-${time}`, p.sky, [0, 0.32, 0.52]) + stars(p.stars);
  if (time === 'day') {
    s += sun(92, 160, 34, '#FFE38A', '#FFF4C2') + cloud(200, 110, 120, '#FFFFFF', 0.95) + cloud(30, 250, 90, '#FFFFFF', 0.9);
  }
  if (time === 'evening') s += circ(190, 420, 100, '#FFC29A', { opacity: 0.35 }) + circ(190, 424, 48, '#FF9466');
  if (time === 'night') s += moon(92, 150);
  s += LAND; // дальше — земля (в комнате тянется по всей площадке)
  s += pth('M-60 420 H450 V540 H-60 Z', p.sea);
  s += pth('M-60 420 H450 V436 H-60 Z', p.seaFar);
  if (time === 'evening' && !sideV(v)) s += pth('M150 436 H230 L250 530 H130 Z', '#FFB48C', { opacity: 0.35 });
  s += line(
    sideV(v)
      ? 'M30 462 q10 -6 20 0 q10 6 20 0 M150 452 q10 -6 20 0 q10 6 20 0 M270 470 q10 -6 20 0 q10 6 20 0 M90 506 q10 -6 20 0 q10 6 20 0 M230 496 q10 -6 20 0 q10 6 20 0 M340 512 q10 -6 20 0'
      : 'M10 456 q10 -6 20 0 q10 6 20 0 M120 470 q10 -6 20 0 q10 6 20 0 M240 452 q10 -6 20 0 q10 6 20 0 M60 500 q10 -6 20 0 q10 6 20 0 M200 510 q10 -6 20 0 q10 6 20 0 M310 494 q10 -6 20 0',
    p.foam,
    2.2,
    { opacity: 0.7 },
  );
  // маяк (в комнате — только в середине и чуть левее края)
  if (!sideV(v)) {
    const dx = v === 1 ? -36 : 0;
    s += g(
      pth('M300 470 C310 440 360 436 392 450 L410 520 L290 520 Z', p.rock, { stroke: INK, 'stroke-width': 2 }) +
        pth('M332 450 L338 330 H362 L368 450 Z', time === 'night' ? '#C9CDE6' : '#FFFFFF', { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }) +
        pth('M335.5 390 L336.8 366 H363.2 L364.5 390 Z M333.6 430 L334.6 412 H365.4 L366.4 430 Z', '#E5566B') +
        (time === 'day' ? '' : circ(350, 322, 22, p.lamp, { opacity: 0.45 })) +
        rect(336, 312, 28, 20, p.lamp, { stroke: INK, 'stroke-width': 2 }) +
        pth('M332 312 L350 296 L368 312 Z', '#3A3346', { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }),
      dx ? { transform: `translate(${dx} 0)` } : {},
    );
  } else {
    // камни в воде
    const rocks = v === 2 ? [[90, 500, 26], [128, 506, 14], [300, 488, 18]] : [[60, 492, 18], [250, 502, 28], [286, 508, 12]];
    s += rocks.map(([x, y, r]) => pth(`M${x - r} ${y + 6} C${x - r} ${y - r * 0.7} ${x + r} ${y - r * 0.8} ${x + r} ${y + 6} Z`, p.rock, { stroke: INK, 'stroke-width': 1.8 })).join('');
  }
  s += pth('M-60 530 C60 518 180 520 260 526 C330 531 380 528 450 522 L450 900 L-60 900 Z', p.sand);
  s += pth('M-60 546 C80 536 200 538 450 544 L450 900 L-60 900 Z', p.sand2);
  const umbrella = (x: number, color: string) =>
    g(
      line('M64 640 L84 520', INK, 3) +
        pth('M30 548 C40 506 120 494 138 530 Z', color, { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }) +
        pth('M58 536 C66 516 86 506 92 512 C96 524 98 530 98 536 Z', '#FFFFFF', { opacity: time === 'night' ? 0.4 : 0.9 }),
      x ? { transform: `translate(${x} 0)` } : {},
    );
  const star = (x: number, y: number) => g(pth('M0 -9 L2.6 -3 L9 -2.8 L4 1.4 L5.6 8 L0 4.4 L-5.6 8 L-4 1.4 L-9 -2.8 L-2.6 -3 Z', '#FFAA6B', { stroke: INK, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }), { transform: `translate(${x} ${y})` });
  const shell = (x: number, y: number) => g(pth('M-7 4 C-7 -4 7 -4 7 4 Z', '#FFD3E2', { stroke: INK, 'stroke-width': 1.3 }) + line('M-3 3 L-1 -2 M3 3 L1 -2', INK, 1), { transform: `translate(${x} ${y})` });
  const pebble = (x: number, y: number) => g(pth('M-6 3 C-6 -3 6 -3 6 3 Z', '#FFF4E0', { stroke: INK, 'stroke-width': 1.3 }), { transform: `translate(${x} ${y})` });
  // мяч и замок из песка — на боковых плитках
  const ball = (x: number, y: number) =>
    circ(x, y, 16, '#FFFFFF', { stroke: INK, 'stroke-width': 2 }) + pth(`M${x - 16} ${y} A16 16 0 0 1 ${x} ${y - 16} L${x} ${y} Z`, '#FF6B8A') + pth(`M${x} ${y} L${x + 16} ${y} A16 16 0 0 1 ${x} ${y + 16} Z`, '#7CC8FF') + circ(x, y, 16, 'none', { stroke: INK, 'stroke-width': 2 });
  const castle = (x: number, y: number) =>
    g(
      rect(-30, -26, 60, 26, p.sand, { stroke: INK, 'stroke-width': 2 }) + rect(-36, -46, 22, 46, p.sand2, { stroke: INK, 'stroke-width': 2 }) + rect(14, -46, 22, 46, p.sand2, { stroke: INK, 'stroke-width': 2 }) +
        pth('M-36 -46 v-6 h6 v6 h5 v-6 h6 v6 M14 -46 v-6 h6 v6 h5 v-6 h6 v6', 'none', { stroke: INK, 'stroke-width': 2 }) + pth('M-6 0 V-12 A6 6 0 0 1 6 -12 V0 Z', '#C9997F', { stroke: INK, 'stroke-width': 1.6 }) +
        line('M25 -46 V-66', INK, 2) + pth('M26 -66 L40 -61 L26 -56 Z', '#FF6B8A', { stroke: INK, 'stroke-width': 1.2 }),
      { transform: `translate(${x} ${y})` },
    );
  if (v === 2) s += umbrella(150, time === 'day' ? '#7CC8FF' : p.umbrella) + ball(90, 640) + shell(300, 720) + star(60, 780);
  else if (v === 3) s += castle(110, 650) + star(250, 610) + pebble(320, 760) + shell(190, 790);
  else s += umbrella(0, p.umbrella) + star(150, 700) + shell(320, 740) + pebble(60, 760);
  if (!sideV(v)) s += blanket(p.blanket, p.lines);
  return s;
}

// ======================= Локации 0.2.1 =======================
const hill = (y0: number, amp: number, fill: string, seed: number, step = 60) => {
  const r = seeded(seed);
  let d = `M-60 ${y0}`;
  for (let x = -60; x <= 450; x += step) d += ` Q${x + step / 2} ${(y0 - amp * (0.4 + r() * 0.6)).toFixed(1)} ${x + step} ${y0}`;
  return pth(d + ' L450 900 L-60 900 Z', fill);
};
const pine2 = (x: number, y: number, k: number, fill: string, snow = '') =>
  g(
    pth('M0 0 L-16 26 H-7 L-21 50 H-9 L-25 76 H25 L9 50 H21 L7 26 H16 Z', fill, { stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }) +
      (snow ? pth('M0 0 L-7 11 H7 Z M-9 28 L-2 32 L6 28 Z M-12 52 L0 57 L12 52 Z', snow, { opacity: 0.9 }) : '') +
      rect(-3.5, 76, 7, 10, '#4A3438'),
    { transform: `translate(${x} ${y}) scale(${k})` },
  );
// Мягкое свечение: круг с радиальным градиентом к прозрачному краю
let glowN = 0;
const glow = (x: number, y: number, r: number, color: string, op: number) => {
  if (op <= 0) return '';
  const id = `lg${++glowN}`;
  return (
    el('defs', {}, el('radialGradient', { id }, el('stop', { offset: 0, 'stop-color': color, 'stop-opacity': (op * 0.7).toFixed(2) }) + el('stop', { offset: 0.45, 'stop-color': color, 'stop-opacity': (op * 0.3).toFixed(2) }) + el('stop', { offset: 1, 'stop-color': color, 'stop-opacity': 0 }))) +
    circ(x, y, r, `url(#${id})`)
  );
};

// ---------- Лес с костром ----------
const FOREST = {
  day: { sky: ['#7EC8E8', '#BDE6E0', '#F4F2D8'], stars: 0, far: '#8CC3A4', mid: '#5EA581', pine: '#3E8A66', ground: '#86C77E', ground2: '#76B970', path: '#D9C49A', fire: 0.4, blanket: '#FF8FA8', lines: '#FFFFFF' },
  evening: { sky: ['#2F2A6E', '#B5679A', '#FFB48C'], stars: 0.3, far: '#6A5E96', mid: '#4C4F80', pine: '#33406A', ground: '#4F6E66', ground2: '#46635C', path: '#9C8478', fire: 0.8, blanket: '#E77E97', lines: '#FFE3EA' },
  night: { sky: ['#070B24', '#141C4A', '#2C3772'], stars: 1, far: '#1C2B52', mid: '#152446', pine: '#101C38', ground: '#1E3644', ground2: '#1A303C', path: '#2F3E52', fire: 1, blanket: '#8D6BB8', lines: '#D9CCFF' },
};
export const CAMPFIRE = { x: 96, y: 612 };

function forest(time: DayTime, v: Variant = 0): string {
  const p = FOREST[time];
  let s = sky(`sky-forest-${time}`, p.sky, [0, 0.36, 0.58]) + stars(p.stars);
  if (time === 'day') s += sun(300, 140, 30, '#FFE38A', '#FFF4C2') + cloud(40, 120, 110, '#FFFFFF', 0.9);
  if (time === 'evening') s += circ(110, 420, 90, '#FFC29A', { opacity: 0.35 }) + circ(110, 428, 44, '#FF9466');
  if (time === 'night') s += moon(300, 120);
  s += LAND; // дальше — земля (в комнате тянется по всей площадке)
  s += hill(470, 60, p.far, 21, 70);
  if (!roomV(v)) for (let i = 0; i < 9; i++) s += pine2(-10 + i * 50, 380 + (i % 3) * 18, 0.9 + (i % 2) * 0.2, p.mid);
  else {
    // ряд елей не заходит за край плитки: на шве нет «двойной» ели
    const r = seeded(31 + v);
    for (let i = 0; i < 8; i++) s += pine2(28 + i * 48 + (r() - 0.5) * 10, 376 + r() * 40, 0.78 + r() * 0.24, p.mid);
  }
  s += hill(520, 16, p.ground, 4, 90);
  if (!sideV(v)) s += pth('M150 900 C170 760 200 640 230 560 C236 540 250 528 270 522 L300 522 C276 540 262 580 258 640 C252 720 262 820 280 900 Z', p.path, { opacity: 0.8 });
  s += pick(
    v,
    pine2(10, 360, 1.7, p.pine) + pine2(370, 380, 1.5, p.pine) + pine2(340, 420, 1.1, p.pine),
    pine2(46, 362, 1.55, p.pine) + pine2(346, 384, 1.4, p.pine) + pine2(306, 424, 1.05, p.pine),
    pine2(96, 370, 1.45, p.pine) + pine2(262, 352, 1.65, p.pine) + pine2(326, 422, 1.0, p.pine),
    pine2(64, 384, 1.3, p.pine) + pine2(188, 356, 1.7, p.pine) + pine2(300, 404, 1.2, p.pine),
  );
  s += pth('M-60 600 C80 590 220 594 450 604 L450 900 L-60 900 Z', p.ground2);
  if (v === 2) {
    // палатка
    s += g(
      pth('M-50 0 L0 -64 L50 0 Z', time === 'day' ? '#E5866B' : time === 'evening' ? '#B8676A' : '#5E4466', { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }) +
        pth('M0 -64 L-14 0 H14 Z', '#5E4A6E', { stroke: INK, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }) +
        pth('M-50 0 L0 -64 L-30 0 Z', '#FFFFFF', { opacity: 0.18 }) + line('M0 -64 L0 -74 M-56 2 H56', INK, 2),
      { transform: 'translate(250 640)' },
    );
  } else if (v === 3) {
    // пень с топором и куст
    s += g(
      el('ellipse', { cx: 0, cy: 18, rx: 24, ry: 7, fill: '#7A5040', stroke: INK, 'stroke-width': 1.8 }) + rect(-24, -2, 48, 20, '#9C6B4E', { stroke: INK, 'stroke-width': 1.8 }) +
        el('ellipse', { cx: 0, cy: -2, rx: 24, ry: 8, fill: '#D9A77E', stroke: INK, 'stroke-width': 1.8 }) + el('ellipse', { cx: 0, cy: -2, rx: 12, ry: 4, fill: 'none', stroke: '#B07A56', 'stroke-width': 1.4 }),
      { transform: 'translate(120 640)' },
    );
    s += circ(300, 640, 22, p.mid, { stroke: INK, 'stroke-width': 1.8 }) + circ(326, 646, 17, p.pine, { stroke: INK, 'stroke-width': 1.8 }) + circ(296, 632, 8, '#FFFFFF', { opacity: 0.15 });
  } else {
    // бревно-скамейка и костёр (огонь и искры живые — Location.tsx)
    s += g(rect(20, 652, 70, 18, '#9C6B4E', { rx: 9, stroke: INK, 'stroke-width': 2 }) + circ(28, 661, 7, '#D9A77E', { stroke: INK, 'stroke-width': 1.6 }) + line('M44 657 h30 M50 664 h24', '#7A5040', 1.6));
    const { x, y } = CAMPFIRE;
    s += glow(x, y - 10, 90, '#FFB347', p.fire);
    s += [-24, -12, 0, 12, 24].map((dx, i) => circ(x + dx, y + 12 + (i % 2) * 3, 7, '#8E8AA6', { stroke: INK, 'stroke-width': 1.6 })).join('');
    s += g(rect(-24, -5, 48, 10, '#8A5A44', { rx: 5, stroke: INK, 'stroke-width': 1.8 }), { transform: `translate(${x} ${y + 4}) rotate(18)` });
    s += g(rect(-24, -5, 48, 10, '#9C6B4E', { rx: 5, stroke: INK, 'stroke-width': 1.8 }), { transform: `translate(${x} ${y + 4}) rotate(-18)` });
    s += pth(`M${x - 16} ${y} C${x - 20} ${y - 22} ${x - 6} ${y - 30} ${x - 4} ${y - 44} C${x + 4} ${y - 34} ${x + 8} ${y - 30} ${x + 10} ${y - 38} C${x + 20} ${y - 22} ${x + 18} ${y - 6} ${x + 14} ${y} Z`, '#FF8A3D', { stroke: INK, 'stroke-width': 1.8, 'stroke-linejoin': 'round' });
    s += pth(`M${x - 8} ${y} C${x - 10} ${y - 12} ${x - 2} ${y - 18} ${x} ${y - 26} C${x + 6} ${y - 16} ${x + 10} ${y - 10} ${x + 7} ${y} Z`, '#FFE38A');
    // грибы растут живыми поверх рисунка — их можно сорвать (Mushrooms.tsx, 0.2.2)
    s += blanket(p.blanket, p.lines);
  }
  return s;
}

// ---------- Снежная деревня ----------
const SNOW = {
  day: { sky: ['#9CC7EE', '#CFE2F6', '#F4F2FA'], stars: 0, hills: '#DCE6F7', snow: '#F2F6FF', snow2: '#E4ECFA', pine: '#3F6A7E', win: '#D9E4F2', winGlow: 0, wall: ['#C97C5D', '#7F8CFF', '#E5566B'], lamp: 0, blanket: '#7CC8FF', lines: '#FFFFFF' },
  evening: { sky: ['#3A2F6E', '#B66A9E', '#FFC2B0'], stars: 0.3, hills: '#A994C6', snow: '#D9C6E6', snow2: '#C9B4DA', pine: '#2E3A5E', win: '#FFC266', winGlow: 0.6, wall: ['#9A5E52', '#5E64A8', '#A84A5E'], lamp: 0.8, blanket: '#E77E97', lines: '#FFE3EA' },
  night: { sky: ['#050A22', '#0E1846', '#22306A'], stars: 1, hills: '#3E4C84', snow: '#8E9CCF', snow2: '#7F8EC4', pine: '#1A2850', win: '#FFC266', winGlow: 1, wall: ['#6E4A4E', '#454C86', '#7A3E56'], lamp: 1, blanket: '#8D6BB8', lines: '#D9CCFF' },
};
export const SNOW_LAMP = { x: 330, y: 404 };

function snowVillage(time: DayTime, v: Variant = 0): string {
  const p = SNOW[time];
  let s = sky(`sky-snow-${time}`, p.sky, [0, 0.4, 0.62]) + stars(p.stars);
  if (time === 'day') s += sun(80, 150, 28, '#FFF0C0', '#FFFFFF') + cloud(220, 140, 120, '#FFFFFF', 0.85);
  if (time === 'evening') s += circ(300, 440, 80, '#FFC29A', { opacity: 0.3 }) + circ(300, 446, 36, '#FFB08A');
  if (time === 'night') s += moon(80, 110);
  s += LAND; // дальше — земля (в комнате тянется по всей площадке)
  s += hill(470, 50, p.hills, sideV(v) ? 8 + v * 5 : 8, 80);
  const house = (x: number, y: number, w: number, wall: string, k = 1) =>
    g(
      rect(0, 0, w, 56, wall, { stroke: INK, 'stroke-width': 2 }) +
        rect(w - 22, -42, 12, 26, '#6B5048', { stroke: INK, 'stroke-width': 1.6 }) +
        pth(`M-10 4 L${w / 2} -38 L${w + 10} 4 Z`, '#5A4A6E', { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }) +
        pth(`M-12 6 L${w / 2} -40 L${w + 12} 6 C${w} 0 ${w - 8} 8 ${w / 2} -26 C8 8 0 0 -12 6 Z`, '#F7FAFF', { stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }) +
        (p.winGlow ? circ(16, 24, 18, '#FFC266', { opacity: (p.winGlow * 0.3).toFixed(2) }) + circ(w - 16, 24, 18, '#FFC266', { opacity: (p.winGlow * 0.3).toFixed(2) }) : '') +
        rect(8, 16, 16, 16, p.win, { stroke: INK, 'stroke-width': 1.6, rx: 2 }) + rect(w - 24, 16, 16, 16, p.win, { stroke: INK, 'stroke-width': 1.6, rx: 2 }) +
        line(`M16 16 V32 M8 24 H24 M${w - 16} 16 V32 M${w - 24} 24 H${w - 8}`, INK, 1.1) +
        rect(w / 2 - 8, 26, 16, 30, '#7A5040', { stroke: INK, 'stroke-width': 1.6, rx: 3 }),
      { transform: `translate(${x} ${y}) scale(${k})` },
    );
  s += pick(
    v,
    house(18, 452, 84, p.wall[0], 0.95) + house(150, 438, 96, p.wall[1]) + house(290, 456, 70, p.wall[2], 0.9),
    house(24, 452, 84, p.wall[0], 0.95) + house(150, 438, 96, p.wall[1]) + house(286, 456, 70, p.wall[2], 0.9),
    house(52, 448, 76, p.wall[2], 0.92) + house(228, 444, 88, p.wall[0], 0.96),
    house(150, 436, 104, p.wall[1], 1.02),
  );
  s += pick(
    v,
    pine2(122, 418, 0.9, p.pine, '#F2F6FF') + pine2(262, 430, 0.8, p.pine, '#F2F6FF'),
    pine2(122, 418, 0.9, p.pine, '#F2F6FF') + pine2(262, 430, 0.8, p.pine, '#F2F6FF'),
    pine2(170, 420, 1.0, p.pine, '#F2F6FF') + pine2(356, 436, 0.75, p.pine, '#F2F6FF'),
    pine2(60, 424, 0.95, p.pine, '#F2F6FF') + pine2(104, 440, 0.7, p.pine, '#F2F6FF') + pine2(312, 420, 1.05, p.pine, '#F2F6FF'),
  );
  s += pth('M-60 506 C80 496 220 498 450 508 L450 900 L-60 900 Z', p.snow);
  s += pth('M-60 600 C100 588 260 590 450 604 L450 900 L-60 900 Z', p.snow2);
  if (!sideV(v)) {
    // фонарь
    const L = SNOW_LAMP;
    s += line(`M${L.x} 560 V${L.y + 10}`, INK, 4) + line(`M${L.x} 560 V${L.y + 10}`, '#4A4258', 2.2);
    s += glow(L.x, L.y, 46, '#FFE38A', p.lamp);
    s += rect(L.x - 9, L.y - 10, 18, 20, p.lamp ? '#FFE7A3' : '#D9D4E8', { rx: 3, stroke: INK, 'stroke-width': 1.8 }) + pth(`M${L.x - 12} ${L.y - 10} L${L.x} ${L.y - 20} L${L.x + 12} ${L.y - 10} Z`, '#3A3346', { stroke: INK, 'stroke-width': 1.6 });
    // снеговик
    s += g(
      circ(0, 0, 22, '#FFFFFF', { stroke: INK, 'stroke-width': 2 }) + circ(0, -30, 15, '#FFFFFF', { stroke: INK, 'stroke-width': 2 }) +
        circ(-5, -33, 1.8, INK) + circ(5, -33, 1.8, INK) + pth('M0 -29 L11 -27 L0 -25.5 Z', '#FFAA6B', { stroke: INK, 'stroke-width': 1 }) +
        line('M-12 -20 C-4 -16 4 -16 12 -20', '#E5566B', 4) + circ(0, -6, 1.8, INK) + circ(0, 3, 1.8, INK) +
        line('M-20 -6 L-34 -18 M20 -6 L34 -18', '#7A5040', 2.2) + rect(-10, -52, 20, 9, '#3A3346', { rx: 2, stroke: INK, 'stroke-width': 1.4 }),
      { transform: v === 1 ? 'translate(62 620)' : 'translate(50 620)' },
    );
    s += blanket(p.blanket, p.lines);
  } else if (v === 2) {
    // санки
    s += g(
      rect(-30, -14, 60, 10, '#C97C5D', { rx: 4, stroke: INK, 'stroke-width': 1.8 }) + line('M-26 -4 V4 M26 -4 V4', INK, 2) +
        pth('M-36 4 H34 C42 4 44 -6 38 -10', 'none', { stroke: INK, 'stroke-width': 2.4, 'stroke-linecap': 'round' }),
      { transform: 'translate(120 640)' },
    );
  } else {
    // иглу
    s += g(
      pth('M-46 0 A46 40 0 0 1 46 0 Z', time === 'day' ? '#F7FAFF' : p.snow, { stroke: INK, 'stroke-width': 2 }) + pth('M-14 0 V-12 A14 14 0 0 1 14 -12 V0 Z', '#3A3156', { stroke: INK, 'stroke-width': 1.8 }) +
        line('M-42 -14 H-16 M16 -14 H42 M-30 -28 H30 M-20 -14 V-28 M20 -14 V-28 M0 -28 V-40', p.snow2, 1.6) +
        (p.winGlow ? circ(0, -6, 12, '#FFC266', { opacity: (p.winGlow * 0.35).toFixed(2) }) : ''),
      { transform: 'translate(250 650)' },
    );
  }
  return s;
}

// ---------- Кафе ----------
const CAFE = {
  day: { win: ['#8FCBF5', '#C9E6FF', '#F6F0E6'], wall: '#5E4A6E', wall2: '#6B567C', floor: '#8A5E4E', floor2: '#7A5244', light: 0.3, stars: 0, city: '#A9B6D8', cityWin: 0, blanket: '#FF8FA8', lines: '#FFFFFF' },
  evening: { win: ['#2F2A6E', '#B5679A', '#FFB48C'], wall: '#4A3A5E', wall2: '#56446C', floor: '#6E4A40', floor2: '#5E4038', light: 0.75, stars: 0.3, city: '#4A3A78', cityWin: 0.8, blanket: '#E77E97', lines: '#FFE3EA' },
  night: { win: ['#070B24', '#141C4A', '#2C3772'], wall: '#33284A', wall2: '#3E3156', floor: '#4E3836', floor2: '#43302F', light: 1, stars: 1, city: '#1E2550', cityWin: 1, blanket: '#8D6BB8', lines: '#D9CCFF' },
};
export const CAFE_LAMPS = [70, 195, 320];
export const CAFE_CUPS = [{ x: 286, y: 456 }, { x: 330, y: 456 }];

// Чашки на стойке (пар над ними живой — Location.tsx); в середине комнаты стойка короче — не заходит за край
export const cafeCups = (v: Variant) => (v === 0 ? CAFE_CUPS : v === 1 ? [{ x: 246, y: 456 }, { x: 290, y: 456 }] : []);

function cafe(time: DayTime, v: Variant = 0): string {
  const p = CAFE[time];
  let s = rect(-60, -60, 510, 960, p.wall);
  const view = (id: string) => {
    let w = sky(`sky-${id}`, p.win, [0, 0.45, 0.75]) + stars(p.stars);
    if (time === 'day') w += sun(290, 210, 22, '#FFE38A', '#FFF4C2') + cloud(70, 190, 90, '#FFFFFF', 0.9);
    if (time === 'night') w += moon(290, 210);
    return w;
  };
  if (!sideV(v)) {
    // окно на улицу (время суток видно в окне)
    s += el('defs', {}, el('clipPath', { id: `cafe-win-${time}` }, rect(40, 150, 310, 230, '#000', { rx: 18 })));
    let w = view(`cafe-${time}`);
    const r = seeded(13);
    for (let x = 40; x < 350; x += 30) {
      const h = 40 + r() * 70;
      w += rect(x, +(380 - h).toFixed(1), 26, +h.toFixed(1), p.city);
      if (p.cityWin) for (let wy = 380 - h + 8; wy < 372; wy += 12) if (r() < 0.5) w += rect(x + 6, +wy.toFixed(1), 4, 5, '#FFD38A', { opacity: p.cityWin });
    }
    s += g(w, { 'clip-path': `url(#cafe-win-${time})` });
    s += rect(40, 150, 310, 230, 'none', { rx: 18, stroke: '#3A2A26', 'stroke-width': 10 }) + rect(40, 150, 310, 230, 'none', { rx: 18, stroke: INK, 'stroke-width': 2 });
    s += line('M195 150 V380 M40 265 H350', '#3A2A26', 6);
    s += pth('M30 140 H360 L350 112 H40 Z', '#E5566B', { stroke: INK, 'stroke-width': 2 }) + line('M70 112 L64 140 M110 112 L106 140 M150 112 L148 140 M195 112 V140 M240 112 L242 140 M280 112 L284 140 M320 112 L326 140', '#FFFFFF', 6, { opacity: 0.8, 'stroke-linecap': 'butt' });
  } else {
    // круглые окошки и полка с книгами / картина
    const id = `cafe-port-${time}-${v}`;
    const holes = v === 2 ? [[110, 230, 62]] : [[270, 236, 56]];
    s += el('defs', {}, el('clipPath', { id }, holes.map(([x, y, r]) => circ(x, y, r, '#000')).join('')));
    s += g(view(`cafe-${time}-${v}`), { 'clip-path': `url(#${id})` });
    s += holes.map(([x, y, r]) => circ(x, y, r, 'none', { stroke: '#3A2A26', 'stroke-width': 10 }) + circ(x, y, r, 'none', { stroke: INK, 'stroke-width': 2 }) + line(`M${x - r} ${y} H${x + r} M${x} ${y - r} V${y + r}`, '#3A2A26', 5)).join('');
    if (v === 2) {
      // полка с книгами
      const books = [['#E5566B', 18], ['#7CC8FF', 14], ['#FFC266', 20], ['#5ED3A0', 12], ['#B39DFF', 16], ['#FF8FB3', 18]];
      s += rect(220, 230, 130, 10, '#9C6B4E', { stroke: INK, 'stroke-width': 1.8, rx: 2 }) + rect(220, 310, 130, 10, '#9C6B4E', { stroke: INK, 'stroke-width': 1.8, rx: 2 });
      let bx = 228;
      books.forEach(([c, w], i) => {
        const h = 34 + (i % 3) * 6;
        s += rect(bx, 230 - h, w as number, h, c as string, { stroke: INK, 'stroke-width': 1.4, rx: 2 });
        bx += (w as number) + 3;
      });
      s += circ(250, 296, 12, '#5CBB78', { stroke: INK, 'stroke-width': 1.6 }) + rect(240, 298, 20, 12, '#C97C5D', { stroke: INK, 'stroke-width': 1.6, rx: 2 });
      s += rect(290, 286, 36, 24, '#F4F0FF', { stroke: INK, 'stroke-width': 1.6, rx: 3 });
    } else {
      // картина с чашкой
      s += rect(60, 170, 120, 90, '#C98A5E', { stroke: INK, 'stroke-width': 2, rx: 4 }) + rect(70, 180, 100, 70, '#2E2438', { rx: 2 });
      s += rect(100, 206, 36, 28, '#F4F0FF', { stroke: INK, 'stroke-width': 1.6, rx: 4 }) + line('M136 212 a7 7 0 0 1 0 14', '#F4F0FF', 3) + line('M110 200 c-4 -6 4 -8 0 -14 M124 200 c-4 -6 4 -8 0 -14', '#FFFFFF', 1.6, { opacity: 0.7 });
    }
  }
  // лампы
  s += CAFE_LAMPS.map((x) => line(`M${x} -60 V44`, INK, 1.6) + glow(x, 62, 60, '#FFE38A', p.light) + pth(`M${x - 18} 62 C${x - 18} 46 ${x + 18} 46 ${x + 18} 62 Z`, '#FFC266', { stroke: INK, 'stroke-width': 1.8 }) + circ(x, 64, 6, '#FFF4C2', { stroke: INK, 'stroke-width': 1.4 })).join('');
  s += rect(-60, 420, 510, 12, p.wall2);
  const table = (x: number) =>
    el('ellipse', { cx: x, cy: 470, rx: 34, ry: 9, fill: '#C98A5E', stroke: INK, 'stroke-width': 2 }) + rect(x - 4, 474, 8, 30, '#7A5040', { stroke: INK, 'stroke-width': 1.6 }) + el('ellipse', { cx: x, cy: 504, rx: 16, ry: 4, fill: '#7A5040', stroke: INK, 'stroke-width': 1.6 }) +
    rect(x - 8, 452, 14, 11, '#F4F0FF', { stroke: INK, 'stroke-width': 1.4, rx: 3 }) +
    [-1, 1].map((d) => rect(x + d * 52 - 10, 470, 20, 6, '#9C6B4E', { stroke: INK, 'stroke-width': 1.6, rx: 2 }) + line(`M${x + d * 52 - 8} 476 V504 M${x + d * 52 + 8} 476 V504`, INK, 2.4) + rect(x + d * 52 + (d > 0 ? 6 : -10), 440, 4, 34, '#9C6B4E', { stroke: INK, 'stroke-width': 1.2 })).join('');
  if (v === 0) {
    // стойка с кофемашиной и чашками
    s += rect(250, 470, 200, 70, '#9C6B4E', { stroke: INK, 'stroke-width': 2 }) + rect(244, 462, 210, 12, '#C98A5E', { stroke: INK, 'stroke-width': 2, rx: 4 });
    s += rect(368, 410, 44, 52, '#B9B2CC', { stroke: INK, 'stroke-width': 2, rx: 6 }) + rect(376, 420, 28, 12, '#3A3346', { rx: 3 }) + circ(390, 448, 4, '#E5566B', { stroke: INK, 'stroke-width': 1.2 });
  } else if (v === 1) {
    s += rect(210, 470, 168, 70, '#9C6B4E', { stroke: INK, 'stroke-width': 2 }) + rect(204, 462, 180, 12, '#C98A5E', { stroke: INK, 'stroke-width': 2, rx: 4 });
    s += rect(326, 410, 44, 52, '#B9B2CC', { stroke: INK, 'stroke-width': 2, rx: 6 }) + rect(334, 420, 28, 12, '#3A3346', { rx: 3 }) + circ(348, 448, 4, '#E5566B', { stroke: INK, 'stroke-width': 1.2 });
  } else s += table(v === 2 ? 120 : 260);
  s += cafeCups(v).map((c) => rect(c.x - 9, c.y - 12, 18, 13, '#F4F0FF', { stroke: INK, 'stroke-width': 1.6, rx: 3 }) + line(`M${c.x + 9} ${c.y - 9} a3.5 3.5 0 0 1 0 6`, INK, 1.6)).join('');
  // растение и меню
  if (!sideV(v)) {
    s += rect(14, 380, 34, 30, '#C97C5D', { stroke: INK, 'stroke-width': 1.8, rx: 3 }) + circ(31, 366, 20, '#5CBB78', { stroke: INK, 'stroke-width': 1.8 }) + circ(22, 360, 9, '#7FD8A0');
    s += rect(62, 430, 70, 46, '#2E2438', { stroke: '#9C6B4E', 'stroke-width': 4, rx: 3 }) + line('M72 444 h30 M72 454 h44 M72 464 h24', '#F4F0FF', 2, { opacity: 0.7 });
  } else {
    // большой цветок в кадке
    const x = v === 2 ? 320 : 70;
    s += rect(x - 20, 470, 40, 34, '#C97C5D', { stroke: INK, 'stroke-width': 1.8, rx: 4 }) + circ(x, 446, 26, '#5CBB78', { stroke: INK, 'stroke-width': 1.8 }) + circ(x - 12, 436, 12, '#7FD8A0') + circ(x + 14, 428, 10, '#5CBB78', { stroke: INK, 'stroke-width': 1.6 });
  }
  // пол
  s += rect(-60, 505, 510, 400, p.floor);
  s += line('M-60 560 H450 M-60 630 H450 M-60 710 H450 M-60 800 H450 M40 505 L20 900 M160 505 L150 900 M280 505 L290 900 M390 505 L420 900', p.floor2, 3);
  s += rect(-60, 500, 510, 10, '#3A2A26');
  if (!sideV(v)) s += blanket(p.blanket, p.lines);
  return s;
}

// ---------- Луна ----------
const MOON = {
  day: { sky: ['#0A0E2E', '#1E2A6A', '#3A4A9A'], ground: '#C9C6D8', ground2: '#B4B0C8', crater: '#9E99B6', earth: 1, blanket: '#7CC8FF', lines: '#FFFFFF' },
  evening: { sky: ['#140A30', '#3E1E6A', '#7A3E8E'], ground: '#B7A8C8', ground2: '#A394B8', crater: '#8C7EA6', earth: 0.9, blanket: '#E77E97', lines: '#FFE3EA' },
  night: { sky: ['#02030E', '#0A0E2A', '#141C48'], ground: '#8E8CAE', ground2: '#7C7AA0', crater: '#6A6890', earth: 0.8, blanket: '#8D6BB8', lines: '#D9CCFF' },
};

function moonBase(time: DayTime, v: Variant = 0): string {
  const p = MOON[time];
  const r = seeded(17);
  let s = sky(`sky-moon-${time}`, p.sky, [0, 0.5, 0.75]) + stars(1);
  s += g(Array.from({ length: 30 }, () => circ(+(r() * 390).toFixed(1), +(r() * 480).toFixed(1), r() < 0.2 ? 1.5 : 0.8, '#FFFFFF')).join(''), { opacity: 0.7 });
  if (time === 'evening') s += circ(90, 250, 140, '#FF8FB3', { opacity: 0.12 }) + circ(300, 180, 120, '#9B8CFF', { opacity: 0.14 });
  // Земля
  s += g(
    circ(0, 0, 70, '#8FA2FF', { opacity: 0.18 }) + circ(0, 0, 46, '#4F9BE6', { stroke: INK, 'stroke-width': 2 }) +
      pth('M-30 -18 C-20 -30 -6 -26 -2 -14 C4 -4 -10 2 -16 10 C-24 6 -36 -6 -30 -18 Z M10 -36 C22 -32 34 -20 36 -6 C26 -10 16 -16 10 -36 Z M8 14 C20 8 32 14 30 26 C22 34 10 30 8 14 Z', '#5ED3A0', { stroke: INK, 'stroke-width': 1.4 }) +
      pth('M-40 20 C-30 34 -10 44 10 42 C-8 36 -26 30 -40 20 Z', '#FFFFFF', { opacity: 0.4 }),
    { transform: 'translate(290 170)', opacity: p.earth },
  );
  // планета с кольцом
  s += g(circ(0, 0, 18, '#FFAA6B', { stroke: INK, 'stroke-width': 1.6 }) + el('ellipse', { cx: 0, cy: 0, rx: 32, ry: 7, fill: 'none', stroke: '#FFD966', 'stroke-width': 3, transform: 'rotate(-18)' }), { transform: 'translate(70 300)' });
  s += LAND; // дальше — земля (в комнате тянется по всей площадке)
  s += hill(500, 30, p.ground2, 31, 120);
  s += pth('M-60 520 C80 506 240 508 450 520 L450 900 L-60 900 Z', p.ground);
  const crater = (x: number, y: number, rx: number) =>
    el('ellipse', { cx: x, cy: y, rx, ry: rx * 0.36, fill: p.crater, stroke: INK, 'stroke-width': 1.6 }) + el('ellipse', { cx: x, cy: y + rx * 0.06, rx: rx * 0.7, ry: rx * 0.22, fill: p.ground2 });
  s += pick(
    v,
    crater(60, 600, 34) + crater(330, 740, 44) + crater(180, 790, 22) + crater(380, 575, 16),
    crater(60, 600, 34) + crater(320, 740, 44) + crater(180, 790, 22) + crater(360, 575, 16),
    crater(120, 640, 40) + crater(290, 590, 22) + crater(70, 780, 26) + crater(300, 790, 34),
    crater(220, 620, 30) + crater(90, 720, 40) + crater(330, 680, 18) + crater(230, 800, 24),
  );
  if (!sideV(v)) {
    // ракета
    s += g(
      pth('M-26 60 L-14 30 L14 30 L26 60 Z', '#E5566B', { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }) +
        pth('M-16 40 C-18 0 -8 -34 0 -50 C8 -34 18 0 16 40 Z', '#F4F0FF', { stroke: INK, 'stroke-width': 2 }) +
        pth('M-11 -20 C-6 -34 -2 -42 0 -50 C2 -42 6 -34 11 -20 Z', '#E5566B', { stroke: INK, 'stroke-width': 1.8 }) +
        circ(0, 2, 8, '#7CC8FF', { stroke: INK, 'stroke-width': 2 }) + circ(-2.5, -0.5, 2.4, '#FFFFFF', { opacity: 0.8 }),
      { transform: 'translate(46 470)' },
    );
    // флажок
    const fx = v === 1 ? 330 : 352;
    s += line(`M${fx} 520 V454`, INK, 3) + pth(`M${fx + 1} 456 L${fx + 34} 464 L${fx + 1} 474 Z`, '#FF6B8A', { stroke: INK, 'stroke-width': 1.6 }) + g(pth(FACE_HEART, '#FFFFFF'), { transform: `translate(${fx + 12} 465) scale(0.55)` });
    s += blanket(p.blanket, p.lines);
  } else if (v === 2) {
    // луноход
    s += g(
      rect(-34, -30, 68, 26, '#D9D4E8', { stroke: INK, 'stroke-width': 2, rx: 6 }) + rect(-20, -44, 30, 16, '#7CC8FF', { stroke: INK, 'stroke-width': 1.8, rx: 4 }) +
        line('M18 -30 V-52', INK, 2) + circ(18, -54, 4, '#FF6B8A', { stroke: INK, 'stroke-width': 1.4 }) +
        [-24, 0, 24].map((x) => circ(x, 0, 9, '#4A4258', { stroke: INK, 'stroke-width': 2 }) + circ(x, 0, 3, '#9E99B6')).join(''),
      { transform: 'translate(210 540)' },
    );
  } else {
    // антенна-тарелка
    s += g(
      line('M0 0 V-40', INK, 3) + pth('M-30 -48 C-24 -20 24 -20 30 -48 Z', '#F4F0FF', { stroke: INK, 'stroke-width': 2 }) + line('M0 -38 L0 -62', INK, 1.6) + circ(0, -64, 3.4, '#FFD966', { stroke: INK, 'stroke-width': 1.2 }) +
        rect(-14, 0, 28, 8, '#9E99B6', { stroke: INK, 'stroke-width': 1.6, rx: 2 }),
      { transform: 'translate(120 524)' },
    );
  }
  return s;
}
const FACE_HEART = 'M0 4.6 C-1.6 3.3 -6.6 0.3 -6.6 -2.6 C-6.6 -5.2 -4.5 -6.7 -2.7 -6.7 C-1.4 -6.7 -0.5 -6 0 -5.1 C0.5 -6 1.4 -6.7 2.7 -6.7 C4.5 -6.7 6.6 -5.2 6.6 -2.6 C6.6 0.3 1.6 3.3 0 4.6 Z';

// ---------- Сад сакуры ----------
const SAKURA = {
  day: { sky: ['#8FCBF5', '#C9E6FF', '#FFF0F4'], stars: 0, far: '#B9D7C2', grass: '#9BD48E', grass2: '#8BC982', bloom: '#FFC1D6', bloom2: '#FF9EBB', trunk: '#6E4A44', water: '#8FD6F0', bridge: '#E5566B', lamp: 0, blanket: '#7CC8FF', lines: '#FFFFFF' },
  evening: { sky: ['#2F2A6E', '#C26A9E', '#FFB8A0'], stars: 0.3, far: '#7E6AA0', grass: '#6A7E70', grass2: '#5E7266', bloom: '#E79ABB', bloom2: '#C9709A', trunk: '#4A3440', water: '#C98BB4', bridge: '#B8455E', lamp: 0.8, blanket: '#E77E97', lines: '#FFE3EA' },
  night: { sky: ['#070B24', '#141C4A', '#2C3772'], stars: 1, far: '#22305E', grass: '#25404A', grass2: '#213A44', bloom: '#9A7AB8', bloom2: '#7E5E9E', trunk: '#2E2838', water: '#2A3A70', bridge: '#6E3A56', lamp: 1, blanket: '#8D6BB8', lines: '#D9CCFF' },
};
export const SAKURA_TREES = [{ x: 70, y: 300 }, { x: 330, y: 330 }];

function sakura(time: DayTime, v: Variant = 0): string {
  const p = SAKURA[time];
  let s = sky(`sky-sakura-${time}`, p.sky, [0, 0.4, 0.62]) + stars(p.stars);
  if (time === 'day') s += sun(200, 130, 30, '#FFE38A', '#FFF4C2') + cloud(250, 200, 100, '#FFFFFF', 0.9);
  if (time === 'evening') s += circ(200, 420, 90, '#FFC29A', { opacity: 0.35 }) + circ(200, 428, 44, '#FF9466');
  if (time === 'night') s += moon(200, 120);
  s += LAND; // дальше — земля (в комнате тянется по всей площадке)
  s += hill(470, 40, p.far, 41, 100);
  s += pth('M-60 500 C80 488 220 490 450 500 L450 900 L-60 900 Z', p.grass);
  // ручей и мостик
  s += pth('M-60 560 C60 548 140 570 220 566 C300 562 360 548 450 556 L450 590 C360 584 300 598 220 600 C140 604 60 584 -60 596 Z', p.water, { stroke: INK, 'stroke-width': 1.6 });
  s += line('M30 576 h24 M150 584 h30 M300 574 h26', '#FFFFFF', 2, { opacity: 0.6 });
  if (!sideV(v)) {
    s += pth('M150 572 C170 540 230 540 250 572', 'none', { stroke: INK, 'stroke-width': 9, 'stroke-linecap': 'round' }) + pth('M150 572 C170 540 230 540 250 572', 'none', { stroke: p.bridge, 'stroke-width': 6, 'stroke-linecap': 'round' });
    s += line('M160 562 V546 M200 548 V532 M240 562 V546 M160 546 C176 530 224 530 240 546', INK, 2.6);
  } else {
    // камни-ступеньки через ручей
    const x0 = v === 2 ? 230 : 110;
    s += [0, 1, 2].map((i) => el('ellipse', { cx: x0 + i * 26, cy: 566 + (i % 2) * 8, rx: 13, ry: 6, fill: '#B9B2CC', stroke: INK, 'stroke-width': 1.6 })).join('');
  }
  s += pth('M-60 610 C100 598 260 600 450 612 L450 900 L-60 900 Z', p.grass2);
  // деревья
  const tree = (x: number, y: number, k: number) =>
    g(
      pth('M-8 220 C-6 160 -14 110 -40 70 M-2 150 C10 110 30 90 50 70 M-4 120 C-10 90 -8 60 4 30', 'none', { stroke: INK, 'stroke-width': 14, 'stroke-linecap': 'round' }) +
        pth('M-8 220 C-6 160 -14 110 -40 70 M-2 150 C10 110 30 90 50 70 M-4 120 C-10 90 -8 60 4 30', 'none', { stroke: p.trunk, 'stroke-width': 10, 'stroke-linecap': 'round' }) +
        [[-44, 60, 34], [6, 22, 40], [52, 62, 34], [-10, 70, 36], [26, 90, 26], [-60, 96, 22]].map(([cx, cy, r]) => circ(cx, cy, r, p.bloom, { stroke: INK, 'stroke-width': 2 })).join('') +
        [[-30, 50, 8], [14, 14, 9], [50, 54, 7], [-4, 74, 8], [-56, 92, 6]].map(([cx, cy, r]) => circ(cx, cy, r, p.bloom2)).join(''),
      { transform: `translate(${x} ${y}) scale(${k})` },
    );
  s += pick(
    v,
    tree(SAKURA_TREES[0].x, SAKURA_TREES[0].y, 1) + tree(SAKURA_TREES[1].x, SAKURA_TREES[1].y, 0.85),
    tree(86, 300, 1) + tree(312, 330, 0.85),
    tree(196, 290, 1.08) + tree(56, 372, 0.6),
    tree(110, 320, 0.9) + tree(300, 350, 0.7),
  );
  // каменный фонарь
  if (!sideV(v))
    s += g(
      rect(-8, 0, 16, 40, '#B9B2CC', { stroke: INK, 'stroke-width': 1.8 }) + rect(-16, 40, 32, 8, '#9E99B6', { stroke: INK, 'stroke-width': 1.8 }) +
        rect(-14, -26, 28, 24, '#B9B2CC', { stroke: INK, 'stroke-width': 1.8 }) + (p.lamp ? circ(0, -14, 22, '#FFC266', { opacity: (p.lamp * 0.35).toFixed(2) }) : '') +
        rect(-7, -20, 14, 12, p.lamp ? '#FFE7A3' : '#5E5A72', { stroke: INK, 'stroke-width': 1.4 }) +
        pth('M-24 -26 L0 -42 L24 -26 Z', '#9E99B6', { stroke: INK, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }),
      { transform: 'translate(150 470)' },
    );
  else if (v === 3)
    // скамейка под деревом
    s += g(
      rect(-40, -10, 80, 8, '#9C6B4E', { stroke: INK, 'stroke-width': 1.8, rx: 3 }) + rect(-40, -26, 80, 8, '#B07A56', { stroke: INK, 'stroke-width': 1.8, rx: 3 }) +
        line('M-32 -2 V14 M32 -2 V14 M-30 -18 V-10 M30 -18 V-10', INK, 3),
      { transform: 'translate(240 500)' },
    );
  s += (sideV(v) ? [[80, 640], [170, 720], [300, 660], [240, 800], [40, 760], [350, 820]] : [[40, 650], [120, 700], [330, 640], [260, 760], [60, 780], [200, 820]])
    .map(([x, y]) => el('ellipse', { cx: x, cy: y, rx: 3.4, ry: 2.2, fill: p.bloom2, transform: `rotate(30 ${x} ${y})` }))
    .join('');
  if (!sideV(v)) s += blanket(p.blanket, p.lines);
  return s;
}

// ---------- Город под дождём ----------
const RAIN = {
  day: { sky: ['#8C98B8', '#AEB8D0', '#CDD3E2'], far: '#9AA4C2', near: ['#7F89B4', '#8E7AA8', '#6E8AA8'], win: '#DDE6F6', winOp: 0.6, street: '#6E6A8E', walk: '#8A86A8', puddle: '#A9C4E6', lamp: 0.3, blanket: '#7CC8FF', lines: '#FFFFFF' },
  evening: { sky: ['#3A3366', '#7A5E8E', '#B48A9E'], far: '#4E4874', near: ['#3E3A68', '#4E3A64', '#34486A'], win: '#FFC266', winOp: 0.85, street: '#3E3A5E', walk: '#4E4A70', puddle: '#8A6E9A', lamp: 0.9, blanket: '#E77E97', lines: '#FFE3EA' },
  night: { sky: ['#0A0E26', '#18204A', '#2A3260'], far: '#1E2550', near: ['#1A2048', '#24204A', '#16264A'], win: '#FFC266', winOp: 0.95, street: '#22224A', walk: '#2C2E58', puddle: '#3A4A80', lamp: 1, blanket: '#8D6BB8', lines: '#D9CCFF' },
};
export const RAIN_LAMPS = [{ x: 60, y: 392 }, { x: 330, y: 392 }];
export const RAIN_PUDDLES = [{ x: 120, y: 640, rx: 46 }, { x: 300, y: 760, rx: 54 }, { x: 60, y: 800, rx: 34 }];
// Лужи (круги от капель живые — Location.tsx) и фонари по вариантам
export const rainPuddles = (v: Variant) =>
  pick(v, RAIN_PUDDLES, RAIN_PUDDLES, [{ x: 220, y: 660, rx: 50 }, { x: 90, y: 740, rx: 38 }, { x: 320, y: 810, rx: 36 }], [{ x: 160, y: 720, rx: 56 }, { x: 330, y: 640, rx: 34 }, { x: 70, y: 820, rx: 40 }]);
export const rainLamps = (v: Variant) => pick(v, RAIN_LAMPS, RAIN_LAMPS, [{ x: 196, y: 392 }], [{ x: 120, y: 392 }, { x: 300, y: 392 }]);

function rainCity(time: DayTime, v: Variant = 0): string {
  const p = RAIN[time];
  let s = sky(`sky-rain-${time}`, p.sky, [0, 0.4, 0.66]);
  s += cloud(-30, 60, 200, p.far, 0.9) + cloud(160, 30, 240, p.far, 0.85) + cloud(60, 150, 180, p.near[0], 0.5);
  s += LAND; // дальше — земля (в комнате тянется по всей площадке)
  const r = seeded(sideV(v) ? 23 + v * 9 : 23);
  let far = '';
  for (let x = -20; x < 410; x += 36) far += rect(x, +(300 + r() * 80).toFixed(1), 32, 260, p.far);
  s += far;
  const shop = (x: number, w: number, h: number, wall: string, awning: string) => {
    let b = rect(x, 500 - h, w, h, wall, { stroke: INK, 'stroke-width': 2 });
    for (let wy = 520 - h; wy < 420; wy += 30) for (let wx = x + 10; wx < x + w - 18; wx += 26) b += rect(wx, wy, 14, 18, p.win, { opacity: r() < 0.6 ? p.winOp : 0.25, rx: 2 });
    b += rect(x + 8, 440, w - 16, 58, '#2E2438', { stroke: INK, 'stroke-width': 1.8 }) + rect(x + 12, 444, w - 24, 40, p.win, { opacity: p.winOp * 0.7 });
    b += pth(`M${x - 4} 420 H${x + w + 4} L${x + w} 440 H${x} Z`, awning, { stroke: INK, 'stroke-width': 1.8 });
    b += line(Array.from({ length: Math.floor(w / 16) }, (_, i) => `M${x + 8 + i * 16} 421 L${x + 6 + i * 16} 439`).join(' '), '#FFFFFF', 5, { opacity: 0.7, 'stroke-linecap': 'butt' });
    return b;
  };
  // витрины — сплошной рядок домов; на боковых плитках — другие дома и цвета (на шве встают рядом, как соседние)
  s += pick(
    v,
    shop(-10, 130, 210, p.near[0], '#E5566B') + shop(126, 140, 250, p.near[1], '#5ED3A0') + shop(272, 130, 190, p.near[2], '#FFC266'),
    shop(-10, 130, 210, p.near[0], '#E5566B') + shop(126, 140, 250, p.near[1], '#5ED3A0') + shop(272, 130, 190, p.near[2], '#FFC266'),
    shop(-10, 110, 236, p.near[1], '#7CC8FF') + shop(106, 150, 196, p.near[2], '#FF8FB3') + shop(262, 140, 244, p.near[0], '#B39DFF'),
    shop(-10, 150, 192, p.near[2], '#FFAA6B') + shop(146, 112, 262, p.near[0], '#7CC8FF') + shop(264, 138, 220, p.near[1], '#E5566B'),
  );
  s += rect(-60, 498, 510, 30, p.walk, { stroke: INK, 'stroke-width': 2 });
  s += rect(-60, 528, 510, 400, p.street);
  s += line('M-20 690 h60 M90 690 h60 M200 690 h60 M310 690 h60', '#F4F0FF', 5, { opacity: 0.5 });
  s += rainPuddles(v).map((q) => el('ellipse', { cx: q.x, cy: q.y, rx: q.rx, ry: q.rx * 0.24, fill: p.puddle, opacity: 0.8 })).join('');
  s += rainLamps(v).map((L) => line(`M${L.x} 520 V${L.y + 10}`, INK, 4) + line(`M${L.x} 520 V${L.y + 10}`, '#4A4258', 2.2) + glow(L.x, L.y, 44, '#FFE38A', p.lamp) + rect(L.x - 8, L.y - 10, 16, 20, p.lamp > 0.5 ? '#FFE7A3' : '#D9D4E8', { rx: 3, stroke: INK, 'stroke-width': 1.8 }) + pth(`M${L.x - 11} ${L.y - 10} L${L.x} ${L.y - 19} L${L.x + 11} ${L.y - 10} Z`, '#3A3346', { stroke: INK, 'stroke-width': 1.6 })).join('');
  if (!sideV(v)) s += blanket(p.blanket, p.lines);
  // статичные капли (основной дождь живой — Location.tsx)
  const r2 = seeded(sideV(v) ? 29 + v : 29);
  s += line(Array.from({ length: 40 }, () => { const x = r2() * 390; const y = r2() * 840; return `M${x.toFixed(0)} ${y.toFixed(0)} l-3 10`; }).join(' '), '#DDE6F6', 1.4, { opacity: 0.45 });
  return s;
}

// ---------- Горы ----------
const MOUNT = {
  day: { sky: ['#6FB2F0', '#A9D4FA', '#EAF4FF'], stars: 0, far: '#9AB2DA', mid: '#7A93C4', near: '#5E7AA8', snow: '#FFFFFF', meadow: '#8CCB86', meadow2: '#7CBD7A', blanket: '#FF8FA8', lines: '#FFFFFF' },
  evening: { sky: ['#2F2A6E', '#B66A9E', '#FFB48C'], stars: 0.3, far: '#8A6EA8', mid: '#6A5690', near: '#4E4478', snow: '#FFD9E2', meadow: '#5A7468', meadow2: '#4E685E', blanket: '#E77E97', lines: '#FFE3EA' },
  night: { sky: ['#050A22', '#0E1846', '#22306A'], stars: 1, far: '#2A3A6E', mid: '#1E2C5A', near: '#16214A', snow: '#C9D6FF', meadow: '#1E3644', meadow2: '#1A303C', blanket: '#8D6BB8', lines: '#D9CCFF' },
};

function mountains(time: DayTime, v: Variant = 0): string {
  const p = MOUNT[time];
  let s = sky(`sky-mount-${time}`, p.sky, [0, 0.4, 0.62]) + stars(p.stars);
  if (time === 'day') s += sun(310, 120, 30, '#FFE38A', '#FFF4C2');
  if (time === 'evening') s += circ(300, 400, 90, '#FFC29A', { opacity: 0.35 }) + circ(300, 404, 42, '#FF9466');
  if (time === 'night') s += moon(310, 110);
  s += LAND; // дальше — земля (в комнате тянется по всей площадке)
  const peak = (pts: string, cap: string, fill: string) => pth(pts, fill, { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }) + pth(cap, p.snow, { stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' });
  if (!sideV(v)) {
    s += peak('M-60 470 L60 250 L150 380 L230 220 L330 360 L450 270 L450 520 L-60 520 Z', 'M60 250 L84 294 L70 288 L58 300 L44 282 Z M230 220 L258 266 L244 260 L230 272 L216 262 L208 258 Z M450 270 L420 296 L432 296 Z', p.far);
    s += peak('M-60 500 L40 360 L120 450 L200 330 L300 470 L380 380 L450 440 L450 540 L-60 540 Z', 'M40 360 L58 386 L46 384 L36 392 L26 380 Z M200 330 L222 362 L208 358 L198 368 L186 356 L180 358 Z M380 380 L396 400 L384 398 L374 404 Z', p.mid);
  } else {
    // свои вершины; на краях плитки (x = 0 и 390) — та же высота, что у середины: хребты переходят без ступенек
    s += ridge(
      v === 2
        ? [[-60, 470], [0, 360], [84, 286], [140, 352], [214, 236], [292, 334], [348, 284], [390, 315], [450, 270]]
        : [[-60, 470], [0, 360], [46, 318], [124, 238], [196, 330], [262, 270], [326, 338], [390, 315], [450, 270]],
      520, p.far, p.snow,
    );
    s += ridge(
      v === 2
        ? [[-60, 500], [0, 416], [72, 352], [150, 432], [236, 356], [312, 444], [360, 376], [390, 388.6], [450, 440]]
        : [[-60, 500], [0, 416], [58, 382], [112, 338], [192, 424], [262, 346], [334, 412], [390, 388.6], [450, 440]],
      540, p.mid, p.snow,
    );
  }
  s += hill(520, 30, p.near, 51, 130);
  s += pth('M-60 540 C80 526 220 528 450 540 L450 900 L-60 900 Z', p.meadow);
  s += pth('M-60 620 C100 606 260 610 450 624 L450 900 L-60 900 Z', p.meadow2);
  if (!sideV(v)) {
    // указатель и флажки
    s += g(line('M0 0 V60', INK, 4) + line('M0 0 V60', '#9C6B4E', 2.4) + pth('M-4 6 H36 L44 14 L36 22 H-4 Z', '#C98A5E', { stroke: INK, 'stroke-width': 1.6 }) + line('M4 14 h24', '#7A5040', 2), { transform: 'translate(40 520)' });
    s += line('M120 470 C180 500 260 500 330 470', INK, 1.2) + ['#FF8FB3', '#FFD966', '#7CC8FF', '#5ED3A0', '#FFAA6B', '#B39DFF'].map((c, i) => { const x = 136 + i * 34; const y = 478 + Math.sin((i + 0.5) / 6 * Math.PI) * 18; return pth(`M${x - 8} ${y - 4} L${x + 8} ${y - 4} L${x} ${y + 10} Z`, c, { stroke: INK, 'stroke-width': 1.2 }); }).join('');
    s += line('M120 470 V540 M330 470 V540', INK, 3);
  } else if (v === 2) {
    // горный домик
    s += g(
      rect(-40, -44, 80, 44, '#9C6B4E', { stroke: INK, 'stroke-width': 2 }) + line('M-40 -30 H40 M-40 -16 H40', '#7A5040', 1.6) +
        pth('M-50 -40 L0 -76 L50 -40 Z', '#5A4A6E', { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }) + pth('M-50 -40 L0 -76 L50 -40 L44 -38 L0 -70 L-44 -38 Z', p.snow) +
        rect(-28, -34, 18, 16, '#FFE7A3', { stroke: INK, 'stroke-width': 1.6, rx: 2 }) + rect(8, -30, 18, 30, '#6B5048', { stroke: INK, 'stroke-width': 1.6, rx: 2 }),
      { transform: 'translate(240 548)' },
    );
  } else {
    // пирамидка из камней
    s += [[0, 0, 22, 9], [2, -15, 16, 7], [-1, -27, 11, 5.5], [1, -36, 7, 4]].map(([x, y, rx, ry]) => el('ellipse', { cx: 150 + x, cy: 560 + y, rx, ry, fill: '#B9B2CC', stroke: INK, 'stroke-width': 1.6 })).join('');
  }
  s += (sideV(v) ? [[60, 680, '#FFD966'], [200, 640, '#FFFFFF'], [310, 730, '#FF8FB3'], [150, 780, '#B39DFF'], [360, 800, '#FFFFFF']] : [[30, 700, '#FFFFFF'], [120, 660, '#FFD966'], [340, 690, '#B39DFF'], [260, 760, '#FFFFFF'], [80, 800, '#FF8FB3']])
    .map(([x, y, c]) => circ(x as number, y as number, 4, c as string, { stroke: INK, 'stroke-width': 1 }) + circ(x as number, y as number, 1.6, '#FFB347'))
    .join('');
  if (!sideV(v)) s += blanket(p.blanket, p.lines);
  return s;
}

// ---------- Пещера с кристаллами ----------
const CAVE = {
  day: { hole: ['#8FCBF5', '#C9E6FF', '#EAF4FF'], rock: '#4A3F66', rock2: '#3A3152', rock3: '#5A4E78', floor: '#4E4470', floor2: '#443B62', glow: 0.6, blanket: '#7CC8FF', lines: '#FFFFFF' },
  evening: { hole: ['#2F2A6E', '#B5679A', '#FFB48C'], rock: '#3E3458', rock2: '#302844', rock3: '#4E426A', floor: '#433A62', floor2: '#3A3256', glow: 0.8, blanket: '#E77E97', lines: '#FFE3EA' },
  night: { hole: ['#070B24', '#141C4A', '#2C3772'], rock: '#2E2746', rock2: '#231D36', rock3: '#3A3256', floor: '#332C4E', floor2: '#2C2644', glow: 1, blanket: '#8D6BB8', lines: '#D9CCFF' },
};
export const CRYSTALS = [
  { x: 40, y: 470, s: 1.3, c: '#B39DFF' }, { x: 80, y: 486, s: 0.9, c: '#7CE0E6' }, { x: 330, y: 460, s: 1.5, c: '#FF8FC8' },
  { x: 370, y: 480, s: 1, c: '#B39DFF' }, { x: 330, y: 800, s: 1.1, c: '#7CE0E6' }, { x: 60, y: 760, s: 1.2, c: '#FF8FC8' }, { x: 196, y: 470, s: 0.8, c: '#7CE0E6' },
];

// Камни и кристаллы по вариантам (свечение кристаллов и подсказка грибов — Location.tsx; камни — препятствия в комнате)
export const caveRocks = (v: Variant): number[][] =>
  pick(v, [[120, 560, 14], [260, 700, 18], [380, 600, 10]], [[120, 560, 14], [260, 700, 18], [360, 600, 10]], [[80, 600, 16], [300, 640, 12], [200, 760, 18]], [[180, 580, 12], [60, 680, 18], [320, 740, 14]]);
export const crystalsOf = (v: Variant) =>
  v === 0
    ? CRYSTALS
    : v === 1
      ? CRYSTALS.map((c) => (c.x > 350 ? { ...c, x: 352 } : c))
      : v === 2
        ? [{ x: 60, y: 480, s: 1.1, c: '#7CE0E6' }, { x: 250, y: 466, s: 1.4, c: '#B39DFF' }, { x: 300, y: 486, s: 0.85, c: '#FF8FC8' }, { x: 120, y: 790, s: 1.2, c: '#B39DFF' }, { x: 340, y: 770, s: 0.9, c: '#7CE0E6' }]
        : [{ x: 120, y: 470, s: 1.2, c: '#FF8FC8' }, { x: 160, y: 486, s: 0.8, c: '#7CE0E6' }, { x: 320, y: 476, s: 1.3, c: '#7CE0E6' }, { x: 250, y: 800, s: 1.3, c: '#FF8FC8' }, { x: 40, y: 770, s: 0.9, c: '#B39DFF' }];

function cave(time: DayTime, v: Variant = 0): string {
  const p = CAVE[time];
  let s = rect(-60, -60, 510, 960, p.rock2);
  // отверстие в своде — видно время суток (на боковых плитках — маленькое, в другом месте)
  const hx = pick(v, 250, 250, 130, 280);
  const hr = sideV(v) ? 0.45 : 1;
  const hid = `cave-hole-${time}${sideV(v) ? `-${v}` : ''}`;
  s += el('defs', {}, el('clipPath', { id: hid }, el('ellipse', { cx: hx, cy: 120 * (sideV(v) ? 0.9 : 1), rx: 110 * hr, ry: 80 * hr })));
  let hole = sky(sideV(v) ? `sky-${hid}` : `sky-cave-${time}`, p.hole, [0, 0.5, 0.9]);
  if (time === 'day') hole += sun(hx + 40, 100, 22 * hr, '#FFE38A', '#FFF4C2') + (sideV(v) ? '' : cloud(180, 90, 90, '#FFFFFF', 0.9));
  if (time === 'night') hole += stars(1) + circ(hx + 30, 90 + (sideV(v) ? 14 : 0), 12 * hr, '#F6F1D8');
  s += g(hole, { 'clip-path': `url(#${hid})` });
  if (time === 'day') s += sideV(v) ? pth(`M${hx - 40} 160 L${hx + 40} 160 L${hx + 70} 560 L${hx - 70} 560 Z`, '#FFF6D6', { opacity: 0.08 }) : pth('M170 160 L330 160 L380 560 L120 560 Z', '#FFF6D6', { opacity: 0.12 });
  s += pth('M-60 -60 H450 V300 C400 260 380 200 360 140 C350 60 300 30 250 38 C190 30 150 70 140 140 C120 220 60 260 -60 280 Z', p.rock, { stroke: INK, 'stroke-width': 2 });
  s += pth('M-60 280 C40 300 80 360 70 460 L-60 480 Z M450 300 C360 320 330 380 340 470 L450 480 Z', p.rock3, { stroke: INK, 'stroke-width': 2 });
  // сталактиты
  s += (sideV(v) ? (v === 2 ? [[60, 220, 26], [210, 170, 22], [300, 200, 30], [350, 250, 18]] : [[50, 230, 20], [150, 190, 28], [230, 160, 18], [360, 220, 26]]) : [[30, 240, 22], [100, 200, 30], [380, 250, 26], [170, 150, 18], [330, 160, 20]]).map(([x, y, h]) => pth(`M${x - 9} ${y} L${x} ${y + h} L${x + 9} ${y} Z`, p.rock3, { stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' })).join('');
  s += pth('M-60 500 C60 488 200 486 450 500 L450 900 L-60 900 Z', p.floor);
  s += pth('M-60 620 C100 606 260 608 450 622 L450 900 L-60 900 Z', p.floor2);
  s += caveRocks(v).map(([x, y, r]) => el('ellipse', { cx: x, cy: y, rx: r, ry: r * 0.5, fill: p.rock3, stroke: INK, 'stroke-width': 1.4 })).join('');
  // кристаллы (свечение пульсирует — Location.tsx)
  const crystal = (c: { x: number; y: number; s: number; c: string }) =>
    g(
      glow(0, -20, 46, c.c, p.glow * 0.8) +
        pth('M-14 0 L-18 -26 L-10 -40 L-4 -22 L-2 0 Z', c.c, { stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }) +
        pth('M-4 0 L-6 -40 L2 -60 L10 -40 L8 0 Z', c.c, { stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }) +
        pth('M8 0 L12 -22 L20 -30 L22 -14 L18 0 Z', c.c, { stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }) +
        pth('M2 -60 L0 -10 L-6 -40 Z M-10 -40 L-12 -12 L-18 -26 Z', '#FFFFFF', { opacity: 0.45 }),
      { transform: `translate(${c.x} ${c.y}) scale(${c.s})` },
    );
  s += crystalsOf(v).map(crystal).join('');
  if (!sideV(v)) s += blanket(p.blanket, p.lines) + lantern(1);
  return s;
}

const BUILDERS: Record<Exclude<LocationId, 'meadow'>, (t: DayTime, v: Variant) => string> = {
  aurora, roof, beach, forest, snow: snowVillage, cafe, moon: moonBase, sakura, rain: rainCity, mountains, cave,
};
const cache = new Map<string, string>();

function built(id: Exclude<LocationId, 'meadow'>, time: DayTime, v: Variant = 0): string {
  const key = `${id}.${time}.${v}`;
  let s = cache.get(key);
  if (!s) {
    s = BUILDERS[id](time, v);
    cache.set(key, s);
  }
  return s;
}

export function locationSvg(id: Exclude<LocationId, 'meadow'>, time: DayTime): string {
  return built(id, time).replace(LAND, '');
}

// Небо и земля по отдельности. В помещениях (кафе, пещера) неба нет — всё «земля». variant — для плиток комнаты.
export function locationParts(id: Exclude<LocationId, 'meadow'>, time: DayTime, variant: Variant = 0): { sky: string; land: string } {
  const s = built(id, time, variant);
  const at = s.indexOf(LAND);
  return at < 0 ? { sky: '', land: s } : { sky: s.slice(0, at), land: s.slice(at + LAND.length) };
}

// Цвет за сценой (виден на краях при «прыжке» картинки) — низ неба
export const LOCATION_BG: Record<LocationId, Record<DayTime, string>> = {
  meadow: { day: '#6FB7F5', evening: '#2F2A6E', night: '#070B24' },
  aurora: { day: AURORA.day.sky[0], evening: AURORA.evening.sky[0], night: AURORA.night.sky[0] },
  roof: { day: ROOF.day.sky[0], evening: ROOF.evening.sky[0], night: ROOF.night.sky[0] },
  beach: { day: BEACH.day.sky[0], evening: BEACH.evening.sky[0], night: BEACH.night.sky[0] },
  forest: { day: FOREST.day.sky[0], evening: FOREST.evening.sky[0], night: FOREST.night.sky[0] },
  snow: { day: SNOW.day.sky[0], evening: SNOW.evening.sky[0], night: SNOW.night.sky[0] },
  cafe: { day: CAFE.day.wall, evening: CAFE.evening.wall, night: CAFE.night.wall },
  moon: { day: MOON.day.sky[0], evening: MOON.evening.sky[0], night: MOON.night.sky[0] },
  sakura: { day: SAKURA.day.sky[0], evening: SAKURA.evening.sky[0], night: SAKURA.night.sky[0] },
  rain: { day: RAIN.day.sky[0], evening: RAIN.evening.sky[0], night: RAIN.night.sky[0] },
  mountains: { day: MOUNT.day.sky[0], evening: MOUNT.evening.sky[0], night: MOUNT.night.sky[0] },
  cave: { day: CAVE.day.rock2, evening: CAVE.evening.rock2, night: CAVE.night.rock2 },
};
