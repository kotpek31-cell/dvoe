// Web Push для сайта (iPhone: только если «Двое» открыта с экрана «Домой», iOS 16.4+).
// Подписка хранится в Supabase (save_web_push), а отправляет уведомления Edge Function «push».
import { deleteWebPush, saveWebPush } from './api';
import { supabaseUrl } from './supabase';

export type WebPushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

type Win = {
  navigator: Navigator & { standalone?: boolean };
  matchMedia?: (query: string) => { matches: boolean };
  location: Location;
  document: Document;
  Notification?: typeof Notification;
  PushManager?: unknown;
};

const win = globalThis as unknown as Win;

function isIOS(): boolean {
  const ua = win.navigator?.userAgent ?? '';
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in win.document);
}

function isStandalone(): boolean {
  return Boolean(win.matchMedia?.('(display-mode: standalone)').matches || win.navigator?.standalone);
}

function hasApis(): boolean {
  return Boolean(win.navigator && 'serviceWorker' in win.navigator && win.PushManager && win.Notification);
}

// Сайт лежит в подпапке (kotpek31-cell.github.io/dvoe/) — service worker должен быть там же
function basePath(): string {
  const env = process.env.EXPO_BASE_URL;
  if (env) return env.endsWith('/') ? env : `${env}/`;
  const { hostname, pathname } = win.location;
  if (hostname.endsWith('github.io')) {
    const first = pathname.split('/').filter(Boolean)[0];
    return first ? `/${first}/` : '/';
  }
  return '/';
}

function toBytes(base64url: string): Uint8Array {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function toBase64url(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  let s = '';
  new Uint8Array(buf).forEach((b) => {
    s += String.fromCharCode(b);
  });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Регистрируем service worker сразу при запуске сайта — к моменту нажатия «Включить» он уже готов
export function registerServiceWorker(): void {
  if (!hasApis()) return;
  const base = basePath();
  win.navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((e) => console.warn('[push] service worker', e));
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  const base = basePath();
  const existing = await win.navigator.serviceWorker.getRegistration(base);
  if (!existing) await win.navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
  return win.navigator.serviceWorker.ready;
}

// Публичный ключ VAPID отдаёт Edge Function «push» (при первом обращении она сама создаёт ключи)
async function publicKey(): Promise<string> {
  if (!supabaseUrl) throw new Error('Supabase не настроен');
  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/push`);
  } catch {
    throw new Error(
      'Не удалось связаться с сервером уведомлений. Проверьте интернет (VPN) и что Edge Function «push» развёрнута с выключенной проверкой JWT.',
    );
  }
  const json = (await res.json().catch(() => ({}))) as { publicKey?: string; error?: string };
  if (res.status === 404) throw new Error('Сервер уведомлений ещё не развёрнут: нужна Edge Function «push» (см. UPDATE_0.1.md).');
  if (res.status === 401) throw new Error('У Edge Function «push» включена проверка JWT — её нужно выключить (см. UPDATE_0.1.md).');
  if (!res.ok || !json.publicKey) throw new Error(json.error || `Сервер уведомлений ответил ошибкой ${res.status}`);
  return json.publicKey;
}

async function save(sub: PushSubscription): Promise<void> {
  await saveWebPush({ endpoint: sub.endpoint, p256dh: toBase64url(sub.getKey('p256dh')), auth: toBase64url(sub.getKey('auth')) });
}

export async function webPushState(): Promise<WebPushState> {
  if (isIOS() && !isStandalone()) return 'needs-install';
  if (!hasApis()) return 'unsupported';
  const permission = win.Notification!.permission;
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'off';
  const reg = await win.navigator.serviceWorker.getRegistration(basePath());
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

// Вызывать прямо из нажатия кнопки: iOS показывает запрос разрешения только в ответ на касание
export async function enableWebPush(): Promise<{ ok: boolean; message: string }> {
  if (isIOS() && !isStandalone()) {
    return {
      ok: false,
      message: 'На iPhone уведомления работают, только если открыть «Двое» с экрана «Домой»: Safari → «Поделиться» → «На экран Домой».',
    };
  }
  if (!hasApis()) return { ok: false, message: 'Этот браузер не поддерживает push-уведомления.' };
  try {
    const permission = await win.Notification!.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, message: 'Уведомления запрещены. Включить: Настройки iPhone → Уведомления → Двое.' };
    }
    const reg = await readyRegistration();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const key = toBytes(await publicKey());
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key as BufferSource });
    }
    await save(sub);
    return { ok: true, message: 'Уведомления включены' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// При запуске: если разрешение уже есть — тихо обновляем подписку в базе
export async function syncWebPush(): Promise<void> {
  if (!hasApis() || win.Notification!.permission !== 'granted') return;
  if (isIOS() && !isStandalone()) return;
  const reg = await readyRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = toBytes(await publicKey());
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key as BufferSource });
  }
  await save(sub);
}

// При выходе из аккаунта: чтобы на этом устройстве не приходили чужие уведомления
export async function disableWebPush(): Promise<void> {
  if (!hasApis()) return;
  const reg = await win.navigator.serviceWorker.getRegistration(basePath());
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await deleteWebPush(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe().catch(() => false);
}
