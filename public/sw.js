/**
 * Service worker do Ryse.
 *
 * Estratégia deliberadamente conservadora:
 *  - navegações  -> rede primeiro, com a casca offline como reserva;
 *  - estáticos   -> cache primeiro (os assets do Next têm hash no nome);
 *  - resto       -> passa direto.
 *
 * Nada de dados clínicos é gravado em cache.
 */
const VERSION = 'ryse-v1';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192.png']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r || Response.error()),
      ),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(ASSETS).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});

/* ------------------------------------------------------------ PUSH ------- */

/**
 * Notificação recebida em segundo plano.
 *
 * O payload é sempre JSON vindo do servidor, mas um provedor pode entregar um
 * push vazio (para "acordar" o worker). Por isso o parse é defensivo: sem
 * conteúdo, mostramos um aviso genérico em vez de deixar o evento estourar —
 * um push que falha aqui aparece como "site atualizado em segundo plano" no
 * Android, o que é pior que uma mensagem simples.
 */
self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Ryse';
  const options = {
    body: payload.body || 'Você tem uma novidade no Ryse.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // A tag agrupa: dois lembretes de hidratação viram um só na bandeja.
    tag: payload.tag || 'ryse',
    renotify: Boolean(payload.tag),
    data: { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Toque na notificação.
 *
 * Se o app já estiver aberto, foca a aba existente e navega nela — abrir uma
 * segunda janela do mesmo app é sempre indesejado.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const destino = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.navigate(destino);
            return client.focus();
          }
        }
        return self.clients.openWindow(destino);
      }),
  );
});
