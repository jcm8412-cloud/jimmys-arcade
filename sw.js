/* Service worker: caches the shell and every game so the arcade plays offline.
   Game files come from games/index.js, so adding a game doesn't mean editing this file.
   Bump CACHE whenever any file changes, so installed copies pick up the new version. */
const CACHE = "jimmys-arcade-v20";
const SHELL_FILES = [
  "./",
  "index.html",
  "manifest.json",
  "fonts/gochi-hand-latin.woff2",
  "fonts/patrick-hand-latin.woff2",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "shell/style.css",
  "shell/action.css",
  "shell/action.js",
  "shell/storage.js",
  "shell/avatars.js",
  "shell/shell.js",
  "shell/themes/registry.js",
  "shell/themes/classic.js",
  "shell/themes/snowman.js",
  "shell/themes/balloons.js",
  "shell/themes/monster.js",
  "shell/themes/pumpkin.js",
  "shell/themes/rocket.js",
  "games/index.js"
];

importScripts("games/index.js");
const GAME_FILES = self.Arcade.GAME_LIST.flatMap(g => g.files.map(f => `games/${g.folder}/${f}`));

// cache: "reload" skips the browser's HTTP cache, so a new version never stores stale copies of files.
self.addEventListener("install", event => {
  const requests = SHELL_FILES.concat(GAME_FILES).map(url => new Request(url, { cache: "reload" }));
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(requests)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      // Only remove this app's old versions; other apps on the same site keep their caches.
      .then(keys => Promise.all(keys.filter(k => k.startsWith("jimmys-arcade-") && k !== CACHE).map(k => caches.delete(k))))
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
