// Стили глаз 0.2.1 (кошачьи, звёздочки, весёлые, подмигивание, сердечки, вампирские).
// Возвращают SVG-строку в координатах лица — её рисуют и макет (tools/art), и приложение (art.tsx),
// поэтому глаза выглядят одинаково везде. Старые стили (classic, lashes…) рисует Face.tsx.
import type { FaceModel } from './face';

// Без импорта значений: файл берёт и макет (node без сборщика), поэтому фигуры — копии из face.ts
const INK = '#2B2035';
const FACE_PATHS = {
  heart: 'M0 4.6 C-1.6 3.3 -6.6 0.3 -6.6 -2.6 C-6.6 -5.2 -4.5 -6.7 -2.7 -6.7 C-1.4 -6.7 -0.5 -6 0 -5.1 C0.5 -6 1.4 -6.7 2.7 -6.7 C4.5 -6.7 6.6 -5.2 6.6 -2.6 C6.6 0.3 1.6 3.3 0 4.6 Z',
  sparkle: 'M0 -6 C0.8 -1.4 1.4 -0.8 6 0 C1.4 0.8 0.8 1.4 0 6 C-0.8 1.4 -1.4 0.8 -6 0 C-1.4 -0.8 -0.8 -1.4 0 -6 Z',
};

export const NEW_EYES = ['cat', 'star', 'happy', 'wink', 'heart', 'vamp'] as const;
export type NewEyeStyle = (typeof NEW_EYES)[number];
export const isNewEye = (s: string): s is NewEyeStyle => (NEW_EYES as readonly string[]).includes(s);

const n = (v: number) => +v.toFixed(2);
const tag = (t: string, a: Record<string, string | number>) =>
  `<${t} ${Object.entries(a)
    .map(([k, v]) => `${k}="${typeof v === 'number' ? n(v) : v}"`)
    .join(' ')}></${t}>`;

// Дуга «^» — закрытый весёлый глаз
function arc(cx: number, g: FaceModel['geo']): string {
  const w = Math.max(g.w, 5.4) + 0.8;
  const y = g.topMid + Math.max(g.h, 4) * 0.62;
  return tag('path', { d: `M${n(cx - w)} ${n(y)} Q${n(cx)} ${n(y - w * 1.45)} ${n(cx + w)} ${n(y)}`, fill: 'none', stroke: INK, 'stroke-width': 2.8, 'stroke-linecap': 'round' });
}

// color — цвет радужки (уголь = обычные тёмные глаза); gid — уникальный id для градиента
export function eyeArt(style: NewEyeStyle, f: FaceModel, color: string, gid: string): string {
  const g = f.geo;
  const open = g.h > 3;
  const ink = color.toUpperCase() === '#3A3346';
  const sides = [g.cxL, g.cxR];
  const shape = (d: string, fill: string) => tag('path', { d, fill, stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' });
  const hl = (cx: number, k = 1) => tag('circle', { cx: cx - g.w * 0.3, cy: f.hl.y, r: f.hl.r * k, fill: '#FFFFFF', opacity: f.hl.op });
  let s = '';

  if (style === 'happy') return sides.map((cx) => arc(cx, g)).join('');

  if (style === 'wink') {
    const fill = ink ? INK : color;
    s += shape(f.eyeL, fill);
    if (open && !ink) s += tag('ellipse', { cx: g.cxL, cy: g.topMid + g.h * 0.56, rx: g.w * 0.48, ry: g.h * 0.34, fill: INK });
    s += hl(g.cxL);
    s += arc(g.cxR, g);
    return s;
  }

  if (style === 'cat' || style === 'vamp') {
    const vamp = style === 'vamp';
    const iris = vamp ? `url(#${gid})` : ink ? '#9BE07A' : color;
    if (vamp) {
      s += `<defs><radialGradient id="${gid}" cx="0.5" cy="0.6" r="0.7"><stop offset="0" stop-color="#FF8A7A"></stop><stop offset="0.6" stop-color="#E5304F"></stop><stop offset="1" stop-color="#8E1430"></stop></radialGradient></defs>`;
    }
    s += shape(f.eyeL, iris) + shape(f.eyeR, iris);
    if (open) {
      for (const cx of sides) {
        s += tag('ellipse', { cx, cy: g.topMid + g.h * 0.52, rx: Math.max(1.1, g.w * 0.2), ry: g.h * 0.4, fill: INK });
        s += hl(cx, 0.8);
      }
    }
    return s;
  }

  // звёздочки и сердечки: радужка как у обычных глаз, блик — фигурой
  const fill = ink ? INK : color;
  s += shape(f.eyeL, fill) + shape(f.eyeR, fill);
  if (!open) return s;
  for (const cx of sides) {
    const cy = g.topMid + g.h * 0.48;
    if (style === 'star') {
      s += tag('path', { d: FACE_PATHS.sparkle, fill: '#FFFFFF', transform: `translate(${n(cx - g.w * 0.12)} ${n(cy - g.h * 0.08)}) scale(${n(g.w * 0.16)})`, opacity: Math.max(f.hl.op, 0.8) });
      s += tag('circle', { cx: cx + g.w * 0.42, cy: g.topMid + g.h * 0.78, r: 1.1, fill: '#FFFFFF', opacity: 0.85 });
    } else {
      s += tag('path', { d: FACE_PATHS.heart, fill: ink ? '#FF6B9A' : '#FFFFFF', stroke: INK, 'stroke-width': 0.8, transform: `translate(${n(cx)} ${n(cy + 0.4)}) scale(${n(g.w * 0.13)})` });
      s += tag('circle', { cx: cx - g.w * 0.45, cy: g.topMid + g.h * 0.24, r: 1.2, fill: '#FFFFFF', opacity: 0.9 });
    }
  }
  return s;
}
