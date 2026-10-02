// Стенд: собирает страницу из настоящих компонентов приложения БЕЗ npm install и без Expo.
// Нужны только node, typescript и react/react-dom (берутся из node_modules проекта или из глобальных).
// Запуск: node tools/stand/build.cjs <страница> [папка]   — например: node tools/stand/build.cjs chibi
// Результат: <папка>/<страница>.html — открыть в браузере или снять скриншот (tools/stand/shot.py).
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const NM = [path.join(ROOT, 'node_modules'), '/opt/npm-tools/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules'];
const find = (name) => {
  for (const base of NM) if (fs.existsSync(path.join(base, name))) return path.join(base, name);
  throw new Error(`Не найден пакет ${name} (нужен node_modules проекта или глобальная установка)`);
};
const ts = require(find('typescript'));

const SHIM = path.join(__dirname, 'shims');
const ALIAS = {
  'react-native': path.join(SHIM, 'react-native.tsx'),
  'react-native-svg': path.join(SHIM, 'react-native-svg.tsx'),
  'expo-router': path.join(SHIM, 'stubs.tsx'),
  'expo-haptics': path.join(SHIM, 'stubs.tsx'),
  'expo-audio': path.join(SHIM, 'stubs.tsx'),
  'expo-clipboard': path.join(SHIM, 'stubs.tsx'),
  'expo-constants': path.join(SHIM, 'stubs.tsx'),
  'expo-device': path.join(SHIM, 'stubs.tsx'),
  'expo-notifications': path.join(SHIM, 'stubs.tsx'),
  'expo-linking': path.join(SHIM, 'stubs.tsx'),
  'expo-updates': path.join(SHIM, 'stubs.tsx'),
  'react-native-safe-area-context': path.join(SHIM, 'stubs.tsx'),
  '@react-native-async-storage/async-storage': path.join(SHIM, 'stubs.tsx'),
  '@supabase/supabase-js': path.join(SHIM, 'stubs.tsx'),
};
// Файлы приложения, которые на стенде подменяются целиком (сеть, звук, навигация)
const FILE_ALIAS = {
  [path.join(ROOT, 'src/lib/supabase.ts')]: path.join(SHIM, 'app-supabase.ts'),
  [path.join(ROOT, 'src/lib/sound.ts')]: path.join(SHIM, 'app-sound.ts'),
  [path.join(ROOT, 'src/lib/sound.web.ts')]: path.join(SHIM, 'app-sound.ts'),
  [path.join(ROOT, 'src/lib/focus.ts')]: path.join(SHIM, 'app-focus.ts'),
};
const EXT = ['', '.web.tsx', '.web.ts', '.tsx', '.ts', '.js', '.cjs', '.json', '/index.tsx', '/index.ts', '/index.js'];

function resolve(spec, from) {
  if (ALIAS[spec]) return ALIAS[spec];
  if (spec.startsWith('.') || spec.startsWith('/')) {
    const base = path.resolve(path.dirname(from), spec);
    // платформенный файл важнее обычного: sound → sound.web.ts
    const bare = base.replace(/\.(tsx?|js)$/, '');
    for (const b of [bare, base])
      for (const e of EXT) {
        const p = b + e;
        if (fs.existsSync(p) && fs.statSync(p).isFile()) return FILE_ALIAS[p] ?? p;
      }
    throw new Error(`Не найден файл ${spec} (из ${from})`);
  }
  const parts = spec.split('/');
  const pkg = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  const dir = find(pkg);
  return require.resolve(spec, { paths: [path.dirname(dir)] });
}

function bundle(entry) {
  const ids = new Map();
  const mods = [];
  const idOf = (file) => {
    if (ids.has(file)) return ids.get(file);
    const id = ids.size;
    ids.set(file, id);
    let code = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.json')) code = `module.exports = ${code};`;
    else if (/\.tsx?$/.test(file)) {
      code = ts.transpileModule(code, {
        fileName: file,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true },
      }).outputText;
    }
    const map = {};
    const re = /\brequire\(\s*(['"])([^'"]+)\1\s*\)/g;
    let m;
    const specs = new Set();
    while ((m = re.exec(code))) specs.add(m[2]);
    mods[id] = null;
    for (const s of specs) map[s] = idOf(resolve(s, file));
    mods[id] = `/* ${path.relative(ROOT, file)} */ function(module, exports, __r){ const __m=${JSON.stringify(map)}; const require=(s)=>__r(__m[s]);\n${code}\n}`;
    return id;
  };
  const eid = idOf(entry);
  return `(function(){var process={env:{NODE_ENV:'development',EXPO_PUBLIC_SUPABASE_URL:'https://stand.invalid',EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'stand'}};var global=window;var __d=[\n${mods.join(',\n')}\n];var __c={};function __r(i){if(__c[i])return __c[i].exports;var m=__c[i]={exports:{}};__d[i](m,m.exports,__r);return m.exports;}__r(${eid});})();`;
}

function build(page, outDir) {
  const entry = path.join(__dirname, 'pages', `${page}.tsx`);
  const js = bundle(entry);
  fs.mkdirSync(outDir, { recursive: true });
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Стенд «Двое» — ${page}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800&family=Unbounded:wght@600;700&display=swap">
<style>html,body,#root{margin:0;height:100%;background:#0B0A14}#root{display:flex;flex-direction:column}</style></head>
<body><div id="root"></div><script>${js.replace(/<\/script/g, '<\\/script')}</script></body></html>`;
  const out = path.join(outDir, `${page}.html`);
  fs.writeFileSync(out, html);
  return out;
}

if (require.main === module) {
  const page = process.argv[2];
  if (!page) {
    console.log('Страницы:', fs.readdirSync(path.join(__dirname, 'pages')).map((f) => f.replace(/\.tsx$/, '')).join(', '));
    process.exit(0);
  }
  const out = build(page, path.resolve(process.argv[3] ?? path.join(__dirname, 'out')));
  console.log('Готово:', out, Math.round(fs.statSync(out).size / 1024), 'КБ');
}
module.exports = { build };
