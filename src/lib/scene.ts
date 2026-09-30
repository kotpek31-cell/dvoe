// Локация «Луг у озера»: палитры по времени суток и перевод координат сцены (390×844) в экранные.
// В 0.2 здесь появятся другие локации со сменой каждый час.

export type DayTime = 'day' | 'evening' | 'night';

export type ScenePalette = {
  sky: [string, string, string];
  starsOp: number;
  sun: { op: number; x: number; y: number; r: number; glowR: number; color: string; glow: string };
  moonOp: number;
  cloud: string;
  cloudOp: number;
  hill1: string;
  hill2: string;
  lake: string;
  lakeEdge: string;
  shimmer: string;
  refl: { color: string; x: number; rx: number; op: number };
  meadow: string;
  meadow2: string;
  trail: string;
  near: string;
  trunk: string;
  leaf1: string;
  leaf2: string;
  leaf3: string;
  bush: string;
  blanket: string;
  blanketLine: string;
  lanternOp: number;
  flowerOp: number;
};

export const PALETTES: Record<DayTime, ScenePalette> = {
  day: {
    sky: ['#6FB7F5', '#A9D8FF', '#FFE6EF'],
    starsOp: 0,
    sun: { op: 1, x: 292, y: 150, r: 34, glowR: 70, color: '#FFE38A', glow: '#FFF4C2' },
    moonOp: 0,
    cloud: '#FFFFFF',
    cloudOp: 0.95,
    hill1: '#A5DCCB',
    hill2: '#7FCBB6',
    lake: '#8FD6F0',
    lakeEdge: '#6CC3E4',
    shimmer: '#FFFFFF',
    refl: { color: '#FFF4C2', x: 292, rx: 22, op: 0.5 },
    meadow: '#8CD48B',
    meadow2: '#79C87C',
    trail: '#F4E1B8',
    near: '#63B872',
    trunk: '#8A5A44',
    leaf1: '#4FAF72',
    leaf2: '#8FDDA6',
    leaf3: '#3E9A62',
    bush: '#5CBB78',
    blanket: '#FF8FA8',
    blanketLine: '#FFFFFF',
    lanternOp: 0,
    flowerOp: 1,
  },
  evening: {
    sky: ['#2F2A6E', '#A15BA6', '#FFB48C'],
    starsOp: 0.35,
    sun: { op: 1, x: 92, y: 424, r: 48, glowR: 96, color: '#FF9466', glow: '#FFC29A' },
    moonOp: 0,
    cloud: '#FFC7D6',
    cloudOp: 0.6,
    hill1: '#7D5AA6',
    hill2: '#634C94',
    lake: '#D18BB0',
    lakeEdge: '#B574A0',
    shimmer: '#FFD9C2',
    refl: { color: '#FFC29A', x: 92, rx: 40, op: 0.8 },
    meadow: '#56817A',
    meadow2: '#4B746E',
    trail: '#CDA891',
    near: '#3D6461',
    trunk: '#5B3E45',
    leaf1: '#336E61',
    leaf2: '#5A9A82',
    leaf3: '#2B5E54',
    bush: '#3E7064',
    blanket: '#E77E97',
    blanketLine: '#FFE3EA',
    lanternOp: 0.75,
    flowerOp: 0.85,
  },
  night: {
    sky: ['#070B24', '#141C4A', '#2C3772'],
    starsOp: 1,
    sun: { op: 0, x: 0, y: 0, r: 0, glowR: 0, color: '#000000', glow: '#000000' },
    moonOp: 1,
    cloud: '#56608F',
    cloudOp: 0.35,
    hill1: '#1D2758',
    hill2: '#18214A',
    lake: '#28376F',
    lakeEdge: '#1F2C5C',
    shimmer: '#C9D6FF',
    refl: { color: '#F6F1D8', x: 300, rx: 24, op: 0.55 },
    meadow: '#1E3B49',
    meadow2: '#1B3441',
    trail: '#3A4862',
    near: '#15303B',
    trunk: '#2B2B40',
    leaf1: '#183C47',
    leaf2: '#2B5E66',
    leaf3: '#12313B',
    bush: '#1B414A',
    blanket: '#8D6BB8',
    blanketLine: '#D9CCFF',
    lanternOp: 1,
    flowerOp: 0.5,
  },
};

export function dayTimeOf(date: Date = new Date()): DayTime {
  const h = date.getHours();
  if (h >= 21 || h < 5) return 'night';
  if (h >= 17 || h < 7) return 'evening';
  return 'day';
}

export const SCENE_W = 390;
export const SCENE_H = 844;

// Сцена заполняет экран целиком и прижата к низу (как preserveAspectRatio="xMidYMax slice")
export function sceneTransform(width: number, height: number) {
  const s = Math.max(width / SCENE_W, height / SCENE_H);
  const ox = width / 2 - (SCENE_W / 2) * s;
  const oy = height - SCENE_H * s;
  return { s, x: (sx: number) => ox + sx * s, y: (sy: number) => oy + sy * s };
}

// Звёзды и цветы — всегда на одних и тех же местах
function seeded(seed: number) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

const rnd = seeded(11);
export const STARS = Array.from({ length: 26 }, () => ({ x: 8 + rnd() * 374, y: 24 + rnd() * 380, r: rnd() < 0.25 ? 1.6 : 1.05 }));

export const FLOWERS: [number, number, string, number][] = [
  [22, 578, '#FF8FB1', 16], [70, 598, '#FFD166', 13], [124, 572, '#FFFFFF', 13], [276, 580, '#C9B6FF', 16], [300, 604, '#FF8FB1', 13],
  [16, 652, '#FFFFFF', 13], [104, 664, '#FF8FB1', 16], [60, 712, '#C9B6FF', 13], [128, 726, '#FFD166', 13], [252, 726, '#FFFFFF', 16],
  [340, 716, '#FFD166', 13], [372, 628, '#FFFFFF', 13], [8, 734, '#FFD166', 16], [312, 740, '#FF8FB1', 13],
];
