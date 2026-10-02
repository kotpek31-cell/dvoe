// Главная после этапа фиксации 0.2: джойстик, объятия по кадрам (пропущенная сцена от партнёра), тень, кнопки поверх чибиков.
// Сначала: npx expo export --platform web --output-dir dist. Запуск: node tools/e2e/home-fix.mjs
import fs from 'node:fs';
import { launch, openPhone, startServer, state, UA, UB } from './harness.mjs';

const OUT = process.env.OUT ?? '/tmp/dvoe-shots/home-fix';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pair = { id: 'p1', invite_code: 'ABC123', location: process.env.LOC ?? 'meadow', created_at: '2026-01-01T00:00:00Z' };
let pending = [];
state.rpc = (uid, name) => {
  if (name === 'pending_casts') {
    const p = pending;
    pending = [];
    return p;
  }
  return null;
};
const rest = (p, uid) => {
  const me = { id: uid, display_name: 'Gaster', chibi: { kind: 'boy', v: 2, skin: 2, hair: { id: 'hair.messy', c: 'brown' }, hat: { id: 'hat.beanie' } }, short_id: '4GGG4H', pair_id: 'p1', timezone: 'Europe/Moscow', sleeping_since: null };
  const partner = { id: UB, display_name: 'Соня', chibi: { kind: 'girl', v: 2, hat: { id: 'hat.panama', c: 'strawberry' } }, short_id: 'SONYA1', pair_id: 'p1', timezone: 'Europe/Moscow', sleeping_since: null };
  if (p.startsWith('/rest/v1/profiles')) return [me, partner];
  if (p.startsWith('/rest/v1/pairs')) return pair;
  if (p.startsWith('/rest/v1/inventory')) return [];
  if (p.startsWith('/rest/v1/ability_casts')) return [];
  return undefined;
};

const { server, port } = await startServer();
const browser = await launch();
const errors = [];
try {
  const A = await openPhone(browser, port, UA, 'Gaster', { rest, path: '/home' });
  A.page.on('pageerror', (e) => errors.push(e.message));
  await A.page.getByLabel(/^Джойстик/).waitFor({ timeout: 30000 });
  await wait(2500);
  await A.page.screenshot({ path: `${OUT}/01-home.png` });

  // джойстик вправо и вглубь
  const box = await A.page.getByLabel(/^Джойстик/).boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const cdp = await A.page.context().newCDPSession(A.page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', cx, cy);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', cx + i * 5, cy - i * 2);
    await wait(30);
  }
  await wait(900);
  await A.page.screenshot({ path: `${OUT}/02-stick.png` });
  await touch('touchEnd', cx + 40, cy - 16);
  await wait(600);

  // объятия от Сони: сцена по кадрам
  pending = [{ id: 'c1', pair_id: 'p1', from_user: UB, to_user: UA, ability: 'ability.hug', blocked: false, created_at: new Date().toISOString(), seen_at: null }];
  await A.page.goto(`http://localhost:${port}/home`);
  await A.page.getByLabel(/^Джойстик|смотреть/i).first().waitFor({ timeout: 30000 }).catch(() => undefined);
  const watch = A.page.getByLabel(/Смотреть$/);
  if (await watch.count()) await watch.first().click();
  const t0 = Date.now();
  for (const at of [500, 900, 1300, 2000, 2700, 3700, 4300]) {
    const left = at - (Date.now() - t0);
    if (left > 0) await wait(left);
    await A.page.screenshot({ path: `${OUT}/hug-${String(at).padStart(4, '0')}.png` });
  }
} finally {
  console.log('ошибки:', errors.length ? errors.join('\n') : 'нет');
  await browser.close();
  server.close();
}
