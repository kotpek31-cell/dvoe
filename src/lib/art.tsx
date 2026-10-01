// Рисунок вещи из каталога: SVG-строка → элементы react-native-svg.
// Строку разбираем один раз и запоминаем; цвета подставляем при отрисовке.
// Токены цвета: '@c' — цвет вещи, '@skin' — кожа; после '|' операции:
// d0.2 — темнее (к обводке), l0.3 — светлее (к белому), k — контраст (сердечко на свитере).
// Картинку (рисунки подруги) кладём в слой тегом <image href="https://…" x y width height/>.
import { createElement, type ReactNode } from 'react';
import {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Image as SvgImage,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Polyline,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { INK, mixColor } from './face';
import { CLOTH } from './palette';

export type ArtNode = { tag: string; attrs: Record<string, string>; children: ArtNode[] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TAGS: Record<string, any> = {
  g: G,
  path: Path,
  circle: Circle,
  ellipse: Ellipse,
  rect: Rect,
  line: Line,
  polygon: Polygon,
  polyline: Polyline,
  defs: Defs,
  lineargradient: LinearGradient,
  radialgradient: RadialGradient,
  stop: Stop,
  clippath: ClipPath,
  image: SvgImage,
};

// Разрешённые атрибуты → свойства react-native-svg
const ATTRS: Record<string, string> = {
  id: 'id',
  d: 'd',
  x: 'x',
  y: 'y',
  x1: 'x1',
  y1: 'y1',
  x2: 'x2',
  y2: 'y2',
  cx: 'cx',
  cy: 'cy',
  r: 'r',
  rx: 'rx',
  ry: 'ry',
  fx: 'fx',
  fy: 'fy',
  width: 'width',
  height: 'height',
  points: 'points',
  transform: 'transform',
  opacity: 'opacity',
  fill: 'fill',
  'fill-opacity': 'fillOpacity',
  'fill-rule': 'fillRule',
  stroke: 'stroke',
  'stroke-width': 'strokeWidth',
  'stroke-opacity': 'strokeOpacity',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'stroke-miterlimit': 'strokeMiterlimit',
  'clip-path': 'clipPath',
  'clip-rule': 'clipRule',
  offset: 'offset',
  'stop-color': 'stopColor',
  'stop-opacity': 'stopOpacity',
  gradientUnits: 'gradientUnits',
  gradientTransform: 'gradientTransform',
  href: 'href',
  'xlink:href': 'href',
  preserveAspectRatio: 'preserveAspectRatio',
};

const COLOR_PROPS = new Set(['fill', 'stroke', 'stopColor']);
const TAG_RE = /<(\/?)([a-zA-Z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
const ATTR_RE = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function decode(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function parseArt(src: string): ArtNode[] {
  const root: ArtNode = { tag: '#root', attrs: {}, children: [] };
  const stack: ArtNode[] = [root];
  const text = src.replace(/<!--[\s\S]*?-->/g, '');
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(text))) {
    const [, closing, rawTag, rawAttrs, selfClosing] = m;
    const tag = rawTag.toLowerCase();
    if (closing) {
      // закрываем ближайший такой же тег (лишние закрывающие пропускаем)
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const attrs: Record<string, string> = {};
    ATTR_RE.lastIndex = 0;
    let a: RegExpExecArray | null;
    while ((a = ATTR_RE.exec(rawAttrs))) attrs[a[1]] = decode(a[2] ?? a[3] ?? '');
    const node: ArtNode = { tag, attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
  }
  return root.children;
}

const cache = new Map<string, ArtNode[]>();

// Разобранный слой (одна и та же строка разбирается один раз)
export function artNodes(src: string | undefined): ArtNode[] {
  if (!src) return [];
  let nodes = cache.get(src);
  if (!nodes) {
    nodes = parseArt(src);
    if (cache.size > 400) cache.clear();
    cache.set(src, nodes);
  }
  return nodes;
}

export type Paint = {
  c: string; // цвет вещи
  skin: string;
  ids: string; // суффикс id градиентов: у разных чибиков и цветов — свои
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export function resolveColor(value: string, paint: Paint): string {
  if (!value.startsWith('@')) return value;
  const [base, ...ops] = value.split('|');
  let hex = base === '@c' ? paint.c : base === '@skin' ? paint.skin : '#888888';
  if (!HEX.test(hex)) return hex;
  for (const op of ops) {
    if (op === 'k') {
      hex = hex.toUpperCase() === CLOTH.cherry[1] ? CLOTH.milk[1] : CLOTH.cherry[1];
      continue;
    }
    const t = Math.min(1, Math.max(0, parseFloat(op.slice(1)) || 0));
    if (op[0] === 'd') hex = mixColor(hex, INK, t);
    else if (op[0] === 'l') hex = mixColor(hex, '#FFFFFF', t);
  }
  return hex;
}

const safeHref = (v: string) => /^https:\/\//i.test(v) || /^data:image\/(png|jpe?g|webp|gif);/i.test(v);

function propsOf(node: ArtNode, paint: Paint): Record<string, string> | null {
  const props: Record<string, string> = {};
  for (const [name, raw] of Object.entries(node.attrs)) {
    const prop = ATTRS[name];
    if (!prop) continue;
    let v = raw;
    if (prop === 'id') v = `${raw}_${paint.ids}`;
    else if (prop === 'href') {
      if (!safeHref(raw)) return null;
    } else if (v.startsWith('url(#')) v = v.replace(/^url\(#([^)]+)\)/, `url(#$1_${paint.ids})`);
    else if (COLOR_PROPS.has(prop)) v = resolveColor(v, paint);
    props[prop] = v;
  }
  return props;
}

export function renderArt(nodes: ArtNode[], paint: Paint, key = 'a'): ReactNode[] {
  const out: ReactNode[] = [];
  nodes.forEach((node, i) => {
    const Comp = TAGS[node.tag];
    if (!Comp) return;
    const props = propsOf(node, paint);
    if (!props) return;
    const k = `${key}.${i}`;
    out.push(createElement(Comp, { key: k, ...props }, ...renderArt(node.children, paint, k)));
  });
  return out;
}

// Готовая строка слоя → элементы
export function renderLayer(src: string | undefined, paint: Paint, key: string): ReactNode[] {
  return src ? renderArt(artNodes(src), paint, key) : [];
}
