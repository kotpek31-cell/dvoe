// Supabase Edge Function «push» — веб-уведомления для iPhone (сайт «Двое» на экране «Домой»).
//
//   GET  → { publicKey }  — публичный VAPID-ключ, сайт подписывается с ним на уведомления.
//   POST → от базы данных (notify_partner в schema.sql): { title, body, data, subscriptions: [{ endpoint, p256dh, auth }] }
//          с заголовком x-push-secret. Сообщение шифруется по RFC 8291 (aes128gcm) и подписывается VAPID (RFC 8292).
//
// Настраивать ничего не нужно: ключи VAPID и секрет лежат в базе (private.app_config). Функция читает их
// ключом сервера, который Supabase сам передаёт каждой функции, а при первом запуске сама создаёт ключи VAPID.
// Нужно только одно: при развёртывании ВЫКЛЮЧИТЬ проверку JWT («Verify JWT»), иначе база и сайт получат 401.
// (Для своего сервера можно задать секреты VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SECRET и VAPID_SUBJECT —
//  тогда база не читается; PUSH_SECRET должен совпадать с private.app_config.push_secret.)

const enc = new TextEncoder();

export function b64urlDecode(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => {
    s += String.fromCharCode(b);
  });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

// Шифрование сообщения для одного получателя (RFC 8291). Для тестов можно передать свои ключи и соль.
export async function encryptPayload(
  payload: Uint8Array,
  p256dh: string,
  auth: string,
  test?: { salt: Uint8Array; asPrivate: string; asPublic: string },
): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(p256dh);
  const authSecret = b64urlDecode(auth);
  let asPrivateKey: CryptoKey;
  let asPublic: Uint8Array;
  if (test) {
    asPublic = b64urlDecode(test.asPublic);
    asPrivateKey = await crypto.subtle.importKey(
      'jwk',
      {
        kty: 'EC',
        crv: 'P-256',
        d: test.asPrivate,
        x: b64urlEncode(asPublic.slice(1, 33)),
        y: b64urlEncode(asPublic.slice(33, 65)),
        ext: true,
      },
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits'],
    );
  } else {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
    asPrivateKey = pair.privateKey;
    asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  }
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPrivateKey, 256));
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const salt = test ? test.salt : crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const record = concat(payload, new Uint8Array([2])); // 0x02 — последняя (и единственная) запись
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, record));
  const header = new Uint8Array(21 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

// Подпись VAPID (JWT ES256) для сервиса push, которому принадлежит endpoint
export async function vapidHeader(endpoint: string, publicKey: string, privateKey: string, subject: string): Promise<string> {
  const pub = b64urlDecode(publicKey);
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: privateKey, x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)), ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64urlEncode(
    enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })),
  );
  const unsigned = `${header}.${claims}`;
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned)));
  return `vapid t=${unsigned}.${b64urlEncode(signature)}, k=${publicKey}`;
}

type Subscription = { endpoint: string; p256dh: string; auth: string };
type Env = { get(name: string): string | undefined };
type Config = { publicKey: string; privateKey: string; subject: string; secret: string };
type ConfigRow = { vapid_public: string | null; vapid_private: string | null; vapid_subject: string | null; push_secret: string };

// Только настоящие сервисы push (Apple, Google, Mozilla, Microsoft) — чтобы функцию нельзя было натравить на чужой адрес
export const PUSH_ENDPOINT = /^https:\/\/(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)\//;

const DEFAULT_SUBJECT = 'https://kotpek31-cell.github.io/dvoe/';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-push-secret, authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

// Ключ сервера: новые ключи (sb_secret_…) — в SUPABASE_SECRET_KEYS (JSON), старые — в SUPABASE_SERVICE_ROLE_KEY
export function serverKey(env: Env): string | null {
  const keys = env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    try {
      const parsed = JSON.parse(keys) as Record<string, string>;
      const key = parsed.default ?? Object.values(parsed)[0];
      if (typeof key === 'string' && key) return key;
    } catch {
      // не JSON — пробуем старый ключ
    }
  }
  return env.get('SUPABASE_SERVICE_ROLE_KEY') || null;
}

async function rpc<T>(env: Env, name: string, args: Record<string, unknown>): Promise<T> {
  const url = env.get('SUPABASE_URL');
  const key = serverKey(env);
  if (!url || !key) throw new Error('нет SUPABASE_URL или ключа сервера');
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  // новые ключи — только в apikey (в Authorization платформа ждёт JWT), старые — в обоих заголовках
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(args) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${name}: ${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T; // функции без результата отвечают 204 без тела
}

async function generateVapid(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const publicKey = b64urlEncode(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey, privateKey: jwk.d ?? '' };
}

let cache: { config: Config; at: number } | null = null;
const CACHE_MS = 10 * 60 * 1000;

export function resetConfigCache(): void {
  cache = null;
}

export async function loadConfig(env: Env, fresh = false): Promise<Config> {
  const envPublic = env.get('VAPID_PUBLIC_KEY');
  const envPrivate = env.get('VAPID_PRIVATE_KEY');
  const envSecret = env.get('PUSH_SECRET');
  if (envPublic && envPrivate && envSecret) {
    return { publicKey: envPublic, privateKey: envPrivate, secret: envSecret, subject: env.get('VAPID_SUBJECT') || DEFAULT_SUBJECT };
  }
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.config;
  let row = await rpc<ConfigRow | null>(env, 'push_config', {});
  if (!row) throw new Error('нет строки private.app_config — выполните supabase/schema.sql');
  if (!row.vapid_public || !row.vapid_private) {
    // первый запуск: создаём ключи; если параллельно их уже создал другой запрос — база вернёт те, что сохранились
    const pair = await generateVapid();
    row = await rpc<ConfigRow>(env, 'push_config_init', { p_public: pair.publicKey, p_private: pair.privateKey });
  }
  const config: Config = {
    publicKey: row.vapid_public ?? '',
    privateKey: row.vapid_private ?? '',
    subject: row.vapid_subject || DEFAULT_SUBJECT,
    secret: row.push_secret,
  };
  cache = { config, at: Date.now() };
  return config;
}

function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function handle(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'method' }, 405);

  let config: Config;
  try {
    config = await loadConfig(env);
  } catch (e) {
    console.error('[push] настройки', e);
    return json({ error: 'Сервер уведомлений не настроен: ' + String(e instanceof Error ? e.message : e) }, 500);
  }

  if (req.method === 'GET') return json({ publicKey: config.publicKey });

  const given = req.headers.get('x-push-secret') ?? '';
  if (!sameSecret(given, config.secret)) {
    // секрет могли сменить в базе — перечитаем настройки один раз
    const fresh = cache && Date.now() - cache.at > 30_000 ? await loadConfig(env, true).catch(() => config) : config;
    if (!sameSecret(given, fresh.secret)) return json({ error: 'forbidden' }, 403);
    config = fresh;
  }

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
    subscriptions?: Subscription[];
  };
  const message = enc.encode(
    JSON.stringify({ title: String(body.title ?? 'Двое').slice(0, 120), body: String(body.body ?? '').slice(0, 400), data: body.data ?? {} }),
  );
  const subs = (body.subscriptions ?? [])
    .filter((s) => s && typeof s.endpoint === 'string' && PUSH_ENDPOINT.test(s.endpoint) && s.p256dh && s.auth)
    .slice(0, 20);

  const results = await Promise.all(
    subs.map(async (s) => {
      try {
        const res = await fetch(s.endpoint, {
          method: 'POST',
          headers: {
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
            TTL: '86400',
            Urgency: 'high',
            Authorization: await vapidHeader(s.endpoint, config.publicKey, config.privateKey, config.subject),
          },
          body: await encryptPayload(message, s.p256dh, s.auth),
        });
        if (res.status >= 400) console.warn('[push]', new URL(s.endpoint).host, res.status, await res.text().catch(() => ''));
        return { endpoint: s.endpoint, status: res.status };
      } catch (e) {
        return { endpoint: s.endpoint, status: 0, error: String(e) };
      }
    }),
  );

  // Подписки, которых больше нет (сайт удалён с экрана «Домой» или уведомления запрещены), — удаляем из базы
  const gone = results.filter((r) => r.status === 404 || r.status === 410).map((r) => r.endpoint);
  if (gone.length) await rpc(env, 'web_push_gone', { p_endpoints: gone }).catch((e) => console.warn('[push] очистка', e));

  return json({ sent: results.filter((r) => r.status >= 200 && r.status < 300).length, results: results.map((r) => r.status) });
}

declare const Deno: { serve(handler: (req: Request) => Promise<Response>): void; env: Env } | undefined;
if (typeof Deno !== 'undefined') Deno.serve((req) => handle(req, Deno!.env));
