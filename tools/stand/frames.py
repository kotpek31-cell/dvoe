# Стенд: несколько кадров анимации подряд (проверка движения по скриншотам).
# python3 tools/stand/frames.py <url> <префикс.png> <ширина> <высота> <мс,мс,мс>
import asyncio, sys
from playwright.async_api import async_playwright
async def main(src, out, w, h, times):
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': w, 'height': h})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(src if src.startswith('file:') else 'file://' + src)
        last = 0
        for i, t in enumerate(times):
            await pg.wait_for_timeout(t - last); last = t
            await pg.screenshot(path=out.replace('.png', f'_{i}.png'))
        await b.close()
        if errs: print('ERRORS', errs[:5])
asyncio.run(main(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), [int(x) for x in sys.argv[5].split(',')]))
