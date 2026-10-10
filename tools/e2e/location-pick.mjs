// Выбор места и его появление на главной: окно места, лента, «Перейти сюда», проявление и титр.
// Сначала: npx expo export --platform web --output-dir dist. Запуск: node tools/e2e/location-pick.mjs
import fs from 'node:fs';
import { launch, openPhone, startServer, state, UA, UB } from './harness.mjs';

const OUT = process.env.OUT ?? '/tmp/dvoe-shots/location-pick';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pair = { id: 'p1', invite_code: 'ABC123', location: 'meadow', created_at: '2026-01-01T00:00:00Z' };
state.rpc = (uid, name, body) => {
  if (name === 'set_location') pair.location = body.p_location;
  if (name === 'pending_casts') return [];
  return null;
};
const rest = (p, uid) => {
  const me = { id: uid, display_name: 'Gaster', chibi: { kind: 'boy', v: 2, skin: 2, hair: { id: 'hair.messy', c: 'brown' } }, short_id: '4GGG4H', pair_id: 'p1', timezone: 'Europe/Moscow', sleeping_since: null };
  const partner = { id: UB, display_name: 'Соня', chibi: { kind: 'girl', v: 2 }, short_id: 'SONYA1', pair_id: 'p1', timezone: 'Europe/Moscow', sleeping_since: null };
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
  await A.page.getByLabel(/^Место:/).waitFor({ timeout: 30000 });
  await wait(2000);
  await A.page.getByLabel(/^Место:/).click();
  await wait(500);
  await A.page.screenshot({ path: `${OUT}/01-sheet-open.png` });
  await wait(900);
  await A.page.screenshot({ path: `${OUT}/02-sheet.png` });
  await A.page.getByRole('radio', { name: 'Пляж' }).click();
  await wait(200);
  await A.page.screenshot({ path: `${OUT}/03-switching.png` });
  await wait(700);
  await A.page.getByRole('tab', { name: 'Ночь' }).click();
  await wait(900);
  await A.page.screenshot({ path: `${OUT}/04-beach-night.png` });
  await A.page.getByLabel('Перейти сюда').click();
  for (const [i, ms] of [[5, 350], [6, 400], [7, 700], [8, 2600]]) {
    await wait(ms);
    await A.page.screenshot({ path: `${OUT}/0${i}-reveal.png` });
  }
  console.log('location now:', pair.location);
} finally {
  console.log('errors:', errors.length ? errors : 'нет');
  await browser.close();
  server.close();
}
