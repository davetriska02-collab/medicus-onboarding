/**
 * sw.js — Service Worker for the Family Planner Portal.
 *
 * Caches all static assets so the app works fully offline for local features
 * (chores, shopping, messages). Remote features (weather, trains, calendar)
 * fall back to cached API responses managed by fetch-cache.js / IndexedDB.
 */

const CACHE_NAME = 'fp-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/variables.css',
  './css/reset.css',
  './css/layout.css',
  './css/widgets.css',
  './css/touch.css',
  './js/app.js',
  './js/utils.js',
  './js/db.js',
  './js/state.js',
  './js/fetch-cache.js',
  './js/router.js',
  './js/kiosk.js',
  './js/widgets/clock.js',
  './js/widgets/weather.js',
  './js/widgets/calendar.js',
  './js/widgets/chores.js',
  './js/widgets/trains.js',
  './js/widgets/shopping.js',
  './js/widgets/messages.js',
  './js/widgets/settings.js',
  './config.example.js',
  './data/default-chores.json',
];

/* ---- Install: pre-cache static assets ---- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ---- Activate: clean up old caches ---- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ---- Fetch: cache-first for static, network-first for API ---- */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls (weather, trains, calendars) — network first, no SW caching
  // (handled by IndexedDB FetchCache in the app)
  if (url.hostname !== self.location.hostname) {
    return; // Let the browser handle it normally
  }

  // Static assets — cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache new static requests
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback for navigation — serve index.html
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
