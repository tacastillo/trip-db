/* Shared bits for the maintenance scripts. No dependencies — Node 18+ only, so
   `node tools/<script>.mjs` works in a fresh clone with nothing installed. */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const INDEX = join(dirname(fileURLToPath(import.meta.url)), "..", "index.html");

export const readIndex = () => readFileSync(INDEX, "utf8");
export const saveIndex = (text) => writeFileSync(INDEX, text);

/* ---------- reading the constants out of index.html ----------
   They are plain JS literals, so the honest way to read them is to let JS read
   them. Everything here is our own file, never anything fetched. */

/** Span of `const NAME = <literal>;` in the source, or null. */
export function constSpan(text, name){
  const head = `const ${name} = `;
  const at = text.indexOf(head);
  if (at < 0) return null;
  let i = at + head.length, depth = 0, str = null;
  for (; i < text.length; i++){
    const c = text[i];
    if (str){
      if (c === "\\") i++;
      else if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") str = c;
    else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") depth--;
    else if (c === ";" && depth === 0) break;
  }
  return { start: at, valueStart: at + head.length, valueEnd: i, end: i + 1 };
}

export function readConst(text, name){
  const s = constSpan(text, name);
  if (!s) throw new Error(`no const ${name} in index.html`);
  return new Function(`return (${text.slice(s.valueStart, s.valueEnd)});`)();
}

/** Replace `const NAME = ...;` with `serialized`, leaving the rest untouched. */
export function writeConst(text, name, serialized){
  const s = constSpan(text, name);
  if (!s) throw new Error(`no const ${name} in index.html`);
  return text.slice(0, s.valueStart) + serialized + text.slice(s.valueEnd);
}

/* ---------- serialising, matching how the file already looks ---------- */

const round = (n, dp) => Number(n.toFixed(dp));

/** Rail lines: one dense line, 5dp — the shape `drawRail` expects. */
export function serializeRail(lines){
  return JSON.stringify(lines.map(l => ({
    ref: l.ref, label: l.label, color: l.color,
    paths: l.paths.map(p => ({
      pts: p.pts.map(([a, b]) => [round(a, 5), round(b, 5)]),
      ends: p.ends,
    })),
  })));
}

/** Stations: one per line, 6dp — a table people read and edit by hand. */
export function serializeStations(coords){
  const rows = Object.keys(coords).map(k =>
    `  ${JSON.stringify(k)}: [${round(coords[k][0], 6)}, ${round(coords[k][1], 6)}],`);
  return `{\n${rows.join("\n")}\n}`;
}

/* ---------- geometry ---------- */

const R = 6371000, rad = (d) => d * Math.PI / 180;

export function metres(a, b){
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Perpendicular distance from p to segment a→b, in metres. */
export function pointToSeg(p, a, b){
  const k = Math.cos(rad(a[0]));                       // lng degrees are shorter up north
  const ax = a[1] * k, ay = a[0], bx = b[1] * k, by = b[0], px = p[1] * k, py = p[0];
  const dx = bx - ax, dy = by - ay;
  const len = dx * dx + dy * dy;
  let t = len ? ((px - ax) * dx + (py - ay) * dy) / len : 0;
  t = Math.max(0, Math.min(1, t));
  return metres(p, [ay + t * dy, (ax + t * dx) / k]);
}

/** Douglas–Peucker, tolerance in metres. */
export function simplify(pts, tol){
  if (pts.length < 3) return pts.slice();
  let far = 0, best = -1;
  for (let i = 1; i < pts.length - 1; i++){
    const d = pointToSeg(pts[i], pts[0], pts[pts.length - 1]);
    if (d > far){ far = d; best = i; }
  }
  if (far <= tol) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, best + 1), tol).slice(0, -1),
          ...simplify(pts.slice(best), tol)];
}

/** Join OSM ways end-to-end into as few continuous paths as possible. */
export function stitch(ways, tol = 30){
  const open = ways.filter(w => w.length > 1).map(w => w.slice());
  const paths = [];
  while (open.length){
    const path = open.shift();
    let grew = true;
    while (grew){
      grew = false;
      for (let i = 0; i < open.length; i++){
        const w = open[i], head = path[0], tail = path[path.length - 1];
        if (metres(tail, w[0]) <= tol)               path.push(...w.slice(1));
        else if (metres(tail, w[w.length - 1]) <= tol) path.push(...w.slice(0, -1).reverse());
        else if (metres(head, w[w.length - 1]) <= tol) path.unshift(...w.slice(0, -1));
        else if (metres(head, w[0]) <= tol)          path.unshift(...w.slice(1).reverse());
        else continue;
        open.splice(i, 1); grew = true; break;
      }
    }
    paths.push(path);
  }
  return paths;
}

/** Cut a path to what lies within `km` of `centre`, marking the cut ends. */
export function clipToRadius(path, centre, km){
  const inside = path.map(p => metres(p, centre) <= km * 1000);
  const out = [];
  let cur = null;
  for (let i = 0; i < path.length; i++){
    if (inside[i]){
      if (!cur){
        cur = { pts: [], cutStart: i > 0, cutEnd: false };
        if (i > 0) cur.pts.push(crossing(path[i - 1], path[i], centre, km));
      }
      cur.pts.push(path[i]);
    } else if (cur){
      cur.pts.push(crossing(path[i], path[i - 1], centre, km));
      cur.cutEnd = true;
      out.push(cur); cur = null;
    }
  }
  if (cur) out.push(cur);
  return out.filter(s => s.pts.length > 1);
}

/** Where the segment outside→inside crosses the circle, by bisection. */
function crossing(outside, inside, centre, km){
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++){
    const mid = (lo + hi) / 2;
    const p = [outside[0] + (inside[0] - outside[0]) * mid,
               outside[1] + (inside[1] - outside[1]) * mid];
    if (metres(p, centre) > km * 1000) lo = mid; else hi = mid;
  }
  return [outside[0] + (inside[0] - outside[0]) * hi,
          outside[1] + (inside[1] - outside[1]) * hi];
}

/* ---------- turning OSM ways into the shape the page draws ---------- */

/** Shortest distance from a point to a polyline, measured to its segments and
    not its vertices — these paths carry a point every ~300m, so a station that
    sits exactly on a line can still be half a kilometre from its nearest one. */
export function distToPath(p, path){
  let best = Infinity;
  for (let i = 1; i < path.length; i++) best = Math.min(best, pointToSeg(p, path[i - 1], path[i]));
  return best;
}

/** Tolerances. Raising simplifyM shrinks the file and coarsens the curves; at
    20m the whole Seoul network is ~1300 points, which is what ships today. */
export const RAIL_TOLERANCES = { simplifyM: 20, junctionM: 120, stitchM: 30, dupeM: 60 };

/** Is `path` already drawn by one of `others`? A route_master carries both
    directions of a service, and they are the same line on the map. */
function covered(path, others, tol){
  if (!others.length) return false;
  const on = path.filter(p => others.some(o => distToPath(p, o) <= tol)).length;
  return on / path.length >= 0.9;
}

/** Way groups — ONE PER ROUTE RELATION — to one line object, clipped and
    end-annotated. Stitching runs inside a group and never across groups: a
    branch shares its junction node with the loop, so pooling every way of a
    line together splices the branch into the middle of the loop. */
export function buildLine(line, wayGroups, city, tol = RAIL_TOLERANCES){
  const candidates = wayGroups
    .flatMap(ways => stitch(ways, tol.stitchM))
    .map(p => simplify(p, tol.simplifyM))
    .filter(p => p.length > 1)
    .sort((a, b) => b.length - a.length);      // keep the fullest version of a service

  const kept = [];
  for (const c of candidates) if (!covered(c, kept, tol.dupeM)) kept.push(c);

  const paths = kept
    .flatMap(p => clipToRadius(p, city.centre, city.clipKm))
    .filter(p => p.pts.length > 1);

  /* An end is a "clip" only if the radius made it. Otherwise it either meets
     another path of the same line ("junction") or it is where the line really
     stops ("terminus") — and only a clip end gets faded out by the page. A ring
     has no terminus: its two ends are each other. */
  const meets = (pt, self) => paths.some(o => o !== self && distToPath(pt, o.pts) <= tol.junctionM);
  const kind = (p, pt, cut) => cut ? "clip"
    : (metres(p.pts[0], p.pts[p.pts.length - 1]) <= tol.junctionM || meets(pt, p)) ? "junction"
    : "terminus";
  return {
    ref: line.ref, label: line.label, color: line.color,
    paths: paths.map(p => ({
      pts: p.pts,
      ends: [kind(p, p.pts[0], p.cutStart), kind(p, p.pts[p.pts.length - 1], p.cutEnd)],
    })),
  };
}

/* ---------- Overpass ---------- */

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

/** POST a query, trying each mirror. Throws if they all fail — a partial
    answer would quietly shrink the map, which is worse than stopping. */
export async function overpass(query, { retries = 2 } = {}){
  let last;
  for (let attempt = 0; attempt <= retries; attempt++){
    for (const url of MIRRORS){
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "data=" + encodeURIComponent(query),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e){
        last = e;
        process.stderr.write(`  ${new URL(url).host}: ${e.message}\n`);
      }
    }
    if (attempt < retries) await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
  }
  throw new Error(`every Overpass mirror failed: ${last && last.message}`);
}

/* ---------- misc ---------- */

export const argv = process.argv.slice(2);
export const flag = (name) => argv.includes("--" + name);
export const bbox = (pts) => pts.reduce((b, p) => [
  Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1]),
], [90, 180, -90, -180]).map(n => Number(n.toFixed(4)));
