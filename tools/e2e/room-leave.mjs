// Уход посреди игры: игрок ушёл — выбыл, вернулся — смотрит; ведущий ушёл — игра прервана у всех.
// node tools/e2e/room-leave.mjs
import fs from 'node:fs';
import { launch, log, openPhone, startServer, state } from './harness.mjs';

const OUT = process.env.OUT ?? '/tmp/dvoe-shots';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
state.games = ['reaction'];
const UA = '11111111-1111-4111-8111-111111111111';
const UB = '22222222-2222-4222-8222-222222222222';

const { server, port } = await startServer();
const browser = await launch();
try {
  const A = await openPhone(browser, port, UA, 'Gaster');
  await wait(1500);
  const B = await openPhone(browser, port, UB, 'Соня');
  await A.page.getByText('Играть').waitFor({ timeout: 30000 });
  await B.page.getByText('Играть').waitFor({ timeout: 30000 });
  await wait(2000);
  await A.page.getByLabel('Играть').click();
  await A.page.getByText(/Реакция · раунд 1/).waitFor({ timeout: 15000 });
  console.log('play');
  await wait(1500);
  // Соня закрыла приложение посреди игры
  await B.ctx.close();
  await wait(4000);
  await A.page.screenshot({ path: `${OUT}/01-B-left-A.png` });
  const outTag = await A.page.getByText('вне игры').count();
  console.log('вне игры у ведущего:', outTag);
  // Соня вернулась — видит игру, но уже не играет
  const B2 = await openPhone(browser, port, UB, 'Соня');
  await B2.page.getByText(/Реакция · раунд/).waitFor({ timeout: 20000 }).then(() => console.log('B2 видит игру')).catch(() => console.log('B2 НЕ видит игру'));
  await wait(800);
  await B2.page.screenshot({ path: `${OUT}/02-B-back-B.png` });
  const watch = await B2.page.getByText('Смотришь').count();
  console.log('B2 смотрит:', watch);
  // ведущий закрыл приложение
  await A.ctx.close();
  const t = Date.now();
  await B2.page.getByText(/ушёл — игра прервана/).waitFor({ timeout: 15000 }).then(() => console.log('прервана через', Date.now() - t, 'мс')).catch(() => console.log('НЕ прервана'));
  await B2.page.screenshot({ path: `${OUT}/03-host-left-B.png` });
  await wait(2500);
  await B2.page.screenshot({ path: `${OUT}/04-after-B.png` });
  const bar = await B2.page.getByLabel('Играть').count();
  console.log('кнопка «Играть» снова есть:', bar);
} catch (e) {
  console.log('FAIL', String(e).slice(0, 400));
} finally {
  console.log(JSON.stringify(log.filter((l) => l[1] === 'pageerror' || (l[1] === 'rpc' && /game/.test(l[2])))));
  await browser.close();
  server.close();
}
