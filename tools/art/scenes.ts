// Локации 390×844 (как src/lib/scene.ts): луг (порт Meadow.tsx), северное сияние, крыша города, пляж.
import { el, g, line, mix, uid } from './chibi.ts';

const INK = '#2B2035';
const rect = (x: number, y: number, w: number, h: number, fill: string, o: Record<string, string | number> = {}) =>
  el('rect', { x, y, width: w, height: h, fill, ...o });
const circ = (cx: number, cy: number, r: number, fill: string, o: Record<string, string | number> = {}) => el('circle', { cx, cy, r, fill, ...o });
const pth = (d: string, fill: string, o: Record<string, string | number> = {}) => el('path', { d, fill, ...o });

function sky(stops: string[], marks = [0, 0.34, 0.57]): [string, string] {
  const id = uid('sky');
  const defs = el(
    'linearGradient',
    { id, x1: 0, y1: 0, x2: 0, y2: 1 },
    stops.map((c, i) => el('stop', { offset: marks[i], 'stop-color': c })).join(''),
  );
  return [defs, rect(-400, -400, 1190, 1300, `url(#${id})`)];
}

function seeded(seed: number) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}
const rnd = seeded(11);
const STARS = Array.from({ length: 30 }, () => ({ x: 8 + rnd() * 374, y: 24 + rnd() * 380, r: rnd() < 0.25 ? 1.6 : 1.05 }));
const stars = (op: number) => g(STARS.map((s) => circ(+s.x.toFixed(1), +s.y.toFixed(1), s.r, '#FFFFFF')).join(''), { opacity: op });
const CLOUD = 'M14 42 C3 42 1 29 12 27 C12 14 29 10 37 19 C41 6 64 4 70 17 C78 8 95 12 95 25 C108 23 116 34 107 42 Z';
const cloud = (x: number, y: number, w: number, fill: string, op: number) => pth(CLOUD, fill, { transform: `translate(${x} ${y}) scale(${(w / 110).toFixed(3)})`, opacity: op });

const FLOWERS: [number, number, string, number][] = [
  [22, 578, '#FF8FB1', 16], [70, 598, '#FFD166', 13], [124, 572, '#FFFFFF', 13], [276, 580, '#C9B6FF', 16], [300, 604, '#FF8FB1', 13],
  [16, 652, '#FFFFFF', 13], [104, 664, '#FF8FB1', 16], [60, 712, '#C9B6FF', 13], [128, 726, '#FFD166', 13], [252, 726, '#FFFFFF', 16],
  [340, 716, '#FFD166', 13], [372, 628, '#FFFFFF', 13], [8, 734, '#FFD166', 16], [312, 740, '#FF8FB1', 13],
];

type MP = Record<string, any>;
const MEADOW: Record<string, MP> = {
  day: {
    sky: ['#6FB7F5', '#A9D8FF', '#FFE6EF'], starsOp: 0, sun: { op: 1, x: 292, y: 150, r: 34, glowR: 70, color: '#FFE38A', glow: '#FFF4C2' }, moonOp: 0,
    cloud: '#FFFFFF', cloudOp: 0.95, hill1: '#A5DCCB', hill2: '#7FCBB6', lake: '#8FD6F0', lakeEdge: '#6CC3E4', shimmer: '#FFFFFF',
    refl: { color: '#FFF4C2', x: 292, rx: 22, op: 0.5 }, meadow: '#8CD48B', meadow2: '#79C87C', trail: '#F4E1B8', near: '#63B872', trunk: '#8A5A44',
    leaf1: '#4FAF72', leaf2: '#8FDDA6', leaf3: '#3E9A62', bush: '#5CBB78', blanket: '#FF8FA8', blanketLine: '#FFFFFF', lanternOp: 0, flowerOp: 1,
  },
  evening: {
    sky: ['#2F2A6E', '#A15BA6', '#FFB48C'], starsOp: 0.35, sun: { op: 1, x: 92, y: 424, r: 48, glowR: 96, color: '#FF9466', glow: '#FFC29A' }, moonOp: 0,
    cloud: '#FFC7D6', cloudOp: 0.6, hill1: '#7D5AA6', hill2: '#634C94', lake: '#D18BB0', lakeEdge: '#B574A0', shimmer: '#FFD9C2',
    refl: { color: '#FFC29A', x: 92, rx: 40, op: 0.8 }, meadow: '#56817A', meadow2: '#4B746E', trail: '#CDA891', near: '#3D6461', trunk: '#5B3E45',
    leaf1: '#336E61', leaf2: '#5A9A82', leaf3: '#2B5E54', bush: '#3E7064', blanket: '#E77E97', blanketLine: '#FFE3EA', lanternOp: 0.75, flowerOp: 0.85,
  },
  night: {
    sky: ['#070B24', '#141C4A', '#2C3772'], starsOp: 1, sun: { op: 0 }, moonOp: 1, cloud: '#56608F', cloudOp: 0.35, hill1: '#1D2758', hill2: '#18214A',
    lake: '#28376F', lakeEdge: '#1F2C5C', shimmer: '#C9D6FF', refl: { color: '#F6F1D8', x: 300, rx: 24, op: 0.55 }, meadow: '#1E3B49', meadow2: '#1B3441',
    trail: '#3A4862', near: '#15303B', trunk: '#2B2B40', leaf1: '#183C47', leaf2: '#2B5E66', leaf3: '#12313B', bush: '#1B414A', blanket: '#8D6BB8',
    blanketLine: '#D9CCFF', lanternOp: 1, flowerOp: 0.5,
  },
};

export function meadow(time: 'day' | 'evening' | 'night' = 'day', blanket = true): string {
  const p = MEADOW[time];
  const [defs, bg] = sky(p.sky);
  let s = el('defs', {}, defs) + bg;
  if (p.starsOp) s += stars(p.starsOp);
  if (p.sun.op) s += circ(p.sun.x, p.sun.y, p.sun.glowR, p.sun.glow, { opacity: 0.35 }) + circ(p.sun.x, p.sun.y, p.sun.r, p.sun.color);
  if (p.moonOp) s += circ(300, 136, 64, '#DCE3FF', { opacity: 0.12 }) + circ(300, 136, 30, '#F6F1D8') + circ(290, 128, 6, '#E6DFC2') + circ(309, 146, 4.2, '#E6DFC2');
  s += cloud(30, 92, 124, p.cloud, p.cloudOp) + cloud(230, 186, 88, p.cloud, p.cloudOp) + cloud(120, 262, 150, p.cloud, p.cloudOp * 0.9);
  s += pth('M-60 446 C40 412 92 400 140 424 C176 396 236 376 290 402 C330 384 364 390 450 404 L450 520 L-60 520 Z', p.hill1);
  s += pth('M-60 474 C60 448 120 446 180 466 C240 442 320 440 450 462 L450 520 L-60 520 Z', p.hill2);
  s += rect(54, 466, 8, 28, p.trunk, { rx: 3 }) + circ(58, 450, 22, p.leaf1) + circ(44, 463, 14, p.leaf3) + circ(72, 462, 15, p.leaf1) + circ(51, 440, 8, p.leaf2, { opacity: 0.7 });
  s += pth('M-60 490 C70 480 150 478 230 484 C300 488 350 484 450 492 L450 544 C330 552 250 550 170 548 C90 546 30 550 -60 552 Z', p.lake);
  s += pth('M-60 490 C70 480 150 478 230 484 C300 488 350 484 450 492 L450 498 C340 492 290 496 230 492 C150 486 70 488 -60 498 Z', p.lakeEdge);
  s += line('M52 512 h26 M146 524 h40 M254 508 h22 M300 530 h30 M100 536 h18', p.shimmer, 2.4, { opacity: 0.6 });
  s += el('ellipse', { cx: p.refl.x, cy: 514, rx: p.refl.rx, ry: 4, fill: p.refl.color, opacity: p.refl.op });
  s += pth('M-60 540 C80 528 160 526 240 532 C300 537 350 534 450 528 L450 900 L-60 900 Z', p.meadow);
  s += pth('M-60 612 C100 590 260 594 450 614 L450 900 L-60 900 Z', p.meadow2);
  s += pth('M188 540 C176 562 206 580 196 606 C184 636 150 652 160 700 C168 740 140 790 150 900 L236 900 C222 790 246 744 232 702 C222 664 256 640 262 608 C268 580 232 562 226 540 Z', p.trail, { opacity: 0.85 });
  s += rect(340, 540, 12, 58, p.trunk, { rx: 5 }) + circ(346, 512, 38, p.leaf1) + circ(318, 536, 25, p.leaf3) + circ(374, 534, 24, p.leaf1) + circ(334, 496, 14, p.leaf2, { opacity: 0.7 });
  s += circ(18, 602, 17, p.bush) + circ(42, 608, 14, p.leaf3) + circ(12, 594, 7, p.leaf2, { opacity: 0.6 });
  if (blanket) {
    s += pth('M214 626 L360 618 L378 690 L200 700 Z', p.blanket);
    s += line('M250 624 L240 698 M288 622 L284 696 M326 620 L330 693 M209 650 L366 641 M204 675 L372 666', p.blanketLine, 6, { opacity: 0.5, 'stroke-linecap': 'butt' });
  }
  s += g(
    FLOWERS.map(([x, y, c, size]) =>
      g(
        circ(10, 4.6, 3.6, c) + circ(15.2, 8.4, 3.6, c) + circ(13.2, 14.4, 3.6, c) + circ(6.8, 14.4, 3.6, c) + circ(4.8, 8.4, 3.6, c) + circ(10, 10, 2.9, '#FFB347'),
        { transform: `translate(${x} ${y}) scale(${size / 20})` },
      ),
    ).join(''),
    { opacity: p.flowerOp },
  );
  if (p.lanternOp) s += g(rect(199, 612, 15, 19, '#FFE7A3', { rx: 4, stroke: INK, 'stroke-width': 1.6 }) + line('M202 612 Q206.5 603 211 612', INK, 1.6), { opacity: p.lanternOp });
  s += pth('M-60 748 C90 736 220 738 450 752 L450 900 L-60 900 Z', p.near);
  s += line('M18 750 l3 -13 l3 11 l4 -15 l3 17 M120 742 l3 -11 l3 9 l4 -13 l3 15 M292 746 l3 -12 l3 10 l4 -14 l3 16 M366 752 l3 -11 l3 9 l4 -12 l3 14', p.leaf3, 2.4);
  // бабочки днём
  if (time === 'day') {
    const fly = (x: number, y: number, c: string) =>
      g(pth('M0 0 C-6 -8 -12 -4 -8 2 C-6 5 -2 3 0 0 Z M0 0 C6 -8 12 -4 8 2 C6 5 2 3 0 0 Z', c, { stroke: INK, 'stroke-width': 1.2 }), { transform: `translate(${x} ${y})` });
    s += fly(120, 590, '#FFB3D1') + fly(300, 560, '#FFE38A');
  }
  return s;
}

export function aurora(): string {
  const [defs, bg] = sky(['#03071C', '#0B1640', '#1C2C60'], [0, 0.4, 0.62]);
  const ag = uid('aur');
  const blur = uid('blur');
  let d = defs;
  d += el('linearGradient', { id: ag, x1: 0, y1: 0, x2: 1, y2: 0 }, el('stop', { offset: 0, 'stop-color': '#5EF2C0' }) + el('stop', { offset: 0.5, 'stop-color': '#7FD8FF' }) + el('stop', { offset: 1, 'stop-color': '#C59BFF' }));
  d += el('filter', { id: blur, x: '-20%', y: '-50%', width: '140%', height: '200%' }, el('feGaussianBlur', { stdDeviation: 10 }));
  let s = el('defs', {}, d) + bg + stars(1);
  s += g(
    pth('M-40 250 C40 170 120 260 200 190 C270 130 330 210 430 150 L430 230 C330 290 270 210 200 270 C120 340 40 250 -40 330 Z', `url(#${ag})`, { opacity: 0.55 }) +
      pth('M-40 170 C60 120 140 190 220 130 C290 80 350 140 430 100 L430 140 C350 180 290 130 220 180 C140 240 60 170 -40 220 Z', `url(#${ag})`, { opacity: 0.35 }),
    { filter: `url(#${blur})` },
  );
  s += line('M30 236 C60 214 90 226 120 210 M200 216 C230 196 260 205 290 186 M300 196 C330 176 360 186 390 166', '#C8FFF0', 1.6, { opacity: 0.45 });
  s += circ(320, 92, 14, '#F6F1D8', { opacity: 0.9 });
  // сопки
  s += pth('M-60 430 L30 356 L80 392 L150 330 L230 400 L290 352 L360 404 L450 360 L450 520 L-60 520 Z', '#22336A');
  s += pth('M30 356 L48 371 L40 372 L30 366 L20 373 Z M150 330 L172 349 L160 352 L150 344 L138 352 L128 350 Z M290 352 L308 367 L298 369 L290 362 L280 368 Z', '#DDE6FF', { opacity: 0.9 });
  s += pth('M-60 470 C40 440 110 446 180 462 C250 440 330 436 450 456 L450 560 L-60 560 Z', '#4B5C96');
  // ели
  const pine = (x: number, y: number, k: number) =>
    g(pth('M0 0 L-14 22 H-6 L-18 42 H-8 L-20 62 H20 L8 42 H18 L6 22 H14 Z', '#1C2A52') + pth('M0 0 L-6 10 H6 Z M-8 24 L-2 28 L4 24 Z M-10 46 L0 50 L10 46 Z', '#E8EEFF', { opacity: 0.85 }) + rect(-3, 62, 6, 9, '#3A2E3E'), {
      transform: `translate(${x} ${y}) scale(${k})`,
    });
  s += pine(330, 430, 1.05) + pine(362, 452, 0.8) + pine(22, 448, 0.85);
  // домик
  s += g(
    rect(60, 470, 76, 50, '#6B4A5E', { stroke: INK, 'stroke-width': 2 }) +
      pth('M50 474 L98 436 L146 474 Z', '#2E2A4E', { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }) +
      pth('M50 474 L98 436 L146 474 L140 476 L98 444 L56 476 Z', '#EEF3FF') +
      circ(80, 492, 16, '#FFC266', { opacity: 0.25 }) + rect(72, 484, 16, 16, '#FFC266', { stroke: INK, 'stroke-width': 1.8, rx: 2 }) +
      rect(104, 484, 16, 16, '#FFC266', { stroke: INK, 'stroke-width': 1.8, rx: 2 }) + line('M80 484 V500 M72 492 H88 M112 484 V500 M104 492 H120', INK, 1.2) +
      rect(118, 440, 8, 18, '#5A4050', { stroke: INK, 'stroke-width': 1.6 }),
    {},
  );
  s += pth('M-60 520 C60 506 160 504 260 512 C330 517 380 512 450 506 L450 900 L-60 900 Z', '#8796C8');
  s += pth('M-60 610 C100 592 260 596 450 612 L450 900 L-60 900 Z', '#7383BA');
  s += pth('M214 626 L360 618 L378 690 L200 700 Z', '#8D6BB8');
  s += line('M250 624 L240 698 M288 622 L284 696 M326 620 L330 693 M209 650 L366 641 M204 675 L372 666', '#D9CCFF', 6, { opacity: 0.5, 'stroke-linecap': 'butt' });
  s += g(rect(199, 612, 15, 19, '#FFE7A3', { rx: 4, stroke: INK, 'stroke-width': 1.6 }) + line('M202 612 Q206.5 603 211 612', INK, 1.6));
  s += pth('M-60 748 C90 736 220 738 450 752 L450 900 L-60 900 Z', '#5F6FA6');
  const r2 = seeded(5);
  s += g(Array.from({ length: 40 }, () => circ(+(r2() * 390).toFixed(1), +(r2() * 800).toFixed(1), r2() < 0.3 ? 2 : 1.2, '#FFFFFF')).join(''), { opacity: 0.7 });
  return s;
}

export function roof(): string {
  const [defs, bg] = sky(['#2F2A6E', '#A15BA6', '#FFB48C'], [0, 0.32, 0.55]);
  let s = el('defs', {}, defs) + bg + stars(0.35);
  s += circ(300, 400, 90, '#FFC29A', { opacity: 0.35 }) + circ(300, 410, 46, '#FF9466');
  const r = seeded(3);
  let far = '';
  let win = '';
  for (let x = -20; x < 410; x += 34) {
    const h = 60 + r() * 110;
    far += rect(x, 470 - h, 30, h + 60, '#4A3A78');
    for (let wy = 470 - h + 10; wy < 460; wy += 14) for (let wx = x + 5; wx < x + 26; wx += 9) if (r() < 0.35) win += rect(wx, wy, 4, 6, '#FFD38A');
  }
  s += far + g(win, { opacity: 0.75 });
  let near = '';
  let win2 = '';
  [[-30, 380, 70], [44, 410, 54], [104, 360, 64], [176, 400, 50], [232, 372, 70], [308, 392, 60], [364, 350, 70]].forEach(([x, y, w]) => {
    near += rect(x, y, w, 200, '#2E244F');
    for (let wy = y + 12; wy < 500; wy += 18) for (let wx = x + 8; wx < x + w - 8; wx += 14) if (r() < 0.45) win2 += rect(wx, wy, 6, 8, '#FFC266');
  });
  s += near + g(win2, { opacity: 0.85 });
  // крыша
  s += rect(-60, 506, 510, 400, '#4A3F6B');
  s += line('M-60 560 H450 M-60 620 H450 M-60 690 H450 M-60 770 H450', '#5A4E7E', 2);
  s += rect(-60, 500, 510, 14, '#6A5C93', { stroke: INK, 'stroke-width': 2 });
  // антенна
  s += line('M44 500 V420 M30 436 H58 M34 452 H54 M38 468 H50', '#2B2035', 3);
  // бак с водой
  s += g(
    line('M300 500 L306 452 M352 500 L346 452 M310 480 H342', INK, 3) +
      rect(292, 404, 68, 50, '#8A6B5E', { stroke: INK, 'stroke-width': 2, rx: 4 }) +
      line('M292 418 H360 M292 440 H360', '#6B5048', 2) +
      pth('M288 406 L326 384 L364 406 Z', '#6B5048', { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }),
  );
  // гирлянда
  s += line('M-10 430 C80 470 200 474 400 430', '#2B2035', 1.4);
  const bulbs = ['#FFD966', '#FF8FB3', '#7CC8FF', '#5ED3A0', '#FFAA6B'];
  for (let i = 0; i < 12; i += 1) {
    const t = i / 11;
    const x = -10 + 410 * t;
    const y = (1 - t) ** 3 * 430 + 3 * (1 - t) ** 2 * t * 470 + 3 * (1 - t) * t * t * 474 + t ** 3 * 430;
    s += circ(+x.toFixed(1), +(y + 5).toFixed(1), 9, bulbs[i % 5], { opacity: 0.3 }) + circ(+x.toFixed(1), +(y + 5).toFixed(1), 4, bulbs[i % 5], { stroke: INK, 'stroke-width': 1.2 });
  }
  // горшки и плед
  const pot = (x: number) => rect(x, 560, 26, 22, '#C97C5D', { stroke: INK, 'stroke-width': 1.8, rx: 3 }) + circ(x + 13, 552, 15, '#5CBB78', { stroke: INK, 'stroke-width': 1.8 }) + circ(x + 6, 548, 7, '#7FD8A0');
  s += pot(16) + pot(350);
  s += pth('M214 626 L360 618 L378 690 L200 700 Z', '#E77E97');
  s += line('M250 624 L240 698 M288 622 L284 696 M326 620 L330 693 M209 650 L366 641 M204 675 L372 666', '#FFE3EA', 6, { opacity: 0.5, 'stroke-linecap': 'butt' });
  return s;
}

export function beach(): string {
  const [defs, bg] = sky(['#79C6FF', '#B8E4FF', '#FFF0DA'], [0, 0.32, 0.52]);
  let s = el('defs', {}, defs) + bg;
  s += circ(92, 160, 70, '#FFF4C2', { opacity: 0.4 }) + circ(92, 160, 34, '#FFE38A');
  s += cloud(200, 110, 120, '#FFFFFF', 0.95) + cloud(30, 250, 90, '#FFFFFF', 0.9);
  s += line('M240 220 q6 -6 12 0 q6 -6 12 0 M290 250 q5 -5 10 0 q5 -5 10 0', INK, 2);
  s += pth('M-60 420 H450 V540 H-60 Z', '#4FB3E6');
  s += pth('M-60 420 H450 V436 H-60 Z', '#3A9BD6');
  s += line('M10 456 q10 -6 20 0 q10 6 20 0 M120 470 q10 -6 20 0 q10 6 20 0 M240 452 q10 -6 20 0 q10 6 20 0 M60 500 q10 -6 20 0 q10 6 20 0 M200 510 q10 -6 20 0 q10 6 20 0 M310 494 q10 -6 20 0', '#FFFFFF', 2.2, { opacity: 0.7 });
  // маяк
  s += pth('M300 470 C310 440 360 436 392 450 L410 520 L290 520 Z', '#8A7F99', { stroke: INK, 'stroke-width': 2 });
  s += g(
    pth('M332 450 L338 330 H362 L368 450 Z', '#FFFFFF', { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }) +
      pth('M335.5 390 L336.8 366 H363.2 L364.5 390 Z M333.6 430 L334.6 412 H365.4 L366.4 430 Z', '#E5566B') +
      rect(336, 312, 28, 20, '#FFE38A', { stroke: INK, 'stroke-width': 2 }) +
      pth('M332 312 L350 296 L368 312 Z', '#3A3346', { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }),
  );
  // песок
  s += pth('M-60 530 C60 518 180 520 260 526 C330 531 380 528 450 522 L450 900 L-60 900 Z', '#E8C98E');
  s += pth('M-60 546 C80 536 200 538 450 544 L450 900 L-60 900 Z', '#F6DDA8');
  // зонтик
  s += line('M64 640 L84 520', INK, 3);
  s += pth('M30 548 C40 506 120 494 138 530 Z', '#FF8FB3', { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' });
  s += pth('M58 536 C66 516 86 506 92 512 C96 524 98 530 98 536 Z', '#FFFFFF', { opacity: 0.9 });
  // ракушки и звезда
  s += g(pth('M0 -9 L2.6 -3 L9 -2.8 L4 1.4 L5.6 8 L0 4.4 L-5.6 8 L-4 1.4 L-9 -2.8 L-2.6 -3 Z', '#FFAA6B', { stroke: INK, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }), { transform: 'translate(150 700)' });
  s += g(pth('M-7 4 C-7 -4 7 -4 7 4 Z', '#FFD3E2', { stroke: INK, 'stroke-width': 1.3 }) + line('M-3 3 L-1 -2 M3 3 L1 -2', INK, 1), { transform: 'translate(320 740)' });
  s += g(pth('M-6 3 C-6 -3 6 -3 6 3 Z', '#FFF4E0', { stroke: INK, 'stroke-width': 1.3 }), { transform: 'translate(60 760)' });
  s += pth('M214 626 L360 618 L378 690 L200 700 Z', '#7CC8FF');
  s += line('M250 624 L240 698 M288 622 L284 696 M326 620 L330 693 M209 650 L366 641 M204 675 L372 666', '#FFFFFF', 6, { opacity: 0.5, 'stroke-linecap': 'butt' });
  return s;
}

export const sceneOf = { meadow, aurora, roof, beach };
export { mix };
