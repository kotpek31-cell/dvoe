// Иконки «Ладошки» (идея 4 из макета) во всех нужных видах: node tools/art/icons.ts
// Пишет SVG в tools/art/icons/; PNG делает tools/art/icons-png.cjs (Playwright).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FACE_PATHS } from '../../src/lib/face.ts';

const INK = '#2B2035';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'icons');
mkdirSync(OUT, { recursive: true });
type A = Record<string, string | number>;
const el = (tag: string, a: A, children = '') => `<${tag} ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')}>${children}</${tag}>`;
const g = (c: string, a: A = {}) => el('g', a, c);
const svg = (body: string, size = 1024) => el('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 1024 1024', width: size, height: size }, body);

// Фон: тёмный с лёгкой авророй (розовый, сиреневый, голубой)
function background(rx: number) {
  const rg = (id: string, col: string, op: number) =>
    el('radialGradient', { id }, el('stop', { offset: 0, 'stop-color': col, 'stop-opacity': op }) + el('stop', { offset: 1, 'stop-color': col, 'stop-opacity': 0 }));
  return (
    el('defs', {}, rg('ia', '#FF6B8A', 0.45) + rg('ib', '#9B8CFF', 0.45) + rg('ic', '#8FA2FF', 0.3) + el('clipPath', { id: 'sq' }, el('rect', { x: 0, y: 0, width: 1024, height: 1024, rx }))) +
    el('rect', { x: 0, y: 0, width: 1024, height: 1024, rx, fill: '#0B0A14' }) +
    g(el('circle', { cx: 230, cy: 230, r: 560, fill: 'url(#ia)' }) + el('circle', { cx: 860, cy: 330, r: 600, fill: 'url(#ib)' }) + el('circle', { cx: 560, cy: 960, r: 520, fill: 'url(#ic)' }), { 'clip-path': 'url(#sq)' })
  );
}

// Две лапки чибиков тянутся друг к другу, между ними искорка
function hands(white = false) {
  const arm = (side: -1 | 1, sleeve: string) => {
    const rot = side === -1 ? 40 : -40;
    const x = side === -1 ? 330 : 694;
    const fill = (c: string) => (white ? '#FFFFFF' : c);
    const stroke = white ? {} : { stroke: INK, 'stroke-width': 20 };
    return g(
      el('rect', { x: -80, y: 0, width: 160, height: 560, rx: 80, fill: fill(sleeve), ...stroke }) +
        (white ? '' : el('rect', { x: -80, y: 0, width: 160, height: 70, rx: 34, fill: '#FFFFFF', opacity: 0.25 })) +
        el('circle', { cx: 0, cy: -40, r: 112, fill: fill('#FFDCC4'), ...stroke }) +
        el('ellipse', { cx: side * 74, cy: 2, rx: 38, ry: 30, fill: fill('#FFDCC4'), ...(white ? {} : { stroke: INK, 'stroke-width': 18 }), transform: `rotate(${side * 30} ${side * 74} 2)` }) +
        (white ? '' : el('ellipse', { cx: 0, cy: -48, rx: 34, ry: 24, fill: '#FF9EBB', opacity: 0.55 })),
      { transform: `translate(${x} 720) rotate(${rot})` },
    );
  };
  const spark = white
    ? g(el('path', { d: FACE_PATHS.sparkle, fill: '#FFFFFF' }), { transform: 'translate(512 470) scale(13)' })
    : el('circle', { cx: 512, cy: 520, r: 140, fill: '#FFE89A', opacity: 0.25 }) +
      g(el('path', { d: FACE_PATHS.sparkle, fill: '#FFE89A', stroke: INK, 'stroke-width': 1.4 }), { transform: 'translate(512 520) scale(13)' }) +
      g(el('path', { d: FACE_PATHS.sparkle, fill: '#FFFFFF' }), { transform: 'translate(650 370) scale(4)' });
  return arm(-1, '#8FA2FF') + arm(1, '#FF9EBB') + spark;
}

const clip = (body: string, rx = 0) => el('defs', {}, el('clipPath', { id: 'cl' }, el('rect', { x: 0, y: 0, width: 1024, height: 1024, rx }))) + g(body, { 'clip-path': 'url(#cl)' });
const scaled = (body: string, k: number, dy = 0) => g(body, { transform: `translate(${512 - 512 * k} ${512 - 512 * k + dy}) scale(${k})` });

// Иконка приложения и сайта: квадрат без скругления (iOS и лаунчеры скругляют сами)
writeFileSync(join(OUT, 'icon.svg'), svg(background(0) + clip(hands())));
// Сайт и фавикон: со своим скруглением
writeFileSync(join(OUT, 'icon-rounded.svg'), svg(background(230) + clip(hands(), 230)));
// Android, адаптивная: только передний план в безопасной зоне (фон — цвет #0B0A14 в app.json)
writeFileSync(join(OUT, 'adaptive.svg'), svg(clip(scaled(hands(), 0.7, 40))));
// Android, адаптивная: фон — та же аврора, что у иконки iPhone (без неё лаунчер красил фон почти чёрным)
writeFileSync(join(OUT, 'adaptive-bg.svg'), svg(background(0)));
// Android 13+, тематическая иконка: силуэт в безопасной зоне (лаунчер сам красит его в цвет темы)
writeFileSync(join(OUT, 'monochrome.svg'), svg(clip(scaled(hands(true), 0.62, 40))));
// Уведомления Android: белый силуэт на прозрачном
writeFileSync(join(OUT, 'notification.svg'), svg(clip(scaled(hands(true), 0.8, 20))));
console.log('ok');
