// В приложении для телефона веб-уведомления не нужны — там push через Expo/FCM (notifications.ts).
// Версия для сайта — webPush.web.ts.

export type WebPushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

export async function webPushState(): Promise<WebPushState> {
  return 'unsupported';
}

export async function enableWebPush(): Promise<{ ok: boolean; message: string }> {
  return { ok: false, message: 'Недоступно в этой версии' };
}

export async function syncWebPush(): Promise<void> {
  return undefined;
}

export async function disableWebPush(): Promise<void> {
  return undefined;
}

export function registerServiceWorker(): void {
  return undefined;
}
