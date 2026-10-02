// Партия на двух телефонах (Gaster ведёт, Соня играет, Тестик — бот): колесо → игра → пьедестал, снимки в OUT.
// node tools/e2e/room-games.mjs <pumpkin|stars|reaction|rps> [--records]
import { launch, log, openPhone, startServer, state, MENU, menuItem } from './harness.mjs';

const OUT = process.env.OUT ?? '/tmp/dvoe-shots';
import fs from 'node:fs';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const game = process.argv[2] ?? 'pumpkin';
state.games = [game, 'rps'];

const { server, port } = await startServer();
const browser = await launch();
try {
  const A = await openPhone(browser, port, '11111111-1111-4111-8111-111111111111', 'Gaster');
  await wait(1500);
  const B = await openPhone(browser, port, '22222222-2222-4222-8222-222222222222', 'Соня');
  await A.page.getByLabel(MENU).waitFor({ timeout: 30000 });
  await B.page.getByLabel(MENU).waitFor({ timeout: 30000 });
  await wait(2500);
  await A.page.screenshot({ path: `${OUT}/${game}-00-room-A.png` });
  await menuItem(A.page, 'Играть');
  const t0 = Date.now();
  const at = async (ms, label) => {
    const left = t0 + ms - Date.now();
    if (left > 0) await wait(left);
    await Promise.all([A.page.screenshot({ path: `${OUT}/${game}-${label}-A.png` }), B.page.screenshot({ path: `${OUT}/${game}-${label}-B.png` })]);
  };
  await at(1600, '01-wheel');
  await at(4900, '02-intro');
  await at(6400, '03-count');
  await at(8600, '04-play');
  console.log('play started');
  if (game === 'pumpkin') {
    // кто держит — передаёт соседу
    for (let i = 0; i < 40; i++) {
      for (const [P, me] of [[A, 'Gaster'], [B, 'Соня']]) {
        if (await P.page.getByText('Тыква у тебя!').isVisible().catch(() => false)) {
          const target = me === 'Gaster' ? 'Соня' : 'Тестик';
          await P.page.getByLabel(new RegExp(`^${target}\\.`)).first().click({ force: true }).catch((e) => console.log('click fail', String(e).slice(0, 120)));
          await wait(150);
          await Promise.all([A.page.screenshot({ path: `${OUT}/${game}-05-pass-A.png` }), B.page.screenshot({ path: `${OUT}/${game}-05-pass-B.png` })]);
        }
      }
      if (await A.page.getByText(/^Бах!/).isVisible().catch(() => false)) {
        await Promise.all([A.page.screenshot({ path: `${OUT}/${game}-06-boom-A.png` }), B.page.screenshot({ path: `${OUT}/${game}-06-boom-B.png` })]);
        await wait(1200);
        await A.page.screenshot({ path: `${OUT}/${game}-07-after-A.png` });
      }
      if (await A.page.getByText(/^Финиш!|^Время!/).isVisible().catch(() => false)) break;
      await wait(1500);
    }
  } else if (game === 'stars') {
    // бегаем по арене наугад; снимки каждые 6 с
    for (let i = 0; i < 6; i++) {
      for (let k = 0; k < 6; k++) {
        await A.page.touchscreen.tap(60 + Math.random() * 270, 560 + Math.random() * 200).catch(() => undefined);
        await B.page.touchscreen.tap(60 + Math.random() * 270, 560 + Math.random() * 200).catch(() => undefined);
        await wait(1000);
      }
      await Promise.all([A.page.screenshot({ path: `${OUT}/${game}-05-${i}-A.png` }), B.page.screenshot({ path: `${OUT}/${game}-05-${i}-B.png` })]);
    }
  } else if (game === 'reaction') {
    for (let r = 0; r < 5; r++) {
      // B жмёт рано в 2-м раунде (фальстарт); A ждёт зелёный
      if (r === 1) {
        await wait(800);
        await B.page.touchscreen.tap(200, 420);
      }
      await A.page.getByText('Жми!').waitFor({ timeout: 9000 }).catch(() => undefined);
      await A.page.screenshot({ path: `${OUT}/${game}-05-${r}-green-A.png` });
      await A.page.touchscreen.tap(200, 420);
      if (r !== 1) {
        await wait(120);
        await B.page.touchscreen.tap(200, 420);
      }
      await wait(700);
      await Promise.all([A.page.screenshot({ path: `${OUT}/${game}-06-${r}-res-A.png` }), B.page.screenshot({ path: `${OUT}/${game}-06-${r}-res-B.png` })]);
      await A.page.getByText(/Жди зелёный|Финиш/).waitFor({ timeout: 9000 }).catch(() => undefined);
    }
  } else if (game === 'rps') {
    for (let r = 0; r < 8; r++) {
      const fin = await A.page.getByText(/^Финиш!/).isVisible().catch(() => false);
      if (fin) break;
      await A.page.getByText(/^Выбирай/).waitFor({ timeout: 12000 }).catch(() => undefined);
      await wait(400);
      await A.page.getByLabel('Камень', { exact: true }).click().catch(() => undefined);
      await B.page.getByLabel(r === 0 ? 'Камень' : 'Бумага', { exact: true }).click().catch(() => undefined);
      await Promise.all([A.page.screenshot({ path: `${OUT}/${game}-05-${r}-pick-A.png` }), B.page.screenshot({ path: `${OUT}/${game}-05-${r}-pick-B.png` })]);
      await A.page.getByText(/^Камень…/).waitFor({ timeout: 8000 }).catch(() => undefined);
      await A.page.screenshot({ path: `${OUT}/${game}-06-${r}-chant-A.png` });
      await wait(2300);
      await Promise.all([A.page.screenshot({ path: `${OUT}/${game}-07-${r}-reveal-A.png` }), B.page.screenshot({ path: `${OUT}/${game}-07-${r}-reveal-B.png` })]);
      await wait(2600);
    }
  }
  if (await A.page.getByText(/^Финиш!|^Время!/).waitFor({ timeout: 90000 }).then(() => true).catch(() => false)) {
    await Promise.all([A.page.screenshot({ path: `${OUT}/${game}-08-end-A.png` }), B.page.screenshot({ path: `${OUT}/${game}-08-end-B.png` })]);
  }
  await A.page.getByText('Ещё раз').waitFor({ timeout: 40000 });
  await wait(1500);
  await Promise.all([A.page.screenshot({ path: `${OUT}/${game}-09-podium-A.png` }), B.page.screenshot({ path: `${OUT}/${game}-09-podium-B.png` })]);
  if (process.argv.includes('--records')) {
    await A.page.getByLabel('Рекорды комнаты').click();
    await wait(1200);
    await A.page.screenshot({ path: `${OUT}/${game}-10-records-A.png` });
  }
  console.log('ok', game);
} catch (e) {
  console.log('FAIL', String(e).slice(0, 400));
} finally {
  console.log(JSON.stringify(log.filter((l) => l[1] !== 'rpc' || ['room_game_start', 'room_game_finish', 'room_game_cancel'].includes(l[2])).slice(-40), null, 0));
  await browser.close();
  server.close();
}
