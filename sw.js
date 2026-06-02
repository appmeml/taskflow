/* TaskFlow Service Worker — v2 */
const CACHE = 'taskflow-v2';
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
  // Skip Firebase, Google APIs and non-GET requests
  if (e.request.method !== 'GET') return;
  if (url.includes('firestore.googleapis') || url.includes('identitytoolkit') ||
      url.includes('securetoken') || url.includes('gstatic.com/firebasejs')) return;
  if (!url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => cached); // offline fallback
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
