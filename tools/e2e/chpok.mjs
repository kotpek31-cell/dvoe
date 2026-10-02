// Повтор бага «бесконечный чпок»: сорвать гриб и смотреть, исчезает ли надпись.
import { launch, openPhone, startServer, state, UA, UB } from './harness.mjs';
const OUT = process.env.OUT ?? '/tmp/dvoe-shots/chpok';
import fs from 'node:fs';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pair = { id: 'p1', invite_code: 'ABC123', location: 'forest', created_at: '2026-01-01T00:00:00Z' };
state.rpc = (uid, name) => (name === 'mushroom_try' ? { ok: false, error: 'wrong', left: 3, message: 'Не тот порядок' } : name === 'pending_casts' ? [] : null);
const rest = (p, uid) => {
  const me = { id: uid, display_name: 'Gaster', chibi: { kind: 'boy' }, short_id: '4GGG4H', pair_id: 'p1', timezone: 'Europe/Moscow', sleeping_since: null };
  const partner = { id: UB, display_name: 'Соня', chibi: { kind: 'girl' }, short_id: 'SONYA1', pair_id: 'p1', timezone: 'Europe/Moscow', sleeping_since: null };
  if (p.startsWith('/rest/v1/profiles')) return [me, partner];
  if (p.startsWith('/rest/v1/pairs')) return pair;
  if (p.startsWith('/rest/v1/inventory')) return [];
  return undefined;
};
const { server, port } = await startServer();
const browser = await launch();
try {
  const A = await openPhone(browser, port, UA, 'Gaster', { rest, path: process.argv[2] ?? '/home' });
  const page = A.page;
  await wait(4000);
  const el = page.getByLabel('Гриб, красный. Нажми — сорвать').first();
  const box = await el.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 40; i++) {
    await wait(250);
    const n = await page.getByText('чпок').count();
    let op = null;
    if (n) op = await page.getByText('чпок').first().evaluate((e) => { let o = 1; for (let x = e; x; x = x.parentElement) o *= +getComputedStyle(x).opacity; return o.toFixed(2); });
    console.log(i, n, op);
    if (i === 12 || i === 30) await page.screenshot({ path: `${OUT}/${i}.png` });
  }
} finally {
  await browser.close();
  server.close();
}
