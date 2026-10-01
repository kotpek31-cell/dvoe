// Локации 0.2: статичная часть рисунка — SVG-строки в координатах сцены 390×844 (как луг),
// по палитре на день, вечер и ночь. Живые детали (сияние, снег, гирлянда, чайки, луч маяка) — в Location.tsx.
// Все локации устроены одинаково: полоса, где ходят чибики (y ≈ 520–560), плед для спящих (214–378 × 618–700).
// Новая локация = новая функция здесь + запись в public.locations; главную переделывать не нужно.
import type { DayTime } from './scene';

export type LocationId = 'meadow' | 'aurora' | 'roof' | 'beach';

export const LOCATIONS: { id: LocationId; name: string }[] = [
  { id: 'meadow', name: 'Луг у озера' },
  { id: 'aurora', name: 'Северное сияние' },
  { id: 'roof', name: 'Крыша города' },
  { id: 'beach', name: 'Пляж' },
];

export const locationName = (id: string | null | undefined) => LOCATIONS.find((l) => l.id === id)?.name ?? 'Луг у озера';
export const isLocationId = (id: unknown): id is LocationId => LOCATIONS.some((l) => l.id === id);

const INK = '#2B2035';
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

function aurora(time: DayTime): string {
  const p = AURORA[time];
  let s = sky(`sky-aurora-${time}`, p.sky, [0, 0.4, 0.62]) + stars(p.stars);
  if (time === 'day') s += sun(92, 362, 30, '#FFE7B0', '#FFF6DE') + cloud(210, 120, 110, '#FFFFFF', 0.85) + cloud(40, 210, 80, '#FFFFFF', 0.7);
  if (time === 'evening') s += sun(300, 436, 34, '#FFB08A', '#FFD3BE');
  if (time === 'night') s += circ(320, 92, 14, '#F6F1D8', { opacity: 0.9 });
  s += pth('M-60 430 L30 356 L80 392 L150 330 L230 400 L290 352 L360 404 L450 360 L450 520 L-60 520 Z', p.back);
  s += pth('M30 356 L48 371 L40 372 L30 366 L20 373 Z M150 330 L172 349 L160 352 L150 344 L138 352 L128 350 Z M290 352 L308 367 L298 369 L290 362 L280 368 Z', '#F2F5FF', { opacity: 0.9 });
  s += pth('M-60 470 C40 440 110 446 180 462 C250 440 330 436 450 456 L450 560 L-60 560 Z', p.front);
  const pine = (x: number, y: number, k: number) =>
    g(
      pth('M0 0 L-14 22 H-6 L-18 42 H-8 L-20 62 H20 L8 42 H18 L6 22 H14 Z', p.pine) +
        pth('M0 0 L-6 10 H6 Z M-8 24 L-2 28 L4 24 Z M-10 46 L0 50 L10 46 Z', '#E8EEFF', { opacity: 0.85 }) +
        rect(-3, 62, 6, 9, '#3A2E3E'),
      { transform: `translate(${x} ${y}) scale(${k})` },
    );
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
  s += pth('M-60 520 C60 506 160 504 260 512 C330 517 380 512 450 506 L450 900 L-60 900 Z', p.snow);
  s += pth('M-60 610 C100 592 260 596 450 612 L450 900 L-60 900 Z', p.snow2);
  s += blanket(p.blanket, p.lines) + lantern(p.lantern);
  s += pth('M-60 748 C90 736 220 738 450 752 L450 900 L-60 900 Z', p.near);
  const r2 = seeded(5);
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

function roof(time: DayTime): string {
  const p = ROOF[time];
  let s = sky(`sky-roof-${time}`, p.sky, [0, 0.32, 0.55]) + stars(p.stars);
  if (time === 'day') s += sun(300, 150, 34, '#FFE38A', '#FFF4C2') + cloud(30, 100, 120, '#FFFFFF', 0.95) + cloud(220, 230, 90, '#FFFFFF', 0.9);
  if (time === 'evening') s += circ(300, 400, 90, '#FFC29A', { opacity: 0.35 }) + circ(300, 410, 46, '#FF9466');
  if (time === 'night') s += moon(300, 120);
  const r = seeded(3);
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
  [[-30, 380, 70], [44, 410, 54], [104, 360, 64], [176, 400, 50], [232, 372, 70], [308, 392, 60], [364, 350, 70]].forEach(([x, y, w]) => {
    near += rect(x, y, w, 200, p.near);
    for (let wy = y + 12; wy < 500; wy += 18) for (let wx = x + 8; wx < x + w - 8; wx += 14) if (r() < p.winChance + 0.05) win2 += rect(wx, wy, 6, 8, p.nearWin);
  });
  s += near + g(win2, { opacity: p.nearWinOp });
  s += rect(-60, 506, 510, 400, p.roof);
  s += line('M-60 560 H450 M-60 620 H450 M-60 690 H450 M-60 770 H450', p.roofLine, 2);
  s += rect(-60, 500, 510, 14, p.edge, { stroke: INK, 'stroke-width': 2 });
  s += line('M44 500 V420 M30 436 H58 M34 452 H54 M38 468 H50', INK, 3);
  s += g(
    line('M300 500 L306 452 M352 500 L346 452 M310 480 H342', INK, 3) +
      rect(292, 404, 68, 50, p.tank, { stroke: INK, 'stroke-width': 2, rx: 4 }) +
      line('M292 418 H360 M292 440 H360', '#6B5048', 2) +
      pth('M288 406 L326 384 L364 406 Z', '#6B5048', { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }),
  );
  // гирлянда: провод и лампочки (светятся вечером и ночью — свечение в Location.tsx)
  s += line('M-10 430 C80 470 200 474 400 430', INK, 1.4);
  s += GARLAND.map((b) => circ(b.x, b.y, 4, p.bulbs ? b.color : '#D9D4E8', { stroke: INK, 'stroke-width': 1.2 })).join('');
  const pot = (x: number) =>
    rect(x, 560, 26, 22, '#C97C5D', { stroke: INK, 'stroke-width': 1.8, rx: 3 }) + circ(x + 13, 552, 15, '#5CBB78', { stroke: INK, 'stroke-width': 1.8 }) + circ(x + 6, 548, 7, '#7FD8A0');
  s += pot(16) + pot(350);
  s += blanket(p.blanket, p.lines);
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

function beach(time: DayTime): string {
  const p = BEACH[time];
  let s = sky(`sky-beach-${time}`, p.sky, [0, 0.32, 0.52]) + stars(p.stars);
  if (time === 'day') {
    s += sun(92, 160, 34, '#FFE38A', '#FFF4C2') + cloud(200, 110, 120, '#FFFFFF', 0.95) + cloud(30, 250, 90, '#FFFFFF', 0.9);
  }
  if (time === 'evening') s += circ(190, 420, 100, '#FFC29A', { opacity: 0.35 }) + circ(190, 424, 48, '#FF9466');
  if (time === 'night') s += moon(92, 150);
  s += pth('M-60 420 H450 V540 H-60 Z', p.sea);
  s += pth('M-60 420 H450 V436 H-60 Z', p.seaFar);
  if (time === 'evening') s += pth('M150 436 H230 L250 530 H130 Z', '#FFB48C', { opacity: 0.35 });
  s += line(
    'M10 456 q10 -6 20 0 q10 6 20 0 M120 470 q10 -6 20 0 q10 6 20 0 M240 452 q10 -6 20 0 q10 6 20 0 M60 500 q10 -6 20 0 q10 6 20 0 M200 510 q10 -6 20 0 q10 6 20 0 M310 494 q10 -6 20 0',
    p.foam,
    2.2,
    { opacity: 0.7 },
  );
  // маяк
  s += pth('M300 470 C310 440 360 436 392 450 L410 520 L290 520 Z', p.rock, { stroke: INK, 'stroke-width': 2 });
  s += g(
    pth('M332 450 L338 330 H362 L368 450 Z', time === 'night' ? '#C9CDE6' : '#FFFFFF', { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }) +
      pth('M335.5 390 L336.8 366 H363.2 L364.5 390 Z M333.6 430 L334.6 412 H365.4 L366.4 430 Z', '#E5566B') +
      (time === 'day' ? '' : circ(350, 322, 22, p.lamp, { opacity: 0.45 })) +
      rect(336, 312, 28, 20, p.lamp, { stroke: INK, 'stroke-width': 2 }) +
      pth('M332 312 L350 296 L368 312 Z', '#3A3346', { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }),
  );
  s += pth('M-60 530 C60 518 180 520 260 526 C330 531 380 528 450 522 L450 900 L-60 900 Z', p.sand);
  s += pth('M-60 546 C80 536 200 538 450 544 L450 900 L-60 900 Z', p.sand2);
  s += line('M64 640 L84 520', INK, 3);
  s += pth('M30 548 C40 506 120 494 138 530 Z', p.umbrella, { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' });
  s += pth('M58 536 C66 516 86 506 92 512 C96 524 98 530 98 536 Z', '#FFFFFF', { opacity: time === 'night' ? 0.4 : 0.9 });
  s += g(pth('M0 -9 L2.6 -3 L9 -2.8 L4 1.4 L5.6 8 L0 4.4 L-5.6 8 L-4 1.4 L-9 -2.8 L-2.6 -3 Z', '#FFAA6B', { stroke: INK, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }), { transform: 'translate(150 700)' });
  s += g(pth('M-7 4 C-7 -4 7 -4 7 4 Z', '#FFD3E2', { stroke: INK, 'stroke-width': 1.3 }) + line('M-3 3 L-1 -2 M3 3 L1 -2', INK, 1), { transform: 'translate(320 740)' });
  s += g(pth('M-6 3 C-6 -3 6 -3 6 3 Z', '#FFF4E0', { stroke: INK, 'stroke-width': 1.3 }), { transform: 'translate(60 760)' });
  s += blanket(p.blanket, p.lines);
  return s;
}

const BUILDERS: Record<Exclude<LocationId, 'meadow'>, (t: DayTime) => string> = { aurora, roof, beach };
const cache = new Map<string, string>();

export function locationSvg(id: Exclude<LocationId, 'meadow'>, time: DayTime): string {
  const key = `${id}.${time}`;
  let s = cache.get(key);
  if (!s) {
    s = BUILDERS[id](time);
    cache.set(key, s);
  }
  return s;
}

// Цвет за сценой (виден на краях при «прыжке» картинки) — низ неба
export const LOCATION_BG: Record<LocationId, Record<DayTime, string>> = {
  meadow: { day: '#6FB7F5', evening: '#2F2A6E', night: '#070B24' },
  aurora: { day: AURORA.day.sky[0], evening: AURORA.evening.sky[0], night: AURORA.night.sky[0] },
  roof: { day: ROOF.day.sky[0], evening: ROOF.evening.sky[0], night: ROOF.night.sky[0] },
  beach: { day: BEACH.day.sky[0], evening: BEACH.evening.sky[0], night: BEACH.night.sky[0] },
};
