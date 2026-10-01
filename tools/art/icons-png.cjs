// SVG иконок → PNG нужных размеров (Playwright; в облачной сессии Claude он уже стоит глобально)
const path = require('path');
const fs = require('fs');
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
const dir = path.join(__dirname, 'icons');
const root = path.join(__dirname, '../..');
const jobs = [
  ['icon.svg', 'assets/icon.png', 1024, false],
  ['adaptive.svg', 'assets/adaptive-icon.png', 1024, true],
  ['icon-rounded.svg', 'assets/splash-icon.png', 512, true],
  ['notification.svg', 'assets/notification-icon.png', 96, true],
  ['icon-rounded.svg', 'assets/favicon.png', 48, true],
  ['icon.svg', 'public/icon-192.png', 192, false],
  ['icon.svg', 'public/icon-512.png', 512, false],
  ['icon.svg', 'public/apple-touch-icon.png', 180, false],
];
(async () => {
  const b = await pw.chromium.launch();
  for (const [src, out, size, transparent] of jobs) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    const svg = fs.readFileSync(path.join(dir, src), 'utf8').replace(/width="1024" height="1024"/, `width="${size}" height="${size}"`);
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await p.screenshot({ path: path.join(root, out), omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
    await p.close();
    console.log(out, size);
  }
  await b.close();
})();
