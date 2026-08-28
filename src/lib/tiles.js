/* Which map tiles a city is, so they can be fetched once on hotel wifi and kept.

   Pure arithmetic on the standard Web Mercator tile scheme — no DOM, no Leaflet, no
   network — so tools/ can count a pack before anyone downloads one. The zooms are
   chosen for what you actually do with a phone in a street: 16 is the block you are
   standing in, 15 the neighbourhood, 14 the walk between two of them, and 11–13 exist
   so that pinching out does not land on a grey void. */

export const DEG = Math.PI / 180;

/* Around each spot rather than across the whole city: a bounding box of Seoul at zoom
   16 is a quarter of a million tiles, and nine-tenths of them are river and hillside
   you will never open. 450m is the radius that keeps a spot's own block covered
   whichever corner of its tile it sits in. */
export const PACK_ZOOMS_CITY = [11, 12, 13];
export const PACK_ZOOMS_SPOT = [14, 15, 16];
export const PACK_RADIUS_M = 450;
export const M_PER_DEG_LAT = 111320;

export function lngToX(lng, z){ return Math.floor((lng + 180) / 360 * Math.pow(2, z)); }
export function latToY(lat, z){
  const r = lat * DEG;
  return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z));
}

/** Every tile touching [[south, west], [north, east]] at one zoom. */
export function tilesForBox(box, z){
  const out = [];
  const n = Math.pow(2, z);
  const clamp = (v) => Math.max(0, Math.min(n - 1, v));
  const x0 = clamp(lngToX(box[0][1], z)), x1 = clamp(lngToX(box[1][1], z));
  const y0 = clamp(latToY(box[1][0], z)), y1 = clamp(latToY(box[0][0], z));
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) out.push({ z, x, y });
  return out;
}

export function boxAround(lat, lng, m){
  const dLat = m / M_PER_DEG_LAT;
  const dLng = m / (M_PER_DEG_LAT * Math.cos(lat * DEG));
  return [[lat - dLat, lng - dLng], [lat + dLat, lng + dLng]];
}

export function boundsOf(places){
  const box = [[90, 180], [-90, -180]];
  places.forEach(p => {
    box[0][0] = Math.min(box[0][0], p.lat); box[0][1] = Math.min(box[0][1], p.lng);
    box[1][0] = Math.max(box[1][0], p.lat); box[1][1] = Math.max(box[1][1], p.lng);
  });
  return box;
}

/** The tile pack for one leg: the whole city at the zooms where it is cheap, and a
    block around every spot at the zooms where it is not. Deduped, and in a stable
    order so two runs of this produce the same download. */
export function offlinePack(places, opts){
  const o = opts || {};
  if (!places.length) return [];
  const seen = new Set(), out = [];
  const add = (t) => {
    const k = `${t.z}/${t.x}/${t.y}`;
    if (seen.has(k)) return;
    seen.add(k); out.push(t);
  };
  const box = boundsOf(places);
  (o.cityZooms || PACK_ZOOMS_CITY).forEach(z => tilesForBox(box, z).forEach(add));
  (o.spotZooms || PACK_ZOOMS_SPOT).forEach(z =>
    places.forEach(p => tilesForBox(boxAround(p.lat, p.lng, o.radius || PACK_RADIUS_M), z).forEach(add)));
  return out;
}

/* ---------- the one URL a tile has ----------

   The live layer and the offline pack have to ask for byte-identical URLs, because the
   worker caches by URL and matches by URL. They did not, and it was invisible: Leaflet
   substitutes `{r}` from `Browser.retina` alone — not from `detectRetina`, which this
   page never set — so every retina phone requested `…@2x.png` while the pack cached
   `….png`. Online that falls through to the network and looks fine. Offline it was a
   dead map in Jeju, with the button still saying "Saved".

   So there is one template here, in the pure half where a test can reach it, and both
   callers build from it. `@2x` is hardcoded rather than left to `{r}`: a URL that
   depends on the device is a URL the pack builder cannot predict. A 1x screen pays for
   pixels it cannot show, which is the cheaper mistake — the desktop is where this is
   edited and the phone is where it is used.

   Not `detectRetina` either: it halves `tileSize` and bumps `zoomOffset`, which changes
   *which* z/x/y are requested, and offlinePack() computes those itself. */
export const TILE_URL = "https://{s}.basemaps.cartocdn.com/{style}/{z}/{x}/{y}@2x.png";

/** For Leaflet, which fills {s}/{z}/{x}/{y} itself. */
export const leafletTemplate = (style) => TILE_URL.replace("{style}", style);

/** For the pack and the worker. One subdomain: CARTO serves the same tile from a–d and
    Leaflet picks by coordinate, so both ends normalise to `a` — see tileKey() in sw.js. */
export const tileUrl = (style, t, sub = "a") => TILE_URL
  .replace("{s}", sub).replace("{style}", style)
  .replace("{z}", t.z).replace("{x}", t.x).replace("{y}", t.y);

/* Roughly what one tile weighs, for the size a person is told before they download a
   leg. @2x tiles are four times the pixels; voyager carries far more ink than the flat
   bases do. Measured off CARTO, and only ever used to print a number. */
export const TILE_KB = { "dark_all": 38, "light_all": 34, "rastertiles/voyager": 62 };
