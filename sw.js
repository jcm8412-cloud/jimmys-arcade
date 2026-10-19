/* Service worker: caches every file so the game plays offline.
   Bump CACHE whenever any file changes, so installed copies pick up the new version. */
const CACHE = "hangman-v2";
const FILES = [
  "./",
  "index.html",
  "manifest.json",
  "css/style.css",
  "fonts/gochi-hand-latin.woff2",
  "fonts/patrick-hand-latin.woff2",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "js/words.js",
  "js/impossible-words.js",
  "js/engine.js",
  "js/themes/registry.js",
  "js/themes/classic.js",
  "js/themes/snowman.js",
  "js/themes/balloons.js",
  "js/themes/monster.js",
  "js/themes/pumpkin.js",
  "js/themes/rocket.js",
  "js/app.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache first, then network; page navigations fall back to the cached index.html.
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(req).catch(() => (req.mode === "navigate" ? caches.match("index.html") : Response.error()));
    })
  );
});
