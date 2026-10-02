// Стенд комнаты для облачной сессии: сайт из dist, подмена Supabase (REST + RPC) и realtime-ретранслятор
// между «телефонами» (вкладками Playwright): broadcast (двоичный, kind 3 → 4) и presence ходят между ними как в настоящем канале.
// Сначала: npx expo export --platform web --output-dir dist. Запуск: node tools/e2e/room-games.mjs <pumpkin|stars|reaction|rps>
// Playwright — глобальный из облачной сессии (PLAYWRIGHT_PATH, по умолчанию /opt/node22/lib/node_modules/playwright).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(path.join(process.env.PLAYWRIGHT_PATH ?? '/opt/node22/lib/node_modules/playwright', 'index.mjs'));
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist');
const MIME = { '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.json': 'application/json', '.ico': 'image/x-icon' };

export const UA = '11111111-1111-4111-8111-111111111111';
export const UB = '22222222-2222-4222-8222-222222222222';
export const MA = 'aaaaaaaa-0000-4000-8000-00000000000a';
export const MB = 'bbbbbbbb-0000-4000-8000-00000000000b';
export const MC = 'cccccccc-0000-4000-8000-00000000000c';

export const log = [];
export function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      let f = path.join(DIST, p);
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] ?? 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    server.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (uid) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: uid, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 86400, iat: Math.floor(Date.now() / 1000) })}.sig`;
const user = (uid, email) => ({ id: uid, aud: 'authenticated', role: 'authenticated', email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' });

export const state = {
  location: 'forest',
  games: ['pumpkin'], // очередь игр, которые «выберет сервер»
  finish: null, // ответ room_game_finish
  started: 0,
  records: null,
};

const member = (id, uid, name, role, title, chibi, x, y, extra = {}) => ({
  id, user_id: uid, bot: false, bot_owner: null, name, role, title, chibi, x, y,
  seen_at: new Date().toISOString(), joined_at: new Date(Date.now() - 60000 + x * 1000).toISOString(), ...extra,
});
export function members() {
  return [
    member(MA, UA, 'Gaster', 'owner', 'владелец', { kind: 'boy', v: 2, skin: 2, hair: { id: 'hair.messy', c: 'brown' } }, 0.42, 0.55),
    member(MB, UB, 'Соня', 'guest', 'друг', { kind: 'girl' }, 0.5, 0.4),
    member(MC, null, 'Тестик', 'bot', 'бот', { kind: 'nb' }, 0.56, 0.7, { bot: true, bot_owner: UA }),
  ];
}

function roomState(uid) {
  return {
    room: { id: 'dev', name: 'Комната', kind: 'dev', capacity: 3, location: state.location, world_w: 3, world_d: 1.5 },
    members: members(),
    me: uid === UA ? MA : MB,
    level: uid === UA ? 'owner' : 'guest',
  };
}

function rpc(uid, name, body) {
  switch (name) {
    case 'my_access':
      return uid === UA ? { role: 'owner', title: 'владелец' } : { role: 'guest', title: 'друг' };
    case 'room_enter':
      return { ok: true, ...roomState(uid) };
    case 'room_state':
      return roomState(uid);
    case 'room_pending_casts':
      return [];
    case 'room_game_start': {
      const game = state.games.shift() ?? 'rps';
      state.started = Date.now();
      const all = members();
      const players = (body.p_players ?? []).map((m) => ({ m, u: all.find((x) => x.id === m)?.user_id ?? null }));
      return { ok: true, id: `game-${Date.now()}`, game, seed: 1000 + Math.floor(Math.random() * 100000), players };
    }
    case 'room_game_finish': {
      const places = body.p_result?.places ?? [];
      const best = body.p_result?.best ?? {};
      log.push(['finish', Date.now() - state.started, places, best]);
      if (state.finish) return state.finish(places, best);
      const win = places[0];
      const winU = members().find((m) => m.id === win)?.user_id;
      return {
        ok: true, counted: true, winner: win,
        records: Object.entries(best).slice(0, 1).map(([m, v]) => ({ user_id: members().find((x) => x.id === m)?.user_id, member: m, best: v })),
        rewards: winU ? [{ user_id: winU, item_id: 'hand.trophy' }] : [],
      };
    }
    case 'room_records':
      return state.records ?? {
        records: [
          { user_id: UB, name: 'Соня', game: 'stars', played: 8, wins: 6, best: 11 },
          { user_id: UA, name: 'Gaster', game: 'stars', played: 9, wins: 4, best: 9 },
          { user_id: UA, name: 'Gaster', game: 'reaction', played: 5, wins: 3, best: 238 },
          { user_id: UB, name: 'Соня', game: 'reaction', played: 5, wins: 2, best: 251 },
          { user_id: UA, name: 'Gaster', game: 'pumpkin', played: 4, wins: 1, best: null },
        ],
        my_wins: uid === UA ? 8 : 8,
      };
    default:
      return state.rpc ? state.rpc(uid, name, body) ?? null : null; // свои ответы сценария (грибы и т. п.)
  }
}

// ---------- realtime-ретранслятор ----------
const topics = new Map(); // topic → Set(client)
let phxRef = 1;
function send(client, arr) {
  try {
    client.ws.send(JSON.stringify(arr));
  } catch {}
}
function presenceOf(topic) {
  const st = {};
  for (const c of topics.get(topic) ?? []) {
    const p = c.presence.get(topic);
    if (p && p.meta) st[p.key] = { metas: [{ phx_ref: p.ref, ...p.meta }] };
  }
  return st;
}
export const events = [];
function diff(topic, joins, leaves) {
  events.push([Date.now() % 100000, topic, 'join', Object.keys(joins).map((k) => k.slice(0, 2)).join(','), 'leave', Object.keys(leaves).map((k) => k.slice(0, 2)).join(',')]);
  for (const c of topics.get(topic) ?? []) send(c, [null, null, topic, 'presence_diff', { joins, leaves }]);
}
function enc(s) {
  return new TextEncoder().encode(s);
}
function relayBinary(from, buf) {
  const u8 = new Uint8Array(buf);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (view.getUint8(0) !== 3) return;
  const jl = view.getUint8(1), rl = view.getUint8(2), tl = view.getUint8(3), el = view.getUint8(4), ml = view.getUint8(5), encType = view.getUint8(6);
  let o = 7 + jl + rl;
  const dec = new TextDecoder();
  const topic = dec.decode(u8.slice(o, o + tl)); o += tl;
  const event = dec.decode(u8.slice(o, o + el)); o += el;
  const meta = u8.slice(o, o + ml); o += ml;
  const payload = u8.slice(o);
  const t = enc(topic), e = enc(event);
  const out = new Uint8Array(5 + t.length + e.length + meta.length + payload.length);
  out.set([4, t.length, e.length, meta.length, encType], 0);
  let k = 5;
  out.set(t, k); k += t.length;
  out.set(e, k); k += e.length;
  out.set(meta, k); k += meta.length;
  out.set(payload, k);
  for (const c of topics.get(topic) ?? []) {
    if (c === from && !c.self.get(topic)) continue;
    if (c.blocked) continue;
    try { c.ws.send(Buffer.from(out)); } catch {}
  }
  if (from.tap) {
    try { from.tap(JSON.parse(dec.decode(payload))); } catch {}
  }
}

export async function attachRealtime(ctx, name) {
  const client = { name, presence: new Map(), self: new Map(), ws: null, blocked: false, tap: null };
  await ctx.routeWebSocket(/realtime\/v1\/websocket/, (ws) => {
    client.ws = ws;
    ws.onMessage((msg) => {
      if (typeof msg !== 'string') {
        relayBinary(client, msg);
        return;
      }
      const [join_ref, ref, topic, event, payload] = JSON.parse(msg);
      if (event === 'heartbeat') return send(client, [null, ref, 'phoenix', 'phx_reply', { status: 'ok', response: {} }]);
      if (event === 'phx_join') {
        if (!topics.has(topic)) topics.set(topic, new Set());
        topics.get(topic).add(client);
        client.self.set(topic, Boolean(payload?.config?.broadcast?.self));
        const pc = (payload?.config?.postgres_changes ?? []).map((c, i) => ({ ...c, id: 1000 + i }));
        send(client, [join_ref, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: pc } }]);
        const key = payload?.config?.presence?.key;
        if (key) {
          client.presence.set(topic, { key, ref: `r${phxRef++}`, meta: null, joinRef: join_ref });
          send(client, [join_ref, null, topic, 'presence_state', presenceOf(topic)]);
        }
        return;
      }
      if (event === 'presence') {
        send(client, [join_ref, ref, topic, 'phx_reply', { status: 'ok', response: {} }]);
        const p = client.presence.get(topic);
        if (!p) return;
        if (payload.event === 'track') {
          p.meta = payload.payload;
          p.ref = `r${phxRef++}`;
          diff(topic, { [p.key]: { metas: [{ phx_ref: p.ref, ...p.meta }] } }, {});
        } else if (payload.event === 'untrack' && p.meta) {
          const old = { [p.key]: { metas: [{ phx_ref: p.ref, ...p.meta }] } };
          p.meta = null;
          diff(topic, {}, old);
        }
        return;
      }
      if (event === 'phx_leave') {
        send(client, [join_ref, ref, topic, 'phx_reply', { status: 'ok', response: {} }]);
        leaveTopic(client, topic);
        return;
      }
      if (ref) send(client, [join_ref, ref, topic, 'phx_reply', { status: 'ok', response: {} }]);
    });
    ws.onClose(() => {
      for (const t of [...topics.keys()]) leaveTopic(client, t);
    });
  });
  return client;
}
function leaveTopic(client, topic) {
  const set = topics.get(topic);
  if (!set || !set.has(client)) return;
  set.delete(client);
  const p = client.presence.get(topic);
  if (p?.meta) diff(topic, {}, { [p.key]: { metas: [{ phx_ref: p.ref, ...p.meta }] } });
  client.presence.delete(topic);
}
// Пропал из канала (ушёл в фон / закрыл) — для остальных presence leave
export function dropPresence(client) {
  for (const [topic, p] of client.presence) {
    if (p.meta) {
      const old = { [p.key]: { metas: [{ phx_ref: p.ref, ...p.meta }] } };
      p.meta = null;
      diff(topic, {}, old);
    }
  }
}

// Комната (этап фиксации 0.2): действия — в меню под кнопкой вверху справа
export const MENU = /^Меню: игры/;
export async function menuItem(page, label) {
  await page.getByLabel(MENU).click();
  await page.getByLabel(label, { exact: true }).last().click();
}

// opts: rest(path, uid) — свой ответ REST (undefined — как обычно), path — куда открыть (по умолчанию /room), прочее — в newContext
export async function openPhone(browser, port, uid, name, opts = {}) {
  const { rest, path: startPath = '/room', ...ctxOpts } = opts;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...ctxOpts });
  const session = { access_token: jwt(uid), token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: 'r-' + uid, user: user(uid, `${name}@test`) };
  await ctx.addInitScript(([s]) => {
    localStorage.setItem('sb-uvlausosjxzhytzyfduz-auth-token', s);
    localStorage.setItem('dvoe.onboarded', '1');
    // «Что нового» и подсказка на главной не мешают сценариям (ключи — src/lib/prefs.ts)
    for (const k of ['dvoe:whats-new-0.2.1', 'dvoe:whats-new-0.2.2', 'dvoe:whats-new-0.2-fix', 'dvoe:hint-nudge']) localStorage.setItem(k, '1');
  }, [JSON.stringify(session)]);
  await ctx.route(/supabase\.co\/(rest|auth|functions|storage)\//, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    if (p.startsWith('/auth/v1/user')) return route.fulfill({ json: user(uid, `${name}@test`) });
    if (p.startsWith('/auth/')) return route.fulfill({ json: session });
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      let body = {};
      try { body = req.postDataJSON() ?? {}; } catch {}
      const r = rpc(uid, fn, body);
      log.push([name, 'rpc', fn]);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r) });
    }
    if (rest) {
      const r = rest(p, uid, req);
      if (r !== undefined) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r) });
    }
    if (p.startsWith('/rest/v1/items')) return route.fulfill({ status: 400, json: { message: 'нет' } });
    if (p.startsWith('/rest/v1/profiles')) {
      const prof = { id: uid, display_name: name, chibi: uid === UA ? { kind: 'boy' } : { kind: 'girl' }, short_id: uid === UA ? '4GGG4H' : 'SONYA1', pair_id: null, timezone: 'Europe/Moscow' };
      const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
      return route.fulfill({ json: single ? prof : [prof] });
    }
    const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    return route.fulfill({ status: single ? 406 : 200, json: single ? { message: 'none' } : [] });
  });
  const rt = await attachRealtime(ctx, name);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log.push([name, 'pageerror', String(e).slice(0, 300)]));
  page.on('console', (m) => {
    if (m.type() === 'error') log.push([name, 'console', m.text().slice(0, 300)]);
  });
  page.on('requestfailed', (r) => log.push([name, 'failed', r.url().slice(0, 120)]));
  await page.goto(`http://localhost:${port}${startPath}`);
  return { ctx, page, rt };
}

export async function launch() {
  return chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
}
