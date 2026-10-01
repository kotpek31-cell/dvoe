// Собирает все картинки макета в svg/
import { writeFileSync, mkdirSync } from 'node:fs';
import { chibi, head, el, g, line, uid, itemSvg, LOOKS, ITEMS, CLOTH, HAIR, SKIN, type Look, type Opts } from './chibi.ts';
import { meadow, aurora, roof, beach } from './scenes.ts';
import { FACE_PATHS } from '../../src/lib/face.ts';

const INK = '#2B2035';
mkdirSync('svg', { recursive: true });
const svg = (vb: string, w: number, h: number, body: string) =>
  el('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: vb, width: w, height: h }, body);
const out = (name: string, s: string) => writeFileSync(`svg/${name}.svg`, s);

// чибик в сцене: левый верхний угол (x, y), масштаб s; flip — смотрит влево
const put = (look: Look, o: Opts, x: number, y: number, s = 0.867, flip = false) =>
  g(chibi(look, o), { transform: flip ? `translate(${x + 120 * s} ${y}) scale(${-s} ${s})` : `translate(${x} ${y}) scale(${s})` });

const ME: Look = { ...LOOKS.boy, hand: { id: 'hand.cocoa' } };
const HER: Look = { ...LOOKS.girl, hand: { id: 'hand.balloon' } };

// ---------- иконки 1024 ----------
function iconBg(): [string, string] {
  const a = uid('ia'), b = uid('ib'), c = uid('ic');
  const rg = (id: string, col: string, op: number) =>
    el('radialGradient', { id }, el('stop', { offset: 0, 'stop-color': col, 'stop-opacity': op }) + el('stop', { offset: 1, 'stop-color': col, 'stop-opacity': 0 }));
  const defs = rg(a, '#FF6B8A', 0.45) + rg(b, '#9B8CFF', 0.45) + rg(c, '#8FA2FF', 0.3);
  const body =
    el('rect', { x: 0, y: 0, width: 1024, height: 1024, rx: 230, fill: '#0B0A14' }) +
    el('circle', { cx: 230, cy: 230, r: 560, fill: `url(#${a})` }) +
    el('circle', { cx: 860, cy: 330, r: 600, fill: `url(#${b})` }) +
    el('circle', { cx: 560, cy: 960, r: 520, fill: `url(#${c})` });
  return [defs, body];
}
const icon = (name: string, body: string, defs = '') => {
  const [d, bg] = iconBg();
  out(name, svg('0 0 1024 1024', 1024, 1024, el('defs', {}, d + defs) + el('clipPath', { id: 'sq' }, el('rect', { x: 0, y: 0, width: 1024, height: 1024, rx: 230 })) + g(bg + body, { 'clip-path': 'url(#sq)' })));
};
const headAt = (look: Look, o: Opts, x: number, y: number, s: number, rot = 0) =>
  g(head(look, o), { transform: `translate(${x} ${y}) scale(${s}) rotate(${rot} 60 64)` });

// 1. Две щёчки
icon(
  'icon1',
  headAt({ ...LOOKS.nb, hair: { id: 'hair.fluffy', c: 'blue' } }, { emotion: 'joy', value: 85 }, 46, 280, 4.3, 9) +
    headAt({ ...LOOKS.nb, hair: { id: 'hair.bob', c: 'pink' } }, { emotion: 'joy', value: 85 }, 458, 280, 4.3, -9) +
    el('ellipse', { cx: 512, cy: 628, rx: 70, ry: 40, fill: '#FF4F86', opacity: 0.6 }) +
    g(el('path', { d: FACE_PATHS.heart, fill: '#FF6B8A', stroke: INK, 'stroke-width': 1.2 }), { transform: 'translate(512 190) scale(9)' }),
);

// 2. Одно лицо на двоих
{
  const L = uid('cl'), R = uid('cr');
  const defs = el('clipPath', { id: L }, el('rect', { x: 0, y: 0, width: 512, height: 1024 })) + el('clipPath', { id: R }, el('rect', { x: 512, y: 0, width: 512, height: 1024 }));
  const hair = (c: string) =>
    el('path', { d: 'M182 560 C150 300 300 170 512 170 C724 170 874 300 842 560 C820 480 790 430 750 400 C700 440 620 440 570 380 C550 420 530 430 512 430 C494 430 474 420 454 380 C404 440 324 440 274 400 C234 430 204 480 182 560 Z', fill: c, stroke: INK, 'stroke-width': 18, 'stroke-linejoin': 'round' });
  const eye = (cx: number, c: string) =>
    el('ellipse', { cx, cy: 600, rx: 58, ry: 70, fill: c, stroke: INK, 'stroke-width': 18 }) +
    el('ellipse', { cx, cy: 614, rx: 30, ry: 40, fill: INK }) +
    el('circle', { cx: cx - 18, cy: 580, r: 16, fill: '#FFFFFF' }) + el('circle', { cx: cx + 16, cy: 628, r: 8, fill: '#FFFFFF' });
  icon(
    'icon2',
    el('circle', { cx: 512, cy: 560, r: 340, fill: '#FFDCC4', stroke: INK, 'stroke-width': 18 }) +
      g(hair('#8FA2FF'), { 'clip-path': `url(#${L})` }) + g(hair('#FF9EBB'), { 'clip-path': `url(#${R})` }) +
      eye(392, '#8FA2FF') + eye(632, '#FF9EBB') +
      el('ellipse', { cx: 300, cy: 720, rx: 62, ry: 34, fill: '#FF4F86', opacity: 0.4 }) + el('ellipse', { cx: 724, cy: 720, rx: 62, ry: 34, fill: '#FF4F86', opacity: 0.4 }) +
      el('path', { d: 'M462 742 Q512 790 562 742', fill: 'none', stroke: INK, 'stroke-width': 18, 'stroke-linecap': 'round' }),
    defs,
  );
}

// 3. Д с характером
icon(
  'icon3',
  el('path', {
    d: 'M392 250 H676 V632 H744 V720 H280 V632 H304 C352 556 392 430 392 250 Z M480 330 V420 C480 500 452 580 408 632 H588 V330 Z',
    fill: '#FF6B8A', stroke: INK, 'stroke-width': 22, 'stroke-linejoin': 'round', 'fill-rule': 'evenodd', transform: 'translate(0 -110)',
  }) +
    g(chibi({ ...LOOKS.nb, top: { id: 'top.hoodie', c: 'blueberry' }, hair: { id: 'hair.vikhor' } }, { pose: 'cheer', emotion: 'joy', value: 80, noShadow: true }), { transform: 'translate(212 586) scale(2.05)' }) +
    g(chibi({ ...LOOKS.girl, hat: null, top: { id: 'top.dress', c: 'lavender' } }, { pose: 'cheer', emotion: 'joy', value: 80, noShadow: true }), { transform: 'translate(566 586) scale(2.05)' }) +
    g(el('path', { d: FACE_PATHS.heart, fill: '#B39DFF', stroke: INK, 'stroke-width': 1.3 }), { transform: 'translate(534 96) scale(7)' }),
);

// 4. Ладошки
{
  const arm = (side: -1 | 1, sleeve: string) => {
    const rot = side === -1 ? 40 : -40;
    const x = side === -1 ? 330 : 694;
    return g(
      el('rect', { x: -80, y: 0, width: 160, height: 560, rx: 80, fill: sleeve, stroke: INK, 'stroke-width': 20 }) +
        el('rect', { x: -80, y: 0, width: 160, height: 70, rx: 34, fill: '#FFFFFF', opacity: 0.25 }) +
        el('circle', { cx: 0, cy: -40, r: 112, fill: '#FFDCC4', stroke: INK, 'stroke-width': 20 }) +
        el('ellipse', { cx: side * 74, cy: 2, rx: 38, ry: 30, fill: '#FFDCC4', stroke: INK, 'stroke-width': 18, transform: `rotate(${side * 30} ${side * 74} 2)` }) +
        el('ellipse', { cx: 0, cy: -48, rx: 34, ry: 24, fill: '#FF9EBB', opacity: 0.55 }),
      { transform: `translate(${x} 720) rotate(${rot})` },
    );
  };
  icon(
    'icon4',
    arm(-1, '#8FA2FF') + arm(1, '#FF9EBB') +
      el('circle', { cx: 512, cy: 520, r: 140, fill: '#FFE89A', opacity: 0.25 }) +
      g(el('path', { d: FACE_PATHS.sparkle, fill: '#FFE89A', stroke: INK, 'stroke-width': 1.4 }), { transform: 'translate(512 520) scale(13)' }) +
      g(el('path', { d: FACE_PATHS.sparkle, fill: '#FFFFFF' }), { transform: 'translate(650 370) scale(4)' }),
  );
}

// 5. Сонный и бодрый
{
  const cap =
    el('path', { d: 'M14 46 C14 18 40 4 66 6 C96 8 112 30 118 58 C122 76 128 86 136 92 C120 92 108 80 102 62 C96 52 80 44 60 44 C40 44 24 46 14 46 Z', fill: '#B39DFF', stroke: INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }) +
    el('path', { d: 'M10 50 C10 42 14 40 20 40 H100 C106 40 110 42 110 50 C110 56 106 58 100 58 H20 C14 58 10 56 10 50 Z', fill: '#F4F0FF', stroke: INK, 'stroke-width': 2.2 }) +
    el('circle', { cx: 138, cy: 94, r: 8, fill: '#F4F0FF', stroke: INK, 'stroke-width': 2.2 });
  const left = g(head({ ...LOOKS.nb, hair: { id: 'hair.fluffy', c: 'blue' } }, { emotion: 'sleep', value: 100 }) + cap, { transform: 'translate(88 330) scale(3.3) rotate(-6 60 64)' });
  const wink =
    el('ellipse', { cx: 75.7, cy: 69, rx: 8.5, ry: 8.5, fill: '#FFDCC4' }) +
    el('path', { d: 'M68.5 71 Q75.7 63.5 83 71', fill: 'none', stroke: INK, 'stroke-width': 2.6, 'stroke-linecap': 'round' });
  const right = g(head({ ...LOOKS.nb, hair: { id: 'hair.bob', c: 'pink' } }, { emotion: 'joy', value: 70 }) + wink, { transform: 'translate(522 330) scale(3.3) rotate(6 60 64)' });
  const z = (x: number, y: number, s: number) => g(el('path', { d: FACE_PATHS.z, fill: 'none', stroke: '#D4CCFF', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }), { transform: `translate(${x} ${y}) scale(${s})` });
  icon('icon5', left + right + z(200, 250, 8) + z(290, 170, 11) + g(el('path', { d: FACE_PATHS.sparkle, fill: '#FFE89A', stroke: INK, 'stroke-width': 1.2 }), { transform: 'translate(860 300) scale(6)' }));
}

// ---------- главная ----------
out('home', svg('0 0 390 844', 390, 844, meadow('day') + put(HER, { emotion: 'joy', value: 55 }, 236, 520, 0.867, true) + put(ME, { emotion: 'joy', value: 40 }, 58, 548)));

// ---------- локации ----------
const locChibis = put(ME, { emotion: 'joy', value: 40 }, 70, 548) + put(HER, { emotion: 'love', value: 50 }, 220, 528, 0.867, true);
out('loc_meadow', svg('0 0 390 844', 390, 844, meadow('day') + locChibis));
out('loc_aurora', svg('0 0 390 844', 390, 844, aurora() + put({ ...ME, hat: { id: 'hat.beanie' }, hand: null }, { emotion: 'inspiration', value: 60 }, 70, 548) + put({ ...HER, hat: { id: 'hat.beanie', c: 'lavender' }, hand: { id: 'hand.cocoa', c: 'strawberry' } }, { emotion: 'love', value: 50 }, 220, 528, 0.867, true)));
out('loc_roof', svg('0 0 390 844', 390, 844, roof() + locChibis));
out('loc_beach', svg('0 0 390 844', 390, 844, beach() + put({ ...ME, top: { id: 'top.tee', c: 'sky' }, bottom: { id: 'bottom.shorts', c: 'lemon' }, hat: { id: 'hat.panama' }, hand: null }, { emotion: 'joy', value: 70 }, 70, 548) + put({ ...HER, top: { id: 'top.tee', c: 'strawberry' }, bottom: { id: 'bottom.skirt', c: 'mint' }, hat: { id: 'hat.cap', c: 'milk' }, hand: { id: 'hand.balloon' } }, { emotion: 'joy', value: 60 }, 220, 528, 0.867, true)));

// ---------- сцена «Мог» и «Объятия» ----------
const CROP = '0 330 390 520';
const frame = (name: string, body: string) => out(name, svg(CROP, 390, 520, body));
const skull = (x: number, y: number, s: number, op = 0.92, rot = 0) =>
  g(
    el('path', { d: 'M0 -14 C-9 -14 -15 -8 -15 0 C-15 5 -12 8.5 -9 10 V15 H-4.5 V12 H-1.5 V15 H1.5 V12 H4.5 V15 H9 V10 C12 8.5 15 5 15 0 C15 -8 9 -14 0 -14 Z', fill: '#F4F0FF', stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }) +
      el('circle', { cx: -5.5, cy: 0, r: 4, fill: INK }) + el('circle', { cx: 5.5, cy: 0, r: 4, fill: INK }) + el('path', { d: 'M0 5 L-1.8 8 H1.8 Z', fill: INK }),
    { transform: `translate(${x} ${y}) rotate(${rot}) scale(${s})`, opacity: op },
  );
const bars = el('rect', { x: -10, y: 300, width: 410, height: 74, fill: '#000' }) + el('rect', { x: -10, y: 806, width: 410, height: 74, fill: '#000' });
const MOG_HERO: Look = { ...LOOKS.boy };
const dust = g([[92, 668, 10], [76, 660, 7], [64, 670, 5]].map(([x, y, r]) => el('circle', { cx: x, cy: y, r, fill: '#FFFFFF', opacity: 0.7 })).join('') + line('M40 610 h34 M30 630 h40 M44 650 h26', '#FFFFFF', 3, { opacity: 0.7 }));
frame('mog1', meadow('day', false) + dust + put(MOG_HERO, { pose: 'run', emotion: 'passion', value: 60 }, 110, 520) + put(HER, { emotion: 'anxiety', value: 40 }, 250, 520, 0.867, true));
{
  const glow = uid('mg');
  const defs = el('defs', {}, el('radialGradient', { id: glow }, el('stop', { offset: 0, 'stop-color': '#B39DFF', 'stop-opacity': 0.55 }) + el('stop', { offset: 1, 'stop-color': '#B39DFF', 'stop-opacity': 0 })));
  frame(
    'mog2',
    defs + meadow('day', false) + el('rect', { x: -10, y: 300, width: 410, height: 600, fill: '#07040F', opacity: 0.8 }) +
      el('circle', { cx: 210, cy: 600, r: 150, fill: `url(#${glow})` }) +
      skull(70, 470, 1.4, 0.9, -12) + skull(330, 450, 1.1, 0.8, 14) + skull(50, 640, 0.9, 0.6, 8) + skull(350, 610, 1.2, 0.75, -6) + skull(200, 410, 0.8, 0.5, 4) +
      put(MOG_HERO, { emotion: 'passion', value: 90, mog: true }, 160, 500, 0.95) +
      put(HER, { emotion: 'anxiety', value: 90 }, 262, 520, 0.867, true) + bars,
  );
}
{
  const fl = uid('fl');
  const defs = el('defs', {}, el('radialGradient', { id: fl }, el('stop', { offset: 0, 'stop-color': '#FFFFFF', 'stop-opacity': 1 }) + el('stop', { offset: 0.4, 'stop-color': '#FFF6C2', 'stop-opacity': 0.8 }) + el('stop', { offset: 1, 'stop-color': '#FFF6C2', 'stop-opacity': 0 })));
  const burst = 'M0 -60 L14 -18 L58 -30 L24 2 L54 36 L10 22 L0 66 L-10 22 L-54 36 L-24 2 L-58 -30 L-14 -18 Z';
  frame(
    'mog3',
    defs + meadow('day', false) + el('rect', { x: -10, y: 300, width: 410, height: 600, fill: '#07040F', opacity: 0.55 }) +
      put(MOG_HERO, { pose: 'run', emotion: 'passion', value: 90, mog: true }, 150, 505, 0.95) +
      g(chibi(HER, { emotion: 'anxiety', value: 100 }), { transform: 'translate(372 512) scale(-0.867 0.867) rotate(-28 60 160)' }) +
      el('circle', { cx: 262, cy: 600, r: 120, fill: `url(#${fl})` }) +
      el('path', { d: burst, fill: '#FFF6C2', stroke: INK, 'stroke-width': 2.4, 'stroke-linejoin': 'round', transform: 'translate(262 596)' }) +
      line('M300 520 l26 -18 M316 560 l34 -6 M310 640 l30 14 M220 520 l-12 -24', '#FFFFFF', 3.4) + bars,
  );
}
{
  const star = (x: number, y: number, s: number) => g(el('path', { d: 'M0 -6 L1.8 -1.8 L6 -1.6 L2.8 1.2 L3.8 5.6 L0 3.2 L-3.8 5.6 L-2.8 1.2 L-6 -1.6 L-1.8 -1.8 Z', fill: '#FFD966', stroke: INK, 'stroke-width': 1 }), { transform: `translate(${x} ${y}) scale(${s})` });
  const fx = 236, fy = 556, fs = 0.867;
  const hx = fx + 15 * fs, hy = fy + 66 * fs;
  frame(
    'mog4',
    meadow('day', false) + el('rect', { x: -10, y: 300, width: 410, height: 600, fill: '#07040F', opacity: 0.35 }) +
      put(MOG_HERO, { emotion: 'calm', value: 70, mog: true }, 110, 505, 0.95) +
      put(HER, { pose: 'fallen', emotion: 'sadness', value: 30, eyesClosed: true }, fx, fy, fs) +
      el('ellipse', { cx: hx, cy: hy - 26, rx: 26, ry: 7, fill: 'none', stroke: '#FFD966', 'stroke-width': 1.6, opacity: 0.8 }) +
      star(hx - 24, hy - 26, 1.3) + star(hx + 6, hy - 33, 1.1) + star(hx + 26, hy - 22, 1.2) + bars,
  );
}
{
  const pg = uid('pg');
  const defs = el('defs', {}, el('radialGradient', { id: pg }, el('stop', { offset: 0, 'stop-color': '#FF8FB3', 'stop-opacity': 0.6 }) + el('stop', { offset: 1, 'stop-color': '#FF8FB3', 'stop-opacity': 0 })));
  const heart = (x: number, y: number, s: number, op = 1) => el('path', { d: FACE_PATHS.heart, fill: '#FF4D7A', stroke: INK, 'stroke-width': 1.3 / s * 1.6, transform: `translate(${x} ${y}) scale(${s})`, opacity: op });
  frame(
    'hug',
    defs + meadow('day', false) + el('circle', { cx: 195, cy: 600, r: 190, fill: `url(#${pg})` }) +
      put(ME, { pose: 'hug', emotion: 'love', value: 80 }, 118, 520) + put({ ...HER, hand: null }, { pose: 'hug', emotion: 'love', value: 80 }, 176, 520, 0.867, true) +
      heart(150, 480, 1.8) + heart(240, 460, 2.4) + heart(290, 520, 1.5, 0.8) + heart(110, 540, 1.3, 0.8) + heart(200, 420, 1.4, 0.7),
  );
}

// ---------- профиль, гардероб ----------
out('profile_chibi', svg('-22 -16 164 196', 164, 196, chibi(ME, { emotion: 'joy', value: 45 })));
out('wardrobe_chibi', svg('-22 -16 164 196', 164, 196, chibi({ ...ME, hat: { id: 'hat.cap', c: 'cherry' }, hand: null }, { emotion: 'joy', value: 70, pose: 'wave' })));
['hat.beanie', 'hat.cap', 'hat.panama', 'hat.bow', 'hat.beret', 'hat.halo'].forEach((id) => out(`tile_${id.split('.')[1]}`, itemSvg(id, id === 'hat.cap' ? 'cherry' : undefined, 96)));

// ---------- все вещи: полоски по категориям ----------
const BASE: Look = { skin: 1, hair: { id: 'hair.fluffy' }, eyes: { id: 'eyes.classic' }, top: { id: 'top.hoodie', c: 'mint' }, bottom: { id: 'bottom.pants' }, shoes: { id: 'shoes.kedy' } };
const CELL = 130;
const strip = (name: string, cells: { look: Look; o?: Opts; headOnly?: boolean }[]) => {
  const body = cells
    .map((c, i) =>
      c.headOnly
        ? el('svg', { x: i * CELL, y: 0, width: CELL, height: 160, viewBox: '2 6 116 104' }, head(c.look, c.o))
        : el('svg', { x: i * CELL, y: 0, width: CELL, height: 160, viewBox: '-22 -16 164 196' }, chibi(c.look, c.o)),
    )
    .join('');
  out(name, svg(`0 0 ${cells.length * CELL} 160`, cells.length * CELL, 160, body));
};
const of = (cat: string) => Object.keys(ITEMS).filter((id) => ITEMS[id].cat === cat);
strip('row_hair', of('hair').map((id) => ({ look: { ...BASE, hair: { id } }, o: { emotion: 'joy' as const, value: 40 } })));
strip('row_eyes', of('eyes').map((id) => ({ look: { ...BASE, eyes: { id, c: id === 'eyes.classic' ? 'coal' : undefined }, hair: { id: 'hair.bob', c: 'chocolate' } }, o: { emotion: 'joy' as const, value: 25 }, headOnly: true })));
strip('row_hat', of('hat').map((id) => ({ look: { ...BASE, hat: { id } } })));
strip('row_face', of('face').map((id) => ({ look: { ...BASE, face: { id } }, o: { emotion: 'passion' as const, value: 60 } })));
strip('row_top', of('top').map((id) => ({ look: { ...BASE, top: { id } } })));
strip('row_bottom', of('bottom').map((id) => ({ look: { ...BASE, top: { id: 'top.tee', c: 'milk' }, bottom: { id } } })));
strip('row_shoes', of('shoes').map((id) => ({ look: { ...BASE, shoes: { id } } })));
strip('row_back', of('back').map((id) => ({ look: { ...BASE, back: { id } } })));
strip('row_hand', of('hand').map((id) => ({ look: { ...BASE, hand: { id } } })));
strip('row_skin', SKIN.map((_, i) => ({ look: { ...BASE, skin: i } })));
strip('row_base', [{ look: LOOKS.boy }, { look: LOOKS.girl }, { look: LOOKS.nb }]);

// ---------- «Что нового» и награда ----------
out('news', svg('0 0 340 260', 340, 260,
  g(chibi({ ...ME, hat: { id: 'hat.beret' }, hand: { id: 'hand.brush' }, top: { id: 'top.apron' } }, { emotion: 'joy', value: 80 }), { transform: 'translate(40 20) scale(1.25)' }) +
  g(chibi({ ...HER, hat: { id: 'hat.halo' }, back: { id: 'back.wings' }, hand: null }, { emotion: 'love', value: 60 }), { transform: 'translate(300 34) scale(-1.15 1.15)' }) +
  g(el('path', { d: FACE_PATHS.sparkle, fill: '#FFE89A' }), { transform: 'translate(176 40) scale(1.6)' }) +
  g(el('path', { d: FACE_PATHS.sparkle, fill: '#FFFFFF' }), { transform: 'translate(160 92) scale(0.9)' })));
const ARTIST: Look = { skin: 1, hair: { id: 'hair.bob' }, eyes: { id: 'eyes.azure' }, hat: { id: 'hat.beret' }, top: { id: 'top.blackdress' }, shoes: { id: 'shoes.boots' }, hand: { id: 'hand.brush' } };
const ANGEL: Look = { skin: 1, hair: { id: 'hair.long', c: 'blond' }, eyes: { id: 'eyes.sparkle', c: 'sky' }, hat: { id: 'hat.halo' }, top: { id: 'top.dress', c: 'milk' }, shoes: { id: 'shoes.kedy' }, back: { id: 'back.wings' } };
const BANDIT: Look = { skin: 1, hair: { id: 'hair.vikhor' }, eyes: { id: 'eyes.classic' }, face: { id: 'face.bandana' }, top: { id: 'top.hoodie', c: 'coal' }, bottom: { id: 'bottom.pants', c: 'blueberry' }, shoes: { id: 'shoes.boots' }, hand: { id: 'hand.uzi' } };
const big = (look: Look, o: Opts) => svg('-24 -30 168 212', 336, 424, chibi(look, o));
out('reward', big(ARTIST, { emotion: 'joy', value: 30 }));
out('set_artist', big(ARTIST, { emotion: 'joy', value: 30 }));
out('set_angel', big(ANGEL, { emotion: 'joy', value: 35 }));
out('set_bandit', big(BANDIT, { emotion: 'passion', value: 55 }));
out('set_mog', big({ ...LOOKS.boy }, { emotion: 'passion', value: 85, mog: true }));
console.log('ok', Object.keys(ITEMS).length, 'items', Object.keys(CLOTH).length, Object.keys(HAIR).length);
