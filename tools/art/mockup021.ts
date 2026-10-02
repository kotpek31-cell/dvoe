// Макет 0.2.1: все новые вещи на чибиках, костюмы Хэллоуина и новые локации — одна HTML-страница.
// Запуск: node tools/art/mockup021.ts <файл.html>
import { writeFileSync } from 'node:fs';
import { chibi, head, el, ITEMS, type Look, type Opts } from './chibi.ts';
import { NEW_IDS } from './items2.ts';
import { locationSvg, LOCATIONS } from '../../src/lib/locations.ts';

const out = process.argv[2] ?? 'mockup021.html';
const BASE: Look = { skin: 1, hair: { id: 'hair.fluffy' }, eyes: { id: 'eyes.classic' }, top: { id: 'top.hoodie', c: 'mint' }, bottom: { id: 'bottom.pants' }, shoes: { id: 'shoes.kedy' } };
const CAT_NAMES: Record<string, string> = {
  hair: 'Причёски', eyes: 'Глаза', hat: 'Шляпы', face: 'Лицо — новая категория', top: 'Верх', bottom: 'Низ', shoes: 'Обувь', back: 'Спина', hand: 'В руках',
};
const hovers = (look: Look) => Object.values(look).some((s) => s && typeof s === 'object' && ITEMS[(s as { id: string }).id]?.hover);
const full = (look: Look, o: Opts = {}, vb = '-34 -34 188 214') =>
  el('svg', { viewBox: vb, class: hovers(look) ? 'hov' : '' }, chibi(look, o));
const headOnly = (look: Look, o: Opts = {}) => el('svg', { viewBox: '6 10 108 100' }, head(look, o));

function lookFor(id: string): Look {
  const cat = ITEMS[id].cat;
  if (cat === 'bottom') return { ...BASE, top: { id: 'top.tee', c: 'milk' }, bottom: { id } };
  if (cat === 'shoes' && id === 'shoes.witch') return { ...BASE, top: { id: 'top.dress', c: 'coal' }, shoes: { id } };
  if (cat === 'face' && id === 'face.frank') return { ...BASE, hair: { id: 'hair.frank' }, face: { id } };
  if (cat === 'face' && id === 'face.fangs') return { ...BASE, hair: { id: 'hair.vamp' }, face: { id } };
  return { ...BASE, [cat]: { id } } as Look;
}

const card = (id: string) => {
  const it = ITEMS[id];
  const pic = it.cat === 'eyes' ? headOnly({ ...BASE, eyes: { id }, hair: { id: 'hair.bob', c: 'chocolate' } }, { emotion: 'joy', value: 25 }) : full(lookFor(id), { emotion: 'joy', value: 40 });
  const tags = [it.code ? '<b class="code">по коду</b>' : '', it.anim || it.hover ? '<b class="live">живая</b>' : '', it.skin ? '<b class="live">цвет кожи</b>' : ''].join('');
  return `<figure>${pic}<figcaption>${it.name}${tags ? `<span>${tags}</span>` : ''}</figcaption></figure>`;
};

const COSTUMES: { name: string; note: string; look: Look; o: Opts }[] = [
  {
    name: 'Тыквенный', note: 'Обычный код — получит каждый, кто введёт',
    look: { skin: 1, hair: { id: 'hair.fluffy', c: 'ginger' }, eyes: { id: 'eyes.happy' }, hat: { id: 'hat.pumpkin' }, top: { id: 'top.pumpkin' }, bottom: { id: 'bottom.pants', c: 'coal' }, shoes: { id: 'shoes.kedy', c: 'coal' }, hand: { id: 'hand.jack' } },
    o: { emotion: 'joy', value: 70 },
  },
  {
    name: 'Вампир', note: 'Эксклюзив: один на всё приложение',
    look: { skin: 1, hair: { id: 'hair.vamp' }, eyes: { id: 'eyes.vamp' }, face: { id: 'face.fangs' }, top: { id: 'top.vamp' }, bottom: { id: 'bottom.pants', c: 'coal' }, shoes: { id: 'shoes.boots' }, back: { id: 'back.vampcape' } },
    o: { emotion: 'passion', value: 45 },
  },
  {
    name: 'Ведьма', note: 'Эксклюзив: один на всё приложение',
    look: { skin: 1, hair: { id: 'hair.long', c: 'plum' }, eyes: { id: 'eyes.cat', c: 'lemon' }, hat: { id: 'hat.witch' }, top: { id: 'top.witch' }, shoes: { id: 'shoes.witch' }, hand: { id: 'hand.broom' } },
    o: { emotion: 'joy', value: 55 },
  },
  {
    name: 'Франкенштейн', note: 'Эксклюзив: один на всё приложение',
    look: { skin: 1, hair: { id: 'hair.frank' }, eyes: { id: 'eyes.classic' }, face: { id: 'face.frank' }, top: { id: 'top.frank' }, bottom: { id: 'bottom.frank' }, shoes: { id: 'shoes.frank' } },
    o: { emotion: 'calm', value: 50 },
  },
];

const costumes = COSTUMES.map(
  (c) => `<figure class="big">${full(c.look, c.o)}<figcaption>${c.name}<small>${c.note}</small></figcaption></figure>`,
).join('');

const cats = ['hair', 'eyes', 'hat', 'face', 'top', 'bottom', 'shoes', 'back', 'hand'];
const sections = cats
  .map((cat) => {
    const ids = NEW_IDS.filter((id) => ITEMS[id].cat === cat);
    const total = Object.keys(ITEMS).filter((id) => ITEMS[id].cat === cat).length;
    return `<section><h2>${CAT_NAMES[cat]} <em>+${ids.length} · всего ${total}</em></h2><div class="grid">${ids.map(card).join('')}</div></section>`;
  })
  .join('');

const NEW_LOCS = LOCATIONS.filter((l) => !['meadow', 'aurora', 'roof', 'beach'].includes(l.id));
const locs = NEW_LOCS.map(
  (l) =>
    `<section class="loc"><h3>${l.name}</h3><div class="times">${(['day', 'evening', 'night'] as const)
      .map((t) => `<figure>${el('svg', { viewBox: '0 0 390 844' }, locationSvg(l.id as never, t))}<figcaption>${{ day: 'день', evening: 'вечер', night: 'ночь' }[t]}</figcaption></figure>`)
      .join('')}</div></section>`,
).join('');

const html = `<title>Макет «Двое» 0.2.1</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&family=Unbounded:wght@600;700&display=swap" rel="stylesheet">
<style>
:root{color-scheme:dark;--bg:#0B0A14;--card:rgba(28,23,48,.74);--line:rgba(255,255,255,.13);--text:#F6F3FF;--muted:#B9B2CC;--accent:#FF6B8A;--good:#5ED3A0;--warn:#FFC266;--sleep:#9B8CFF}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--text);font-family:Nunito,system-ui,sans-serif}
body{background:radial-gradient(60vmax 40vmax at 10% 0%,rgba(255,107,138,.18),transparent 60%),radial-gradient(60vmax 40vmax at 90% 10%,rgba(155,140,255,.18),transparent 60%),var(--bg);background-attachment:fixed}
main{max-width:1100px;margin:0 auto;padding:24px 16px 64px}
h1,h2,h3{font-family:Unbounded,sans-serif;font-weight:700;margin:0}
h1{font-size:26px}h2{font-size:17px;margin:34px 0 12px}h3{font-size:15px;margin:0 0 10px}
h2 em{font-style:normal;font-family:Nunito;font-size:13px;color:var(--muted);font-weight:700;margin-left:6px}
.lead{color:var(--muted);margin:8px 0 0;line-height:1.5}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:10px}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:20px;padding:8px 6px 10px;text-align:center;overflow:hidden}
figure svg{width:100%;height:auto;display:block}
figcaption{font-weight:800;font-size:13.5px;line-height:1.25;margin-top:2px}
figcaption span{display:flex;gap:4px;justify-content:center;flex-wrap:wrap;margin-top:5px}
figcaption small{display:block;font-weight:700;font-size:12px;color:var(--muted);margin-top:4px}
b.code,b.live{font-size:11px;font-weight:800;padding:2px 7px;border-radius:99px}
b.code{background:rgba(255,107,138,.18);color:#FF9EBB}b.live{background:rgba(94,211,160,.16);color:var(--good)}
.costumes{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
figure.big{padding:12px 10px 14px;border-radius:24px}figure.big figcaption{font-family:Unbounded;font-size:15px}
.loc{margin-top:18px}.times{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.times figure{padding:0;border-radius:18px}.times figcaption{padding:6px 0 8px;font-size:12.5px;color:var(--muted)}
.note{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:14px 16px;margin-top:16px;line-height:1.5;color:var(--muted)}
.note b{color:var(--text)}
@keyframes sway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
@keyframes flicker{0%,100%{opacity:1}20%{opacity:.55}40%{opacity:.9}60%{opacity:.5}80%{opacity:.95}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
@keyframes hov{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.a-sway{animation:sway 2.6s ease-in-out infinite}.a-flicker{animation:flicker .9s linear infinite}.a-pulse{animation:pulse 2.2s ease-in-out infinite}
svg.hov{animation:hov 2.8s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.a-sway,.a-flicker,.a-pulse,svg.hov{animation:none}}
@media (max-width:520px){.grid{grid-template-columns:repeat(2,1fr)}.times{gap:5px}}
</style><main>
<h1>Двое 0.2.1 — макет</h1>
<p class="lead">Все новые вещи на чибиках, костюмы Хэллоуина и новые локации. Живые вещи в приложении двигаются так же: плащ и шарф качаются, огоньки мерцают, метла, крылья феи и ранец парят.</p>
<h2>Костюмы Хэллоуина</h2>
<div class="costumes">${costumes}</div>
${sections}
<h2>Новые локации <em>+${NEW_LOCS.length} · всего ${LOCATIONS.length}</em></h2>
<p class="lead">У каждой — день, вечер и ночь по реальному времени и своя тихая музыка фона. Живые детали (искры, снег, лепестки, дождь) в приложении движутся.</p>
${locs}
<div class="note"><b>Что проверить:</b> нравятся ли вещи и костюмы, всё ли читается в маленьком размере, какие локации поправить. Напиши номер или название и что изменить.</div>
</main>`;

writeFileSync(out, html);
console.log('ok', NEW_IDS.length, 'вещей', NEW_LOCS.length, 'локаций', (html.length / 1024).toFixed(0), 'КБ');
