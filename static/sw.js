// inkwand service worker: keeps the whole library in the browser so it works offline.
// Pages, styles and scripts are network-first (so updates show up straight away) with the
// cached copy as a fallback. Chapters are served from the cache and refreshed in the background.

const CACHE = "inkwand-v2";
const SHELL = ["/", "/static/styles.css", "/static/app.js", "/favicon.svg", "/api/config"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    // Save every chapter of every book, a few at a time.
    const config = await (await fetch("/api/config")).json();
    const urls = config.books.flatMap((b) => b.chapters.map((c) => `/api/library/${b.id}/${c.id}`));
    for (let i = 0; i < urls.length; i += 8) {
      await Promise.all(urls.slice(i, i + 8).map((u) => cache.add(u).catch(() => {})));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === "navigate") return cache.match("/");
    throw new Error("offline and not cached");
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((res) => { if (res.ok) cache.put(request, res.clone()); return res; })
    .catch(() => null);
  return cached || (await refresh) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // live writing (POST) always goes to the network
  const url = new URL(request.url);

  if (url.origin === location.origin) {
    if (url.pathname.startsWith("/api/library/")) return event.respondWith(cacheFirst(request));
    if (url.pathname.startsWith("/api/health")) return;
    return event.respondWith(networkFirst(request));
  }
  // Google Fonts: keep a copy so the handwriting still shows offline.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(cacheFirst(request));
  }
});
