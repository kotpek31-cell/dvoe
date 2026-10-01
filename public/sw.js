/* «Двое»: service worker веб-версии — показывает push-уведомления
   (iPhone: только когда сайт установлен на экран «Домой», iOS 16.4+). */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Куда вести по нажатию на уведомление
const ROUTES = { nudge: 'home', cast: 'home', question: 'us', wish: 'profile', score: 'day-score', report: 'stats' };

self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch (e) {
    message = { title: 'Двое', body: event.data ? event.data.text() : '' };
  }
  const extra = message.data || {};
  const scope = self.registration.scope;
  const url = new URL(ROUTES[extra.type] || '', scope).href;
  event.waitUntil(
    self.registration.showNotification(message.title || 'Двое', {
      body: message.body || '',
      icon: new URL('icon-192.png', scope).href,
      badge: new URL('icon-192.png', scope).href,
      tag: extra.type || 'dvoe',
      renotify: true,
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(url);
            } catch (e) {
              // не страшно — приложение уже открыто
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })(),
  );
});
