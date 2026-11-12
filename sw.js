/* Norsk drill service worker: cache-first for speed; every request also refreshes the cache in the background, so an edit shows up on the next open.
   VERSION is the first 10 hex chars of sha1 over index.html, app.js, cards.js, the stylesheets, and cards/*. */
const VERSION = "ec7d0fe3da";
const CACHE = "norsk-drill-" + VERSION;
const SHELL = ["./", "index.html", "app.js", "cards.js", "style.css", "effects.css", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "cards/index.txt", "cards/patterns.txt", "cards/sequence.txt", "cards/order.txt", "cards/fill.txt", "cards/mc.txt", "cards/gap.txt", "cards/typed.txt", "cards/sense.txt", "cards/expr.txt"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("norsk-drill-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(c => c.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()); return res; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net.catch(() => c.match("index.html"));
  })));
});
