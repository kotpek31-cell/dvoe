// Параметрическое лицо эмоции (без React Native — рисует Face.tsx, а виджет берёт SVG-строку).
// value 0 = нейтрально, 100 = эмоция на максимуме. Параметры плавно идут: нейтральное → mid (50) → peak (100).
// Координаты в квадрате 100×100, лицо — круг (50, 50) радиусом 40.

export type FaceKey =
  | 'joy'
  | 'calm'
  | 'love'
  | 'passion'
  | 'inspiration'
  | 'sadness'
  | 'boredom'
  | 'anxiety'
  | 'anger'
  | 'tiredness'
  | 'sleep';

type P = {
  ew: number; eto: number; eti: number; ebo: number; ebi: number; ey: number; edx: number; shine: number; hEyes: number;
  bop: number; by: number; bo: number; bi: number; barch: number; bl: number;
  mw: number; mu: number; ml: number; mt: number; ms: number; mv: number; my: number; rot: number;
  blush: number; tears: number; sweat: number; anger: number; steam: number; hearts: number; sparkle: number;
  flame: number; zzz: number; dots: number; glow: number; fear: number; bags: number;
};

const N: P = {
  ew: 5, eto: -8, eti: -8, ebo: 8, ebi: 8, ey: 47, edx: 15, shine: 0, hEyes: 0,
  bop: 0, by: -12, bo: 0, bi: 0, barch: -1.5, bl: 0,
  mw: 6, mu: 0.5, ml: 0.5, mt: 0, ms: 0, mv: 0, my: 65, rot: 0,
  blush: 0.12, tears: 0, sweat: 0, anger: 0, steam: 0, hearts: 0, sparkle: 0,
  flame: 0, zzz: 0, dots: 0, glow: 0, fear: 0, bags: 0,
};

type Def = { color: string; mid: Partial<P>; peak: Partial<P> };

export const FACE_DEFS: Record<FaceKey, Def> = {
  joy: {
    color: '#FFD166',
    mid: { eto: -8.5, eti: -8.5, ebo: 1.5, ebi: 1.5, mw: 10, mu: 2.5, ml: 7, blush: 0.5, sparkle: 0.12 },
    peak: { eto: -7.5, eti: -7.5, ebo: -3.2, ebi: -3.2, ey: 46, mw: 13, mu: 1.5, ml: 16, my: 63, blush: 0.75, sparkle: 1 },
  },
  calm: {
    color: '#7FD8BE',
    mid: { eto: -1.5, eti: -1.5, ebo: 7, ebi: 7, mw: 7, mu: 1.8, ml: 2, blush: 0.3, bop: 0.35, by: -13, barch: -2, glow: 0.4 },
    peak: { eto: 2.5, eti: 2.5, ebo: 5.5, ebi: 5.5, mw: 8, mu: 2.6, ml: 2.8, blush: 0.45, bop: 0.45, by: -14, barch: -2.5, glow: 1 },
  },
  love: {
    color: '#FF9EBB',
    mid: { ebo: 3, ebi: 3, mw: 8, mu: 2.2, ml: 4, blush: 0.8, hearts: 0.45, hEyes: 0 },
    peak: { hEyes: 1, ebo: 3, ebi: 3, mw: 10, mu: 2, ml: 9, blush: 1, hearts: 1 },
  },
  passion: {
    color: '#FF7A7A',
    mid: { eto: -2.5, eti: -1.5, ebo: 7, ebi: 7, bop: 0.9, by: -11, bo: -1, bi: 1, barch: -1, bl: -3, mw: 8, mu: 1.2, ml: 2.2, mt: 2.2, ms: 2, blush: 0.45, flame: 0.45 },
    peak: { eto: -1.5, eti: -0.5, ebo: 6.5, ebi: 6.5, bop: 1, by: -10, bo: -1.5, bi: 1.5, barch: -1, bl: -5, mw: 9, mu: 1, ml: 5, mt: 3.2, ms: 3, blush: 0.8, flame: 1 },
  },
  inspiration: {
    color: '#B39DFF',
    mid: { ew: 5.6, eto: -10, eti: -10, ebo: 9.5, ebi: 9.5, shine: 0.6, bop: 0.55, by: -15, barch: -2.5, mw: 9, mu: 2.5, ml: 5.5, sparkle: 0.45 },
    peak: { ew: 6.2, eto: -11.5, eti: -11.5, ebo: 10.5, ebi: 10.5, shine: 1, bop: 0.7, by: -17, barch: -3, mw: 7.5, mu: -0.5, ml: 9.5, sparkle: 1 },
  },
  sadness: {
    color: '#6FA8DC',
    mid: { ew: 5.3, eto: -5.5, eti: -10, ebo: 8.5, ebi: 8.5, shine: 0.7, bop: 1, by: -13, bo: 2, bi: -3.5, barch: -0.5, mw: 6.5, mu: -2.2, ml: -1.6, tears: 0.3, blush: 0.1 },
    peak: { ew: 5.6, eto: -5, eti: -11.5, ebo: 9.5, ebi: 9.5, shine: 1, bop: 1, by: -14, bo: 3, bi: -5.5, barch: 0, mw: 8.5, mu: -4.5, ml: 0, mv: 0.8, tears: 1, blush: 0.2 },
  },
  boredom: {
    color: '#A0A0B2',
    mid: { eto: 0, eti: 0, ebo: 7, ebi: 7, bop: 0.55, by: -10.5, barch: 0, mw: 6.5, mu: 0, ml: 0, mt: -0.8, ms: 2.5, rot: -3, dots: 0 },
    peak: { eto: 0.8, eti: 0.8, ebo: 6.5, ebi: 6.5, bop: 0.7, by: -9.5, barch: 0.3, mw: 7.5, mu: -0.6, ml: -0.6, mt: -1.8, ms: 5, rot: -7, dots: 1 },
  },
  anxiety: {
    color: '#F4A261',
    mid: { ew: 5.6, eto: -10.5, eti: -11.5, ebo: 10, ebi: 10, shine: 0.2, bop: 1, by: -15, bo: 1.5, bi: -3.5, barch: -0.5, mw: 7.5, mu: -1, ml: 1, mv: 1.2, sweat: 0.5, fear: 0.3 },
    peak: { ew: 6.3, eto: -12, eti: -13.5, ebo: 12, ebi: 12, shine: 0.3, bop: 1, by: -17, bo: 2.5, bi: -5, barch: 0, mw: 10, mu: -1.8, ml: 3.5, mv: 2.2, sweat: 1, fear: 0.85 },
  },
  anger: {
    color: '#E76F51',
    mid: { eto: -8, eti: -2.5, ebo: 7, ebi: 7, bop: 1, by: -11, bo: -3, bi: 3, barch: 0.8, mw: 7.5, mu: -2, ml: -1.5, anger: 0.5, steam: 0 },
    peak: { eto: -6, eti: 0, ebo: 6, ebi: 6, bop: 1, by: -10, bo: -4.5, bi: 5, barch: 1.2, mw: 11, mu: -3.5, ml: 5, mv: 0.6, anger: 1, steam: 1 },
  },
  tiredness: {
    color: '#8D99AE',
    mid: { eto: 0.3, eti: 0.3, ebo: 6.5, ebi: 6.5, bags: 0.6, bop: 0.4, by: -11, barch: 0, mw: 5.5, mu: -0.4, ml: -0.4, zzz: 0.25, rot: 2 },
    peak: { eto: 3, eti: 3, ebo: 5, ebi: 5, bags: 1, bop: 0.45, by: -10.5, barch: 0.3, mw: 5, mu: -5, ml: 7.5, my: 67, zzz: 1, rot: 4 },
  },
  sleep: {
    color: '#9B8CFF',
    mid: { eto: 1, eti: 1, ebo: 6, ebi: 6, mw: 4, mu: -0.5, ml: 1, blush: 0.3 },
    peak: { eto: 2.5, eti: 2.5, ebo: 5.5, ebi: 5.5, mw: 3, mu: -1.4, ml: 1.8, blush: 0.4 },
  },
};

const KEYS = Object.keys(FACE_DEFS) as FaceKey[];

// Неизменные фигуры (в координатах 100×100 или вокруг своей точки 0,0)
export const FACE_PATHS = {
  flameOuter:
    'M50 78 C26 78 6 66 6 50 C6 38 12 30 18 20 C22 28 25 32 28 35 C28 22 36 8 47 -4 C51 10 57 18 61 26 C65 19 69 13 73 4 C84 18 94 34 94 50 C94 66 74 78 50 78 Z',
  flameInner:
    'M50 74 C32 74 16 64 16 52 C16 42 21 35 26 28 C29 34 32 38 34 42 C35 30 41 20 49 10 C52 22 57 29 61 36 C63 30 67 25 70 18 C78 30 84 42 84 53 C84 66 68 74 50 74 Z',
  fear: ['M23.54 20 A40 40 0 0 1 76.46 20 Z', 'M17.27 27 A40 40 0 0 1 82.73 27 Z', 'M13.34 34 A40 40 0 0 1 86.66 34 Z', 'M11.03 41 A40 40 0 0 1 88.97 41 Z'],
  heart:
    'M0 4.6 C-1.6 3.3 -6.6 0.3 -6.6 -2.6 C-6.6 -5.2 -4.5 -6.7 -2.7 -6.7 C-1.4 -6.7 -0.5 -6 0 -5.1 C0.5 -6 1.4 -6.7 2.7 -6.7 C4.5 -6.7 6.6 -5.2 6.6 -2.6 C6.6 0.3 1.6 3.3 0 4.6 Z',
  drop: 'M0 -4.2 C1.8 -1.8 3.2 -0.2 3.2 1.6 C3.2 3.4 1.8 4.6 0 4.6 C-1.8 4.6 -3.2 3.4 -3.2 1.6 C-3.2 -0.2 -1.8 -1.8 0 -4.2 Z',
  sparkle: 'M0 -6 C0.8 -1.4 1.4 -0.8 6 0 C1.4 0.8 0.8 1.4 0 6 C-0.8 1.4 -1.4 0.8 -6 0 C-1.4 -0.8 -0.8 -1.4 0 -6 Z',
  z: 'M-3.5 -3.5 H3.5 L-3.5 3.5 H3.5',
  angerMark: 'M-6 -2 Q-2 -2 -2 -6 M2 -6 Q2 -2 6 -2 M6 2 Q2 2 2 6 M-2 6 Q-2 2 -6 2',
} as const;

// Где стоят «украшения» вокруг лица: [x, y, масштаб]
export const FACE_SPOTS = {
  hearts: [[12, 19, 0.62], [88, 11, 0.8], [94, 45, 0.5]] as const,
  sparkles: [[11, 22, 0.9], [90, 13, 1.1], [95, 64, 0.7]] as const,
  zzz: [[79, 21, 0.7], [88, 10, 0.95], [98, -2, 1.25]] as const,
  dots: [[71, 13], [78, 13], [85, 13]] as const,
};

export const INK = '#2B2035';

export type FaceModel = {
  color: string;
  outline: string;
  glowColor: string;
  faceOp: number;
  glowOp: number;
  flameOp: number;
  flameScale: number;
  fearOp: number;
  rot: number;
  cheekL: number;
  cheekR: number;
  cheekY: number;
  blushOp: number;
  bagL: string;
  bagR: string;
  bagsOp: number;
  eyesOp: number;
  eyeL: string;
  eyeR: string;
  // Геометрия глаз для стилей чибика (после моргания): центры, полуширина, верх и высота
  geo: { cxL: number; cxR: number; ey: number; w: number; topMid: number; h: number; eto: number; eti: number };
  hl: { lx: number; rx: number; y: number; r: number; op: number };
  s2: { lx: number; rx: number; y: number; r: number; op: number };
  heartEyes: { op: number; lx: number; rx: number; y: number; scale: number };
  browL: string;
  browR: string;
  browOp: number;
  mouth: string;
  tongue: { x: number; y: number; rx: number; ry: number; op: number };
  tears: { streamL: string; streamR: string; streamOp: number; dropOp: number; lx: number; rx: number; y: number; scale: number };
  sweat: { op: number; scale: number };
  anger: { op: number; scale: number };
  steamOp: number;
  hearts: [number, number, number];
  sparkles: [number, number, number];
  zzz: [number, number, number];
  dots: [number, number, number];
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const r2 = (x: number) => Math.round(x * 100) / 100;
const pt = (x: number, y: number) => `${r2(x)} ${r2(y)}`;

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixColor(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  let out = '#';
  for (let i = 0; i < 3; i += 1) {
    const v = Math.round(A[i] + (B[i] - A[i]) * t);
    out += (v < 16 ? '0' : '') + v.toString(16);
  }
  return out;
}

export function faceParams(key: FaceKey, value: number): P {
  const def = FACE_DEFS[key] ?? FACE_DEFS.joy;
  const t = clamp01(value / 100);
  const out = { ...N };
  (Object.keys(N) as (keyof P)[]).forEach((k) => {
    const n = N[k];
    const peak = def.peak[k] ?? def.mid[k] ?? n;
    const mid = def.mid[k] ?? (n + peak) / 2;
    out[k] = t <= 0.5 ? n + (mid - n) * (t / 0.5) : mid + (peak - mid) * ((t - 0.5) / 0.5);
  });
  return out;
}

// Глаз: верхнее и нижнее веко — две кривые от внешнего уголка к внутреннему и обратно
function eyePath(cx: number, cy: number, p: P, side: -1 | 1, k: number): string {
  const w = p.ew * k;
  const xo = cx + side * w;
  const xi = cx - side * w;
  return (
    `M${pt(xo, cy)} C${pt(xo, cy + p.eto * k)} ${pt(xi, cy + p.eti * k)} ${pt(xi, cy)}` +
    ` C${pt(xi, cy + p.ebi * k)} ${pt(xo, cy + p.ebo * k)} ${pt(xo, cy)} Z`
  );
}

function browPath(cx: number, ey: number, p: P, side: -1 | 1, k: number, extra: number): string {
  const xo = cx + side * 7 * k;
  const xi = cx - side * 4.5 * k;
  const base = ey + p.by * k + extra;
  const yo = base + p.bo;
  const yi = base + p.bi;
  return `M${pt(xo, yo)} Q${pt((xo + xi) / 2, (yo + yi) / 2 + p.barch * 2)} ${pt(xi, yi)}`;
}

// Рот: верхняя и нижняя губа по две кривые; mv — волнистость (тревога)
function mouthPath(p: P, cx0: number, s: number): string {
  const cx = cx0 + p.ms * s;
  const cy = p.my;
  const w = p.mw * s;
  const v = p.mv * s;
  const t = p.mt * s;
  const Lx = cx - w;
  const Ly = cy + t;
  const Rx = cx + w;
  const Ry = cy - t;
  const Uy = cy + p.mu * s;
  const Wy = cy + p.ml * s;
  const d = w * 0.5;
  const a = w * 0.32;
  return (
    `M${pt(Lx, Ly)}` +
    ` C${pt(Lx + a, Ly + (Uy - Ly) * 0.85 + v)} ${pt(cx - d, Uy - v)} ${pt(cx, Uy)}` +
    ` C${pt(cx + d, Uy + v)} ${pt(Rx - a, Ry + (Uy - Ry) * 0.85 - v)} ${pt(Rx, Ry)}` +
    ` C${pt(Rx - a, Ry + (Wy - Ry) * 0.85 - v)} ${pt(cx + d, Wy + v)} ${pt(cx, Wy)}` +
    ` C${pt(cx - d, Wy - v)} ${pt(Lx + a, Ly + (Wy - Ly) * 0.85 + v)} ${pt(Lx, Ly)} Z`
  );
}

export type FaceOptions = {
  bare?: boolean; // без круга лица — для чибика
  eyes?: number; // масштаб глаз (у чибика 1.3)
  look?: number; // сдвиг взгляда по горизонтали
  blink?: boolean; // глаза закрыты (моргание)
};

export function faceModel(key: FaceKey, value: number, opts: FaceOptions = {}): FaceModel {
  const bare = Boolean(opts.bare);
  const k = opts.eyes ?? 1;
  const look = opts.look ?? 0;
  const def = FACE_DEFS[key] ?? FACE_DEFS.joy;
  const p = faceParams(key, value);
  if (opts.blink) {
    // Моргание: веки почти сходятся в линию
    const mid = (p.eto + p.ebo) / 2;
    p.eto = mid - 0.6;
    p.eti = mid - 0.6;
    p.ebo = mid + 0.6;
    p.ebi = mid + 0.6;
  }
  const t = clamp01(value / 100);
  const hE = clamp01((p.hEyes - 0.1) / 0.15);
  const neutral = mixColor(def.color, '#8E8AA6', 0.72);
  const color = mixColor(neutral, def.color, clamp01(t * 1.7));
  const cx0 = 50 + look;
  const edx = p.edx * (bare ? 1.1 : 1);
  const cxL = cx0 - edx;
  const cxR = cx0 + edx;
  const ey = p.ey;
  const topMid = ey + 0.375 * (p.eto + p.eti) * k;
  const botMid = ey + 0.375 * (p.ebo + p.ebi) * k;
  const h = botMid - topMid;
  const hlOp = clamp01((h - 4.5 * k) / (3.5 * k)) * (1 - hE);
  const hlR = Math.max(0, Math.min(2.3 * k, h * 0.17)) * (1 + 0.3 * p.shine);
  const ms = bare ? 0.85 : 1;
  const open = (p.ml - p.mu) * ms;
  const tgRy = Math.max(0, Math.min(3.4 * ms, open * 0.2));
  const dropY = botMid + 3 + 17 * p.tears;
  const tLx = cxL - p.ew * k * 0.7;
  const tRx = cxR + p.ew * k * 0.7;
  const bag = (cx: number) =>
    `M${pt(cx - p.ew * k * 0.9, botMid + 2.6)} Q${pt(cx, botMid + 5.2)} ${pt(cx + p.ew * k * 0.9, botMid + 2.6)}`;
  const tri = (v: number, a: number, b: number, c: number): [number, number, number] => [
    r2(clamp01((v - a) / 0.25)),
    r2(clamp01((v - b) / 0.25)),
    r2(clamp01((v - c) / 0.25)),
  ];
  return {
    color,
    outline: mixColor(color, INK, 0.38),
    glowColor: mixColor(def.color, '#FFFFFF', 0.35),
    faceOp: bare ? 0 : 1,
    glowOp: bare ? 0 : r2(clamp01(p.glow)),
    flameOp: bare ? 0 : r2(clamp01(p.flame * 2.5)),
    flameScale: r2(0.7 + 0.4 * p.flame),
    fearOp: bare ? 0 : r2(0.15 * p.fear),
    rot: r2(p.rot),
    cheekL: r2(cx0 - 25),
    cheekR: r2(cx0 + 25),
    cheekY: bare ? 62 : 61,
    blushOp: r2(clamp01(p.blush) * 0.6),
    bagL: bag(cxL),
    bagR: bag(cxR),
    bagsOp: r2(p.bags * 0.55),
    eyesOp: r2(1 - hE),
    eyeL: eyePath(cxL, ey, p, -1, k),
    eyeR: eyePath(cxR, ey, p, 1, k),
    geo: { cxL: r2(cxL), cxR: r2(cxR), ey, w: r2(p.ew * k), topMid: r2(topMid), h: r2(h), eto: r2(p.eto * k), eti: r2(p.eti * k) },
    hl: { lx: r2(cxL - p.ew * k * 0.3), rx: r2(cxR - p.ew * k * 0.3), y: r2(topMid + h * 0.3), r: r2(hlR), op: r2(hlOp) },
    s2: {
      lx: r2(cxL + p.ew * k * 0.36),
      rx: r2(cxR + p.ew * k * 0.36),
      y: r2(topMid + h * 0.68),
      r: r2(1.25 * k * p.shine),
      op: r2(hlOp * clamp01(p.shine * 1.5)),
    },
    heartEyes: { op: r2(hE), lx: r2(cxL), rx: r2(cxR), y: r2(ey + 1), scale: r2(0.95 * k * (0.7 + 0.3 * hE)) },
    browL: browPath(cxL, ey, p, -1, k, p.bl),
    browR: browPath(cxR, ey, p, 1, k, 0),
    browOp: r2(clamp01(p.bop)),
    mouth: mouthPath(p, cx0, ms),
    tongue: {
      x: r2(cx0 + p.ms * ms),
      y: r2(p.my + p.ml * ms - tgRy - 0.9),
      rx: r2(p.mw * ms * 0.42),
      ry: r2(tgRy),
      op: r2(clamp01((open - 6.5) / 5)),
    },
    tears: {
      streamL: `M${pt(tLx, botMid + 1)} L${pt(tLx, dropY - 2)}`,
      streamR: `M${pt(tRx, botMid + 1)} L${pt(tRx, dropY - 2)}`,
      streamOp: r2(clamp01((p.tears - 0.35) / 0.35)),
      dropOp: r2(clamp01(p.tears / 0.25)),
      lx: r2(tLx),
      rx: r2(tRx),
      y: r2(dropY),
      scale: r2(0.8 + 0.5 * p.tears),
    },
    sweat: { op: r2(clamp01(p.sweat * 2)), scale: r2(0.9 + 0.8 * p.sweat) },
    anger: { op: r2(clamp01(p.anger * 3)), scale: r2(0.5 + 0.7 * p.anger) },
    steamOp: r2(clamp01(p.steam)),
    hearts: tri(p.hearts, 0.05, 0.35, 0.65),
    sparkles: tri(p.sparkle, 0.05, 0.35, 0.65),
    zzz: tri(p.zzz, 0.05, 0.35, 0.65),
    dots: [r2(clamp01((p.dots - 0.1) / 0.2)), r2(clamp01((p.dots - 0.4) / 0.2)), r2(clamp01((p.dots - 0.7) / 0.2))],
  };
}

export function isFaceKey(key: string): key is FaceKey {
  return (KEYS as string[]).includes(key);
}

// Лицо целиком как SVG-строка (для Android-виджета). Без анимаций и CSS.
export function faceSvg(key: FaceKey, value: number, size: number, opts: FaceOptions = {}): string {
  const f = faceModel(key, value, opts);
  const parts: string[] = [];
  const g = (open: string, body: string) => `<g ${open}>${body}</g>`;
  if (f.glowOp > 0) {
    parts.push(
      g(
        `opacity="${f.glowOp}"`,
        `<circle cx="50" cy="50" r="45.5" fill="none" stroke="${f.glowColor}" stroke-width="2.2" opacity="0.9"/>` +
          `<circle cx="50" cy="50" r="50.5" fill="none" stroke="${f.glowColor}" stroke-width="1.3" opacity="0.5"/>`,
      ),
    );
  }
  if (f.flameOp > 0) {
    parts.push(
      g(
        `opacity="${f.flameOp}" transform="translate(50 55) scale(${f.flameScale}) translate(-50 -55)"`,
        `<path d="${FACE_PATHS.flameOuter}" fill="#FF7B3A"/><path d="${FACE_PATHS.flameInner}" fill="#FFC94A"/>`,
      ),
    );
  }
  if (f.faceOp > 0) {
    parts.push(`<circle cx="50" cy="50" r="40" fill="${f.color}" stroke="${f.outline}" stroke-width="1.8"/>`);
    if (f.fearOp > 0) FACE_PATHS.fear.forEach((d) => parts.push(`<path d="${d}" fill="#4F86E0" opacity="${f.fearOp}"/>`));
    parts.push('<ellipse cx="36" cy="27" rx="11" ry="6" transform="rotate(-28 36 27)" fill="#FFFFFF" opacity="0.32"/>');
  }
  const inner: string[] = [];
  inner.push(`<ellipse cx="${f.cheekL}" cy="${f.cheekY}" rx="7.5" ry="4.4" fill="#FF4F86" opacity="${f.blushOp}"/>`);
  inner.push(`<ellipse cx="${f.cheekR}" cy="${f.cheekY}" rx="7.5" ry="4.4" fill="#FF4F86" opacity="${f.blushOp}"/>`);
  if (f.bagsOp > 0) {
    inner.push(`<path d="${f.bagL}" fill="none" stroke="#5E4A73" stroke-width="1.4" stroke-linecap="round" opacity="${f.bagsOp}"/>`);
    inner.push(`<path d="${f.bagR}" fill="none" stroke="#5E4A73" stroke-width="1.4" stroke-linecap="round" opacity="${f.bagsOp}"/>`);
  }
  if (f.eyesOp > 0) {
    inner.push(
      g(
        `opacity="${f.eyesOp}"`,
        `<path d="${f.eyeL}" fill="${INK}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
          `<path d="${f.eyeR}" fill="${INK}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
          `<circle cx="${f.hl.lx}" cy="${f.hl.y}" r="${f.hl.r}" fill="#FFFFFF" opacity="${f.hl.op}"/>` +
          `<circle cx="${f.hl.rx}" cy="${f.hl.y}" r="${f.hl.r}" fill="#FFFFFF" opacity="${f.hl.op}"/>` +
          (f.s2.op > 0
            ? `<circle cx="${f.s2.lx}" cy="${f.s2.y}" r="${f.s2.r}" fill="#FFFFFF" opacity="${f.s2.op}"/>` +
              `<circle cx="${f.s2.rx}" cy="${f.s2.y}" r="${f.s2.r}" fill="#FFFFFF" opacity="${f.s2.op}"/>`
            : ''),
      ),
    );
  }
  if (f.heartEyes.op > 0) {
    const he = (x: number) =>
      `<path d="${FACE_PATHS.heart}" transform="translate(${x} ${f.heartEyes.y}) scale(${f.heartEyes.scale})" fill="#F0325F" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round" opacity="${f.heartEyes.op}"/>`;
    inner.push(he(f.heartEyes.lx) + he(f.heartEyes.rx));
  }
  if (f.browOp > 0) {
    inner.push(`<path d="${f.browL}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" opacity="${f.browOp}"/>`);
    inner.push(`<path d="${f.browR}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" opacity="${f.browOp}"/>`);
  }
  inner.push(`<path d="${f.mouth}" fill="#7A2940" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round"/>`);
  if (f.tongue.op > 0) {
    inner.push(`<ellipse cx="${f.tongue.x}" cy="${f.tongue.y}" rx="${f.tongue.rx}" ry="${f.tongue.ry}" fill="#FF7D93" opacity="${f.tongue.op}"/>`);
  }
  if (f.tears.dropOp > 0) {
    if (f.tears.streamOp > 0) {
      inner.push(`<path d="${f.tears.streamL}" fill="none" stroke="#8ED3FF" stroke-width="3" stroke-linecap="round" opacity="${f.tears.streamOp}"/>`);
      inner.push(`<path d="${f.tears.streamR}" fill="none" stroke="#8ED3FF" stroke-width="3" stroke-linecap="round" opacity="${f.tears.streamOp}"/>`);
    }
    const drop = (x: number) =>
      `<path d="${FACE_PATHS.drop}" transform="translate(${x} ${f.tears.y}) scale(${f.tears.scale})" fill="#8ED3FF" stroke="#4F9FD6" stroke-width="0.8" opacity="${f.tears.dropOp}"/>`;
    inner.push(drop(f.tears.lx) + drop(f.tears.rx));
  }
  parts.push(g(`transform="rotate(${f.rot} 50 56)"`, inner.join('')));
  if (f.sweat.op > 0) {
    parts.push(
      `<path d="${FACE_PATHS.drop}" transform="translate(81 24) scale(${f.sweat.scale})" fill="#A8DEFF" stroke="#4F9FD6" stroke-width="0.9" opacity="${f.sweat.op}"/>`,
    );
  }
  if (f.anger.op > 0) {
    parts.push(
      `<path d="${FACE_PATHS.angerMark}" transform="translate(80 18) scale(${f.anger.scale})" fill="none" stroke="#E5364F" stroke-width="2.4" stroke-linecap="round" opacity="${f.anger.op}"/>`,
    );
  }
  if (f.steamOp > 0) {
    const puff = (x: number, dir: number) =>
      `<g transform="translate(${x} 30)" opacity="${f.steamOp}"><circle cx="0" cy="0" r="4.4" fill="#FFFFFF"/><circle cx="${-3 * dir}" cy="-5" r="3.1" fill="#FFFFFF"/><circle cx="${1.5 * dir}" cy="-9" r="2.2" fill="#FFFFFF"/></g>`;
    parts.push(puff(5, 1) + puff(95, -1));
  }
  FACE_SPOTS.hearts.forEach(([x, y, s], i) => {
    if (f.hearts[i] > 0)
      parts.push(`<path d="${FACE_PATHS.heart}" transform="translate(${x} ${y}) scale(${s})" fill="#FF4D7A" stroke="${INK}" stroke-width="1.3" opacity="${f.hearts[i]}"/>`);
  });
  FACE_SPOTS.sparkles.forEach(([x, y, s], i) => {
    if (f.sparkles[i] > 0)
      parts.push(`<path d="${FACE_PATHS.sparkle}" transform="translate(${x} ${y}) scale(${s})" fill="#FFF6C2" stroke="#E0A93A" stroke-width="0.9" opacity="${f.sparkles[i]}"/>`);
  });
  FACE_SPOTS.zzz.forEach(([x, y, s], i) => {
    if (f.zzz[i] > 0)
      parts.push(`<path d="${FACE_PATHS.z}" transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="#D4CCFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="${f.zzz[i]}"/>`);
  });
  FACE_SPOTS.dots.forEach(([x, y], i) => {
    if (f.dots[i] > 0) parts.push(`<circle cx="${x}" cy="${y}" r="2" fill="#E4E0F2" opacity="${f.dots[i]}"/>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-6 -8 112 112">${parts.join('')}</svg>`;
}
