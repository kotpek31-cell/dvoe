// Собирает supabase/catalog.sql — стартовый каталог вещей и способностей для таблицы public.items,
// и src/lib/catalogStarter.ts — тот же каталог внутри приложения (чибики рисуются и без интернета).
// Запуск из корня репозитория: node tools/art/catalog.ts
// Рисунок вещи — слои SVG с токенами цвета ('@c', '@skin', операции через '|', см. mix в chibi.ts).
// Слои, зависящие от стороны (штанины, обувь), сохраняются отдельно: legL/legR, shoeL/shoeR.
import { writeFileSync } from 'node:fs';
import { ITEMS, CAT_ORDER } from './chibi.ts';
import './items2.ts';
import './items3.ts';

const LEG_X = { L: 47, R: 62 } as const;
const SIDED = new Set(['leg', 'shoe']);

type Row = {
  id: string;
  cat: string;
  name: string;
  source: 'free' | 'code';
  palette: string | null;
  def_color: string | null;
  sort: number;
  art: Record<string, unknown>;
  meta: Record<string, unknown>;
};

const rows: Row[] = [];
const order = [...CAT_ORDER, 'face'];
const sorted = Object.entries(ITEMS).sort(([, a], [, b]) => order.indexOf(a.cat) - order.indexOf(b.cat));
const perCat: Record<string, number> = {};

for (const [id, it] of sorted) {
  const layers: Record<string, string> = {};
  for (const [name, fn] of Object.entries(it.layers)) {
    if (!fn) continue;
    if (SIDED.has(name)) {
      for (const side of ['L', 'R'] as const) layers[name + side] = fn({ col: '@c', skin: '@skin', side, x: LEG_X[side] });
    } else {
      layers[name] = fn({ col: '@c', skin: '@skin' });
    }
  }
  const meta: Record<string, unknown> = {};
  if (it.sleeve) meta.sleeve = it.sleeve;
  if (it.sleeveColor) meta.sleeveColor = it.sleeveColor;
  if (it.cuff) meta.cuff = it.cuff;
  if (it.coversBottom) meta.coversBottom = true;
  if (it.hover) meta.hover = true;
  if (it.anim) meta.anim = it.anim;
  if (it.pivot) meta.pivot = it.pivot;
  if (it.skin) meta.skin = it.skin;
  if (it.spores) meta.spores = true;
  if (it.cat === 'eyes') meta.style = id.split('.')[1];
  perCat[it.cat] = (perCat[it.cat] ?? 0) + 10;
  rows.push({
    id,
    cat: it.cat,
    name: it.name,
    source: it.code ? 'code' : 'free',
    palette: it.palette ?? null,
    def_color: it.def ?? null,
    sort: perCat[it.cat],
    art: Object.keys(layers).length ? { layers } : {},
    meta,
  });
}

// Способности: рисунок сцены в коде приложения, здесь — правила
rows.push(
  { id: 'ability.hug', cat: 'ability', name: 'Объятия', source: 'free', palette: null, def_color: null, sort: 10, art: {}, meta: { cooldown_s: 10, scene_s: 4, push_every_s: 300 } },
  { id: 'ability.mog', cat: 'ability', name: 'Мог', source: 'code', palette: null, def_color: null, sort: 20, art: {}, meta: { cooldown_s: 600, scene_s: 7 } },
);

const q = (s: string | null) => (s === null ? 'null' : `'${s.replace(/'/g, "''")}'`);
const j = (o: unknown) => `${q(JSON.stringify(o))}::jsonb`;
const values = rows
  .map((r) => `  (${q(r.id)}, ${q(r.cat)}, ${q(r.name)}, ${q(r.source)}, ${q(r.palette)}, ${q(r.def_color)}, ${r.sort}, ${j(r.art)}, ${j(r.meta)})`)
  .join(',\n');

const sql = `-- =====================================================================
--  «Двое» — стартовый каталог вещей (0.2). ФАЙЛ СОБИРАЕТСЯ СКРИПТОМ:
--  node tools/art/catalog.ts — руками не править.
--  Применять после schema.sql. Можно запускать повторно: вещи обновятся,
--  инвентарь и надетые образы не трогаются. Кодов здесь нет и не будет.
-- =====================================================================
insert into public.items (id, cat, name, source, palette, def_color, sort, art, meta) values
${values}
on conflict (id) do update set
  cat = excluded.cat, name = excluded.name, source = excluded.source, palette = excluded.palette,
  def_color = excluded.def_color, sort = excluded.sort, art = excluded.art, meta = excluded.meta,
  updated_at = now();

select 'Каталог «Двое»: ${rows.length} вещей' as "Готово";
`;

writeFileSync(new URL('../../supabase/catalog.sql', import.meta.url), sql);
console.log('catalog.sql:', rows.length, 'items,', Math.round(sql.length / 1024), 'KB');

const starter = `// Стартовый каталог вещей внутри приложения. ФАЙЛ СОБИРАЕТСЯ СКРИПТОМ:
// node tools/art/catalog.ts — руками не править. Тот же каталог лежит в базе (supabase/catalog.sql);
// приложение берёт отсюда, пока не скачает свежий из базы.
import type { ItemRow } from './catalog';

export const STARTER_ITEMS: ItemRow[] = ${JSON.stringify(
  rows.map((r) => ({ ...r, rarity: 0 })),
  null,
  1,
)};
`;
writeFileSync(new URL('../../src/lib/catalogStarter.ts', import.meta.url), starter);
console.log('catalogStarter.ts:', Math.round(starter.length / 1024), 'KB');
