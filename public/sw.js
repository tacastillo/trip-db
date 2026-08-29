/* The offline half of the map.

   This file is copied to the site verbatim, so it is plain ES5-ish worker code with no
   build step behind it and no imports: nothing here is bundled, and it must keep
   working on its own at /trip-db/sw.js. Everything the page needs already ships in the
   repository — Leaflet, both fonts, the trip data, the bundle — so the only thing
   standing between this map and a dead SIM in Jeju is that a browser has been asked to
   keep them. That is all this does.

   Two caches, because they age differently. The shell is whatever the site is made of
   and is replaced on every deploy; the tiles are somebody else's pictures of Korea and
   are worth keeping across deploys, which is why the version suffix only moves on the
   shell. */

const SHELL = "trip-db-shell-v1";
/* v2: every tile URL gained @2x when the layer and the pack were made to agree, so
   every v1 key is unreachable. Bumped rather than left to rot — stale keys still
   count against TILE_MAX and would evict the pack downloaded to replace them. */
const TILES = "trip-db-tiles-v2";
const TILE_HOST = "basemaps.cartocdn.com";
/* Enough for every leg at every zoom the pack asks for, with room for the wandering
   you do around them. Past it the oldest keys go, in insertion order. */
const TILE_MAX = 4000;

const SHELL_FILES = [
  "./",
  "./index.html",
  "./phrases.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./vendor/leaflet/leaflet.js",
  "./vendor/leaflet/leaflet.css",
  "./vendor/leaflet/images/marker-icon.png",
  "./vendor/leaflet/images/marker-icon-2x.png",
  "./vendor/leaflet/images/marker-shadow.png",
  "./vendor/leaflet/images/layers.png",
  "./vendor/leaflet/images/layers-2x.png",
  "./vendor/fonts/inter-latin-wght-normal.woff2",
  "./vendor/fonts/inter-latin-ext-wght-normal.woff2",
  "./vendor/fonts/bricolage-grotesque-latin-wght-normal.woff2",
  "./vendor/fonts/bricolage-grotesque-latin-ext-wght-normal.woff2",
];

/* CARTO serves the same tile from a.–d. and Leaflet picks a subdomain from the tile's
   own coordinates, so the same picture can be asked for under four different URLs.
   Cache under one of them or the pack you downloaded is the pack you never hit. */
function tileKey(url){
  return url.replace(/\/\/[a-d]\.basemaps\.cartocdn\.com/, "//a.basemaps.cartocdn.com");
}
function isTile(url){ return url.indexOf(TILE_HOST) >= 0; }

async function trimTiles(){
  const cache = await caches.open(TILES);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - TILE_MAX; i++) await cache.delete(keys[i]);
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // one at a time: addAll fails the whole install if any single file 404s, and a
    // renamed vendor file should cost that file, not the entire offline mode
    await Promise.all(SHELL_FILES.map(async (f) => {
      try { await cache.add(new Request(new URL(f, self.registration.scope), { cache:"reload" })); }
      catch (err){ /* it will be picked up at runtime the first time it is asked for */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys())
      if (k.indexOf("trip-db-") === 0 && k !== SHELL && k !== TILES) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Tiles: cache first. They never change, and the whole point of the pack is that a
  // cached one is used without asking the network whether there is a better one.
  if (isTile(url.href)){
    e.respondWith((async () => {
      const cache = await caches.open(TILES);
      const key = tileKey(url.href);
      const hit = await cache.match(key);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === "opaque")) cache.put(key, res.clone());
        return res;
      } catch (err){
        // no tile and no network: the page already draws pins on a blank canvas and
        // says so, which is a better answer than a broken image
        return new Response("", { status: 504, statusText: "offline, no cached tile" });
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  // The page itself: network first, so a deploy is picked up the moment there is a
  // network, and the cached copy is what is left when there is not.
  //
  // Keyed on the path and never on the request. Two pages now share this branch, so a
  // fixed "./index.html" key would file the phrase page under the map page's name and
  // then serve the phrase page to anyone opening the map offline. But keying on `req`
  // is worse: a shared day is index.html?city=…&stops=…, and every distinct query string
  // would become its own cache entry, so a link nobody had opened verbatim would have
  // nothing to fall back to. The pathname is the page; the query is what the page reads.
  if (req.mode === "navigate"){
    const page = url.origin + url.pathname;
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(SHELL);
        // cache.put throws on a redirected response, and a bare path redirecting to its
        // .html is exactly the shape a second page invites
        if (res && res.ok && !res.redirected) cache.put(page, res.clone());
        return res;
      } catch (err){
        const cache = await caches.open(SHELL);
        return (await cache.match(page))
            || (await cache.match(new URL("./index.html", self.registration.scope)))
            || (await cache.match(new URL("./", self.registration.scope)))
            || Response.error();
      }
    })());
    return;
  }

  // Everything else the site is made of: answer from the cache, refill behind you.
  e.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const hit = await cache.match(req);
    const net = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => hit || Response.error());
    return hit || net;
  })());
});

/* The explicit download. The page works out which tiles a leg needs and hands them
   over in one message; this fetches what is missing and reports back as it goes, so
   the button can say 40% rather than spinning. */
self.addEventListener("message", (e) => {
  const msg = e.data || {};
  if (msg.type === "skip-waiting") return self.skipWaiting();
  if (msg.type !== "cache-tiles") return;
  const port = e.ports && e.ports[0];
  const say = (m) => { if (port) port.postMessage(m); };
  e.waitUntil((async () => {
    const cache = await caches.open(TILES);
    const urls = msg.urls || [];
    let done = 0, got = 0, failed = 0;
    // four at a time: enough to fill a hotel connection, few enough that CARTO is
    // not being hammered by a phone in a lobby
    const queue = urls.slice();
    const worker = async () => {
      while (queue.length){
        const u = queue.shift();
        const key = tileKey(u);
        try {
          if (!(await cache.match(key))){
            const res = await fetch(u, { mode:"cors" }).catch(() => fetch(u, { mode:"no-cors" }));
            if (res && (res.ok || res.type === "opaque")){ await cache.put(key, res.clone()); got++; }
            else failed++;
          }
        } catch (err){ failed++; }
        done++;
        if (done % 10 === 0 || done === urls.length) say({ type:"cache-progress", done, total:urls.length });
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    await trimTiles();
    say({ type:"cache-done", total:urls.length, got, failed });
  })());
});
