// Тело чибика 3.0: пропорции и рисунок основы (кожа: шея, руки, ноги, голова).
// Рамка прежняя — 120×170, макушка на y = 24, подошвы на y = 156,5, поэтому экраны менять не нужно.
// Что изменилось: голова меньше (масштаб HS от макушки), туловище поднялось под неё, ноги и руки длиннее —
// рост около 2,5 головы вместо 1,7.
// Вещи каталога нарисованы под старое тело и в базе НЕ меняются: при отрисовке слой вещи целиком
// переносится на новое место (T_HEAD, T_TORSO, legTransform, handShift). Так старые и будущие вещи сидят одинаково.
// Файл без импортов: его же берут макеты (tools/art, node без сборщика).

const INK = '#2B2035';
const r2 = (n: number) => Math.round(n * 100) / 100;

// ---------- голова ----------
export const HS = 0.66;
export const HEAD_TOP = 24;
export const headX = (x: number) => 60 + (x - 60) * HS;
export const headY = (y: number) => HEAD_TOP + (y - HEAD_TOP) * HS;
export const T_HEAD = `translate(${r2(60 * (1 - HS))} ${r2(HEAD_TOP * (1 - HS))}) scale(${HS})`;

// ---------- туловище (слои вещи: body, under, front, back, backFx) ----------
const TORSO = { top: 78.8, ky: 1.07, kx: 0.96 }; // шея короткая: туловище начинается сразу под подбородком
export const torsoX = (x: number) => 60 + (x - 60) * TORSO.kx;
export const torsoY = (y: number) => TORSO.top + (y - 96) * TORSO.ky;
export const T_TORSO = `translate(${r2(60 * (1 - TORSO.kx))} ${r2(TORSO.top - 96 * TORSO.ky)}) scale(${TORSO.kx} ${TORSO.ky})`;

// ---------- ноги (слои legL/legR; обувь остаётся на месте) ----------
export const LEG = { top: 107, bottom: 148, kx: 1.1, cx: { L: 52.5, R: 67.5 } } as const;
const LEG_KY = (LEG.bottom - LEG.top) / 24;
export const legTransform = (side: 'L' | 'R') =>
  `translate(${r2(LEG.cx[side] * (1 - LEG.kx))} ${r2(LEG.bottom * (1 - LEG_KY))}) scale(${LEG.kx} ${r2(LEG_KY)})`;
// Вокруг этой точки нога качается при ходьбе
export const HIP = { L: { x: LEG.cx.L, y: 113 }, R: { x: LEG.cx.R, y: 113 } } as const;

// ---------- руки ----------
export const ARM_LEN = 29; // от плеча до середины ладони (было 23)
export const SHOULDER = {
  L: { x: r2(torsoX(39)), y: r2(torsoY(103)) },
  R: { x: r2(torsoX(81)), y: r2(torsoY(103)) },
} as const;
export const HAND = {
  L: { x: SHOULDER.L.x, y: r2(SHOULDER.L.y + ARM_LEN) },
  R: { x: SHOULDER.R.x, y: r2(SHOULDER.R.y + ARM_LEN) },
} as const;
// Рука по умолчанию чуть отведена в сторону
export const armBase = (side: 'L' | 'R') => `rotate(${side === 'L' ? 16 : -16} ${SHOULDER[side].x} ${SHOULDER[side].y})`;
// Предмет в руке нарисован у старой ладони (39|81, 126) — переносим к новой
export const handShift = (side: 'L' | 'R') => `translate(${r2(HAND[side].x - (side === 'L' ? 39 : 81))} ${r2(HAND[side].y - 126)})`;

// ---------- тени ----------
export const FEET_Y = 156.5;

// ---------- рисунок основы (обычная запись каталога: заливка + обводка; стиль 3.0 накладывает artStyle.ts) ----------
const tag = (name: string, attrs: Record<string, string | number | undefined>) =>
  `<${name}${Object.entries(attrs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('')}></${name}>`;

// Шея и тень под подбородком — поверх воротника, под головой
export const neckArt =
  tag('rect', { x: 54.4, y: 70, width: 11.2, height: 13, rx: 4.6, fill: '@skin|d0.08' }) +
  tag('ellipse', { cx: 60, cy: r2(TORSO.top + 2.2), rx: 9, ry: 2.6, fill: INK, opacity: 0.16 });

// Голая нога (если «Низ» не закрывает её своей штаниной)
export const legArt = (side: 'L' | 'R') =>
  tag('rect', { x: r2(LEG.cx[side] - 6.1), y: LEG.top, width: 12.2, height: LEG.bottom - LEG.top, rx: 6, fill: '@skin', stroke: INK, 'stroke-width': 2.2 });

export type Sleeve = 'full' | 'short' | 'none';
// Рука без поворота, двумя частями: [кожа, рукав цвета '@c' и манжета, ладонь].
// Между ними рисуется предмет в руке — ладонь остаётся поверх него.
export function armArt(side: 'L' | 'R', sleeve: Sleeve, cuff: string | null): [string, string] {
  const s = SHOULDER[side];
  const x = r2(s.x - 5.4);
  const y = r2(s.y - 3);
  let arm = tag('rect', { x, y, width: 10.8, height: ARM_LEN + 3, rx: 5.4, fill: '@skin', stroke: INK, 'stroke-width': 2.2 });
  if (sleeve === 'short') arm += tag('rect', { x: r2(x - 0.2), y, width: 11.2, height: 13.5, rx: 5.2, fill: '@c', stroke: INK, 'stroke-width': 2.2 });
  if (sleeve === 'full') arm += tag('rect', { x: r2(x - 0.2), y, width: 11.2, height: ARM_LEN + 0.5, rx: 5.5, fill: '@c', stroke: INK, 'stroke-width': 2.2 });
  if (cuff && sleeve === 'full') arm += tag('rect', { x: r2(x - 0.6), y: r2(s.y + ARM_LEN - 8.5), width: 12, height: 5.6, rx: 2.6, fill: cuff, stroke: INK, 'stroke-width': 1.6 });
  const hand = tag('circle', { cx: HAND[side].x, cy: HAND[side].y, r: 5.3, fill: '@skin', stroke: INK, 'stroke-width': 2 });
  return [arm, hand];
}

// Обувь нарисована под короткую ногу. Подошва и носок остаются на месте, а всё, что выше SHOE_SPLIT
// (голенище сапога, чулок), тянется вверх вместе с ногой: старое колено (y = 124) → новое (LEG.top).
export const SHOE_SPLIT = 141;
const SHOE_KY = r2((SHOE_SPLIT - LEG.top) / (SHOE_SPLIT - 124));
export const shoeTopTransform = (side: 'L' | 'R') =>
  `translate(${r2(LEG.cx[side] * (1 - LEG.kx))} ${r2(SHOE_SPLIT * (1 - SHOE_KY))}) scale(${LEG.kx} ${SHOE_KY})`;

// Голова в прежних координатах (её слой рисуется с T_HEAD): уши и овал лица
export const headArt =
  tag('circle', { cx: 18, cy: 70, r: 6.5, fill: '@skin|d0.05', stroke: INK, 'stroke-width': 2.2 }) +
  tag('circle', { cx: 102, cy: 70, r: 6.5, fill: '@skin|d0.05', stroke: INK, 'stroke-width': 2.2 }) +
  tag('path', { d: 'M15.6 70.5 a2.6 2.6 0 0 1 3.4 -2.6 M104.4 70.5 a2.6 2.6 0 0 0 -3.4 -2.6', fill: 'none', stroke: '@skin|d0.24', 'stroke-width': 1.5, 'stroke-linecap': 'round' }) +
  tag('ellipse', { cx: 60, cy: 64, rx: 43, ry: 40, fill: '@skin', stroke: INK, 'stroke-width': 2.2 }) +
  // мягкий блик на лбу и тень у подбородка — лицо «круглое», а не плоское
  tag('ellipse', { cx: 43, cy: 42, rx: 20, ry: 12, fill: '#FFFFFF', opacity: 0.2, transform: 'rotate(-24 43 42)' }) +
  tag('path', { d: 'M22 80 C30 96 46 103 60 103.4 C74 103 90 96 98 80 C94 91 80 99 60 99.6 C40 99 26 91 22 80 Z', fill: '@skin|d0.3', opacity: 0.3 });

// Сон: подушка под головой (в координатах головы) и плед до подбородка
export const pillowArt = tag('rect', { x: 6, y: 20, width: 108, height: 74, rx: 26, fill: '#F3EEFF', stroke: INK, 'stroke-width': 2.2 });
const BLANKET = 'M10 102 C10 97 22 95 60 95 C98 95 110 97 110 102 L113 154 C113 163 107 167 99 167 L21 167 C13 167 7 163 7 154 Z';
const BLANKET_FOLD = 'M10 102 C10 97 22 95 60 95 C98 95 110 97 110 102 L110.5 113 C98 109.5 22 109.5 9.5 113 Z';
const BLANKET_MARKS = 'M30 128 l3 3 l3 -3 M60 140 l3 3 l3 -3 M84 124 l3 3 l3 -3 M44 152 l3 3 l3 -3 M88 150 l3 3 l3 -3';
// Плед нарисован под старое тело (от y = 95): тянем вверх до новой шеи и делаем уже
const BLANKET_KX = 0.78;
const BLANKET_KY = r2((167 - (headY(104) - 5)) / (167 - 95));
export const T_BLANKET = `translate(${r2(60 * (1 - BLANKET_KX))} ${r2(167 * (1 - BLANKET_KY))}) scale(${BLANKET_KX} ${BLANKET_KY})`;
export const blanketArt =
  tag('path', { d: BLANKET, fill: '#8C7BF5', stroke: INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }) +
  tag('path', { d: BLANKET_FOLD, fill: '#C3B9FF', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }) +
  tag('path', { d: BLANKET_MARKS, fill: 'none', stroke: '#E6E0FF', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });

// Сцена «Мог»: тени-скулы (в координатах головы)
export const mogArt =
  tag('path', { d: 'M21 76 C28 93 43 101 60 103.4 C77 101 92 93 99 76 C93 90 79 98.5 60 100 C41 98.5 27 90 21 76 Z', fill: INK, opacity: 0.28 }) +
  tag('path', { d: 'M25 68 C29 77 35 82 43 84 C35 80 30 75 27 67 Z M95 68 C91 77 85 82 77 84 C85 80 90 75 93 67 Z', fill: INK, opacity: 0.38 }) +
  tag('path', { d: 'M30 88 L43 98 M90 88 L77 98', fill: 'none', stroke: INK, 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.55 });
