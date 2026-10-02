// Грибы, шляпа грибника, отражённый «Мог», подсказка в пещере, порядок грибов в комнате разработчиков.
// Сначала: npx expo export --platform web --output-dir dist. Запуск: node tools/e2e/mushrooms.mjs
import fs from 'node:fs';
import { launch, log, openPhone, startServer, state, UA, UB, MENU, menuItem } from './harness.mjs';

const OUT = process.env.OUT ?? '/tmp/dvoe-shots/mush';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const pair = { id: 'p1', invite_code: 'ABC123', location: 'forest', created_at: '2026-01-01T00:00:00Z' };
let inventory = [];
const tries = [];
let answer = { ok: false, error: 'wrong', left: 3, message: 'Не тот порядок' };
state.rpc = (uid, name, body) => {
  if (name === 'mushroom_try') {
    tries.push(body.p_seq);
    return answer;
  }
  if (name === 'mushroom_hint') return ['purple', 'red', 'red', 'white', 'blue'];
  if (name === 'dev_mushrooms_set') return false;
  if (name === 'dev_set_mushrooms') {
    tries.push(['dev', ...body.p_seq]);
    return true;
  }
  if (name === 'pending_casts') return [];
  return null;
};
const rest = (p, uid) => {
  const me = { id: uid, display_name: 'Gaster', chibi: { kind: 'boy', v: 2, skin: 2, hair: { id: 'hair.messy', c: 'brown' } }, short_id: '4GGG4H', pair_id: 'p1', timezone: 'Europe/Moscow', sleeping_since: null };
  const partner = { id: UB, display_name: 'Соня', chibi: { kind: 'girl', v: 2, hat: { id: 'hat.mushroom' } }, short_id: 'SONYA1', pair_id: 'p1', timezone: 'Europe/Moscow', sleeping_since: null };
  if (p.startsWith('/rest/v1/profiles')) return [me, partner];
  if (p.startsWith('/rest/v1/pairs')) return pair;
  if (p.startsWith('/rest/v1/inventory')) return inventory;
  return undefined;
};

async function tap(page, label) {
  const el = page.getByLabel(label).first();
  const box = await el.boundingBox();
  if (!box) throw new Error(`нет на экране: ${label}`);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}
async function basketCount(page) {
  const l = await page.getByLabel(/^Корзинка/).first().getAttribute('aria-label');
  if (!l || l.includes('пусто')) return 0;
  return l.split(':')[1].split(',').length;
}
async function pick(page, color) {
  const before = await basketCount(page);
  await tap(page, `Гриб, ${color}. Нажми — сорвать`);
  for (let i = 0; i < 70; i++) {
    await wait(200);
    if ((await basketCount(page)) > before) return true;
  }
  return false;
}

const { server, port } = await startServer();
const browser = await launch();
try {
  // ---------- главная, лес, день ----------
  const A = await openPhone(browser, port, UA, 'Gaster', { rest, path: '/home' });
  const page = A.page;
  await page.getByLabel(/^Корзинка/).waitFor({ timeout: 30000 });
  await wait(2500);
  await page.screenshot({ path: `${OUT}/01-home-forest.png` });

  // срываем красный: идёт, присаживается, «чпок»
  await tap(page, 'Гриб, красный. Нажми — сорвать');
  for (let i = 0; i < 80; i++) {
    await wait(150);
    if (await page.getByText('чпок').count()) break;
  }
  await page.screenshot({ path: `${OUT}/02-pluck.png` });
  await wait(900);
  await page.screenshot({ path: `${OUT}/03-basket-1.png` });
  console.log('в корзинке:', await basketCount(page));

  // ещё 4 — неверный порядок
  for (const c of ['синий', 'жёлтый', 'белый']) console.log(c, await pick(page, c));
  await wait(2200);
  await tap(page, 'Гриб, фиолетовый. Нажми — сорвать');
  for (let i = 0; i < 90; i++) {
    await wait(150);
    if (await page.getByText(/Не тот порядок/).count()) break;
  }
  await wait(250);
  await page.screenshot({ path: `${OUT}/04-wrong.png` });
  console.log('попытка:', JSON.stringify(tries.at(-1)));
  await wait(2500);
  console.log('после неверного в корзинке:', await basketCount(page));

  // высыпать корзинку
  await pick(page, 'красный');
  await tap(page, /^Корзинка: /);
  await wait(300);
  console.log('высыпали, в корзинке:', await basketCount(page));

  // верный порядок — шляпа
  answer = { ok: true, item_id: 'hat.mushroom' };
  for (const c of ['красный', 'жёлтый', 'фиолетовый', 'синий']) {
    await wait(2100);
    console.log(c, await pick(page, c));
  }
  await wait(2100);
  await tap(page, 'Гриб, белый. Нажми — сорвать');
  await page.getByText('Шляпа грибника').first().waitFor({ timeout: 20000 });
  await wait(700);
  await page.screenshot({ path: `${OUT}/05-hat-falling.png` });
  await wait(2200);
  await page.screenshot({ path: `${OUT}/06-hat-card.png` });
  await page.getByText('Позже').click();
  await wait(500);

  // ---------- отражённый «Мог» (вхолостую из комнаты разработчиков) ----------
  await page.goto(`http://localhost:${port}/dev`);
  await page.getByText('Тест').first().click().catch(() => undefined);
  await page.getByText('Мог в шляпу грибника').waitFor({ timeout: 20000 });
  await page.screenshot({ path: `${OUT}/07-dev.png`, fullPage: true });
  await page.getByText('Порядок грибов').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/08-dev-order.png` });
  await page.getByText('Мог в шляпу грибника').click();
  const t0 = Date.now();
  const at = async (ms, name) => {
    await wait(Math.max(0, ms - (Date.now() - t0)));
    await page.screenshot({ path: `${OUT}/${name}.png` });
  };
  await at(2800, '09-mog-start');
  await at(4500, '10-mog-dome');
  await at(5200, '11-mog-sneeze');
  await at(6400, '12-mog-fallen');
  await wait(2500);

  // «Шляпа: получение» — вхолостую
  await page.goto(`http://localhost:${port}/dev`);
  await page.getByText('Тест').first().click().catch(() => undefined);
  await page.getByText('Шляпа: получение').click();
  await wait(2700);
  await page.screenshot({ path: `${OUT}/13-hat-dry.png` });
  await A.ctx.close();

  // ---------- ночь: грибы светятся, споры у шляпы, подсказка в пещере ----------
  inventory = [{ item_id: 'hat.mushroom', granted_at: '2026-10-02T00:00:00Z' }];
  const N = await openPhone(browser, port, UA, 'Gaster', {
    rest: (p, uid) => {
      if (p.startsWith('/rest/v1/profiles')) {
        const r = rest(p, uid);
        r[0] = { ...r[0], chibi: { ...r[0].chibi, hat: { id: 'hat.mushroom' } } };
        return r;
      }
      return rest(p, uid);
    },
    path: '/home',
    timezoneId: 'Europe/Moscow',
  });
  await N.page.clock.install({ time: new Date('2026-10-02T20:30:00Z') }); // 23:30 по Москве, часы идут
  await N.page.reload();
  await N.page.getByLabel(/^Корзинка/).waitFor({ timeout: 30000 });
  await wait(2500);
  await N.page.screenshot({ path: `${OUT}/14-night-forest.png` });
  pair.location = 'cave';
  await N.page.reload();
  await wait(4000);
  for (let i = 0; i < 6; i++) {
    await N.page.screenshot({ path: `${OUT}/15-cave-${i}.png` });
    await wait(880);
  }
  await N.ctx.close();

  // ---------- комната в лесу ----------
  pair.location = 'forest';
  answer = { ok: false, error: 'limit', left: 0, message: 'На сегодня попытки кончились — приходи завтра' };
  inventory = [];
  const R = await openPhone(browser, port, UA, 'Gaster', { rest: (p, uid) => (p.startsWith('/rest/v1/inventory') ? inventory : undefined) });
  await R.page.getByLabel(MENU).waitFor({ timeout: 30000 });
  await wait(2500);
  await R.page.screenshot({ path: `${OUT}/16-room-forest.png` });
  const visible = [];
  for (const c of ['красный', 'синий', 'жёлтый', 'фиолетовый', 'белый']) {
    const box = await R.page.getByLabel(`Гриб, ${c}. Нажми — сорвать`).boundingBox();
    if (box && box.x > 0 && box.x < 390) visible.push(c);
  }
  console.log('в комнате видно:', visible.join(', '));
  await tap(R.page, `Гриб, ${visible[0]}. Нажми — сорвать`);
  for (let i = 0; i < 40; i++) {
    await wait(150);
    if (await R.page.getByText('чпок').count()) break;
  }
  await R.page.screenshot({ path: `${OUT}/17-room-pluck.png` });
  await wait(1000);
  console.log('комната, в корзинке:', await basketCount(R.page));
  await R.ctx.close();
} catch (e) {
  console.log('FAIL', String(e).slice(0, 500));
} finally {
  console.log(JSON.stringify(log.filter((l) => l[1] === 'pageerror' || l[1] === 'console').slice(0, 12)));
  await browser.close();
  server.close();
}
