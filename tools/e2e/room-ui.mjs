// Комната после этапа фиксации 0.2: меню одной кнопкой, «Кто здесь», обзор с именами, джойстик, «инфо об игроке».
// Сначала: npx expo export --platform web --output-dir dist. Запуск: node tools/e2e/room-ui.mjs
import fs from 'node:fs';
import { launch, openPhone, startServer, state, UA, UB } from './harness.mjs';

const OUT = process.env.OUT ?? '/tmp/dvoe-shots/room-ui';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
state.location = process.env.LOC ?? 'forest';

const { server, port } = await startServer();
const browser = await launch();
const errors = [];
try {
  const A = await openPhone(browser, port, UA, 'Gaster');
  A.page.on('pageerror', (e) => errors.push(`A: ${e.message}`));
  await wait(1500);
  const B = await openPhone(browser, port, UB, 'Соня');
  B.page.on('pageerror', (e) => errors.push(`B: ${e.message}`));
  const menuLabel = /^Меню: игры/;
  await A.page.getByLabel(menuLabel).waitFor({ timeout: 30000 });
  await wait(2500);
  await A.page.screenshot({ path: `${OUT}/01-room.png` });

  // меню
  await A.page.getByLabel(menuLabel).click();
  await wait(500);
  await A.page.screenshot({ path: `${OUT}/02-menu.png` });
  await A.page.mouse.click(200, 560);
  await wait(400);

  // джойстик: ведём вправо (у Сони чибик Gaster тоже должен поехать)
  const stick = A.page.getByLabel(/^Джойстик/);
  const box = await stick.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const cdp = await A.page.context().newCDPSession(A.page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', cx, cy);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', cx + i * 5, cy - i * 1.5);
    await wait(30);
  }
  await wait(1200);
  await A.page.screenshot({ path: `${OUT}/03-stick-A.png` });
  await B.page.screenshot({ path: `${OUT}/03-stick-B.png` });
  await touch('touchEnd', cx + 40, cy);
  await wait(800);

  // инфо об игроке: нажать на чибика Сони
  const sonya = A.page.getByLabel(/^Соня\. Нажми — инфо/);
  const sb = await sonya.boundingBox();
  if (sb) {
    await A.page.touchscreen.tap(sb.x + sb.width / 2, sb.y + sb.height * 0.4);
    await wait(700);
    await A.page.screenshot({ path: `${OUT}/04-info.png` });
    await A.page.mouse.click(10, 60);
    await wait(500);
  } else console.log('Сони нет на экране');

  // кто здесь
  await A.page.getByLabel('Кто в комнате').first().click();
  await wait(700);
  await A.page.screenshot({ path: `${OUT}/05-people.png` });
  await A.page.keyboard.press('Escape');
  await A.page.mouse.click(10, 60);
  await wait(500);

  // обзор
  await A.page.getByLabel(menuLabel).click();
  await wait(300);
  await A.page.getByLabel('Обзор', { exact: true }).last().click();
  await wait(1200);
  await A.page.screenshot({ path: `${OUT}/06-overview.png` });
  // нажатие — назад к себе
  await A.page.touchscreen.tap(200, 700);
  await wait(1400);
  await A.page.screenshot({ path: `${OUT}/07-back.png` });

  // нажатие на землю — идёт (камера за ним)
  await A.page.touchscreen.tap(330, 720);
  await wait(400);
  await A.page.screenshot({ path: `${OUT}/08-walk-mid.png` });
  await wait(2000);
  await A.page.screenshot({ path: `${OUT}/09-walk-end.png` });
} finally {
  console.log('ошибки:', errors.length ? errors.join('\n') : 'нет');
  await browser.close();
  server.close();
}
