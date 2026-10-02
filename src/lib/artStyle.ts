// Стиль 3.0 для рисунков каталога: вместо жёсткой тёмной обводки — тонкий контур в тон вещи,
// а плоская заливка получает мягкий объём (свет сверху-слева, тень снизу-справа).
// Рисунки в базе и в catalogStarter.ts НЕ меняются: стиль накладывается при отрисовке,
// поэтому новые вещи (и рисунки из гардероба будущих версий) выглядят так же без перерисовки.
// Файл без React, без react-native и без импортов — его же берут макеты (tools/art, node без сборщика)
// и автопроверки, поэтому обводка и смешение цветов здесь — копии из face.ts.
const INK = '#2B2035';

function mixColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const va = (pa >> shift) & 255;
    const vb = (pb >> shift) & 255;
    return Math.round(va + (vb - va) * t)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

export type ArtNode = { tag: string; attrs: Record<string, string>; children: ArtNode[] };

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

// ---------- размер фигуры (чтобы не красить объёмом мелочь вроде пуговиц) ----------
const ARITY: Record<string, number> = { m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, a: 7, z: 0 };
const TOKEN = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;

export function pathSize(d: string): [number, number] {
  let x = 0;
  let y = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (px: number, py: number) => {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  };
  let cmd = '';
  let buf: number[] = [];
  const eat = () => {
    const c = cmd.toLowerCase();
    const rel = cmd === c;
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    if (c === 'h') x = ox + buf[0];
    else if (c === 'v') y = oy + buf[0];
    else if (c === 'a') {
      x = ox + buf[5];
      y = oy + buf[6];
    } else {
      for (let i = 0; i + 1 < buf.length; i += 2) add(ox + buf[i], oy + buf[i + 1]);
      x = ox + buf[buf.length - 2];
      y = oy + buf[buf.length - 1];
    }
    add(x, y);
    buf = [];
  };
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(d))) {
    if (m[1]) {
      cmd = m[1];
      buf = [];
    } else if (cmd) {
      buf.push(parseFloat(m[2]));
      const n = ARITY[cmd.toLowerCase()];
      if (n && buf.length === n) eat();
    }
  }
  return minX === Infinity ? [0, 0] : [maxX - minX, maxY - minY];
}

function sizeOf(node: ArtNode): [number, number] {
  const n = (k: string) => parseFloat(node.attrs[k] ?? '0') || 0;
  if (node.tag === 'path') return pathSize(node.attrs.d ?? '');
  if (node.tag === 'rect') return [n('width'), n('height')];
  if (node.tag === 'circle') return [n('r') * 2, n('r') * 2];
  if (node.tag === 'ellipse') return [n('rx') * 2, n('ry') * 2];
  return [0, 0];
}

// ---------- цвета: обычные (#RRGGBB) и токены каталога ('@c', '@skin' с операциями) ----------
const HEX = /^#[0-9a-fA-F]{6}$/;
const isInk = (v: string | undefined) => typeof v === 'string' && v.toUpperCase() === INK.toUpperCase();
const r2 = (n: number) => Math.round(n * 100) / 100;

function darker(color: string, t: number): string | null {
  if (color.startsWith('@')) return `${color}|d${t}`;
  return HEX.test(color) ? mixColor(color, INK, t) : null;
}
function lighter(color: string, t: number): string | null {
  if (color.startsWith('@')) return `${color}|l${t}`;
  return HEX.test(color) ? mixColor(color, '#FFFFFF', t) : null;
}

// Где рисуется слой: тело — в полный размер; голова уменьшена (см. body.ts), поэтому её линии тоньше не делаем
export type Zone = 'body' | 'head';
const STROKE: Record<Zone, number> = { body: 0.62, head: 0.94 };
// Линии без заливки (шнурки, ниточка шарика): чуть мягче чёрного
const SOFT_INK = '#473A5C';
const AREA = new Set(['path', 'rect', 'circle', 'ellipse']);
const KEEP = new Set(['defs', 'clippath', 'lineargradient', 'radialgradient', 'stop', 'mask', 'image']);

// Стиль 3.0 поверх рисунка слоя. Один и тот же вход даёт один и тот же выход (id градиентов по порядку).
export function restyle(nodes: ArtNode[], zone: Zone): ArtNode[] {
  const clipped = new Set<string>(); // фигуры, у которых уже есть свой объём (vol в tools/art/chibi.ts)
  const scan = (list: ArtNode[], inClip: boolean) =>
    list.forEach((n) => {
      if (inClip && n.attrs.d) clipped.add(n.attrs.d);
      scan(n.children, inClip || n.tag === 'clippath');
    });
  scan(nodes, false);

  const grads = new Map<string, string>();
  const defs: ArtNode[] = [];
  const gradient = (fill: string): string | null => {
    const had = grads.get(fill);
    if (had) return had;
    const hi = lighter(fill, 0.2);
    const lo = darker(fill, 0.17);
    if (!hi || !lo) return null;
    const id = `sv${grads.size}`;
    grads.set(fill, id);
    const stop = (offset: string, color: string): ArtNode => ({ tag: 'stop', attrs: { offset, 'stop-color': color }, children: [] });
    defs.push({ tag: 'lineargradient', attrs: { id, x1: '0.12', y1: '0', x2: '0.88', y2: '1' }, children: [stop('0', hi), stop('0.5', fill), stop('1', lo)] });
    return id;
  };

  const walk = (node: ArtNode): ArtNode => {
    if (KEEP.has(node.tag)) return node;
    const attrs = { ...node.attrs };
    const fill = attrs.fill;
    const solid = Boolean(fill) && fill !== 'none' && !fill.startsWith('url(');
    if (isInk(attrs.stroke)) {
      const w = parseFloat(attrs['stroke-width'] ?? '1') || 1;
      const tint = solid ? darker(fill, 0.42) : null;
      attrs.stroke = tint ?? SOFT_INK;
      attrs['stroke-width'] = String(r2(w * (tint ? STROKE[zone] : Math.max(STROKE[zone], 0.82))));
    }
    if (solid && AREA.has(node.tag) && !(attrs.d && clipped.has(attrs.d)) && parseFloat(attrs.opacity ?? '1') > 0.35) {
      const [w, h] = sizeOf(node);
      if (w >= 7 && h >= 7) {
        const id = gradient(fill);
        if (id) attrs.fill = `url(#${id})`;
      }
    }
    return { tag: node.tag, attrs, children: node.children.map(walk) };
  };

  const out = nodes.map(walk);
  return defs.length ? [{ tag: 'defs', attrs: {}, children: defs }, ...out] : out;
}

// Обратно в строку (для макетов и автопроверок)
const TAG_NAME: Record<string, string> = { lineargradient: 'linearGradient', radialgradient: 'radialGradient', clippath: 'clipPath' };
export function serializeArt(nodes: ArtNode[]): string {
  return nodes
    .map((n) => {
      const tag = TAG_NAME[n.tag] ?? n.tag;
      const attrs = Object.entries(n.attrs)
        .map(([k, v]) => ` ${k}="${String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`)
        .join('');
      return `<${tag}${attrs}>${serializeArt(n.children)}</${tag}>`;
    })
    .join('');
}

const cache = new Map<string, ArtNode[]>();

// Разобранный слой в стиле 3.0 (одна и та же строка разбирается один раз)
export function styledNodes(src: string | undefined, zone: Zone): ArtNode[] {
  if (!src) return [];
  const key = zone + src;
  let nodes = cache.get(key);
  if (!nodes) {
    nodes = restyle(parseArt(src), zone);
    if (cache.size > 500) cache.clear();
    cache.set(key, nodes);
  }
  return nodes;
}

export const styledArt = (src: string, zone: Zone) => serializeArt(restyle(parseArt(src), zone));
