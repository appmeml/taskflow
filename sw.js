/* TaskFlow Service Worker — v4 */
const CACHE = 'taskflow-v4';
const PRECACHE = [
  './css/style.css',
  './js/firebase-config.js',
  './js/board.js',
  './js/automation-engine.js',
  './js/memberships.js',
  './js/notifications.js',
  './js/auth.js',
  './js/boards.js',
  './logo.svg',
  './manifest.json',
];

// Take control immediately — don't wait for old SW to die
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(
        PRECACHE.map(url => c.add(url).catch(() => {})) // ignore individual failures
      )
    )
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
  // Never intercept navigation requests — let the browser handle HTML page loads.
  // This prevents the "Response served by service worker has redirections" error
  // that occurs when a cached redirect response is served for a navigate request.
  if (e.request.mode === 'navigate') return;

  const url = e.request.url;
  if (e.request.method !== 'GET') return;

  // Skip Firebase / Google API calls
  if (url.includes('firestore.googleapis') || url.includes('identitytoolkit') ||
      url.includes('securetoken') || url.includes('gstatic.com/firebasejs')) return;

  // Only cache same-origin resources
  if (!url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(response => {
        if (response.ok && !response.redirected) {
          caches.open(CACHE).then(c => c.put(e.request, response.clone()));
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
