import asyncio, sys
from playwright.async_api import async_playwright
async def main(src, out, w, h, full):
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': w, 'height': h})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto('file://' + src); await pg.wait_for_timeout(int(sys.argv[6]) if len(sys.argv) > 6 else 300)
        await pg.screenshot(path=out, full_page=full); await b.close()
        if errs: print('ERRORS', errs[:5])
asyncio.run(main(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5] == '1'))
