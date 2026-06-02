/* TaskFlow Service Worker — v3 */
const CACHE = 'taskflow-v3';
const PRECACHE = [
  '/index.html',
  '/board.html',
  '/calendar.html',
  '/reports.html',
  '/admin.html',
  '/css/style.css',
  '/js/firebase-config.js',
  '/js/board.js',
  '/js/memberships.js',
  '/js/notifications.js',
  '/js/auth.js',
  '/js/boards.js',
  '/js/workspace.js',
  '/logo.svg',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (e.request.method !== 'GET') return;
  // Safari bug: "Response served by service worker has redirections"
  // — never intercept navigation requests; let the browser handle HTML loads natively
  if (e.request.mode === 'navigate') return;
  if (url.includes('firestore.googleapis') || url.includes('identitytoolkit') ||
      url.includes('securetoken') || url.includes('gstatic.com/firebasejs')) return;
  if (!url.startsWith(self.location.origin)) return;

  // Cache-first for all static assets (JS, CSS, images, fonts)
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
