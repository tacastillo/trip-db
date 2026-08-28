#!/usr/bin/env node
/* Check that everything in src/ still agrees with everything else.

     node tools/check-data.mjs

   No network, no arguments. Run it after editing PLACES, after either fetch
   script, and before pushing. Exits non-zero if anything is wrong, so it works
   as a pre-push hook or a CI step.

   Most of these catch a failure the page itself will not report: a spot with a
   typo'd cluster still drops its pin, but never appears in the list. */

import { DOW, closedFromHours, parseHours } from "../src/lib/hours.js";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, metres, distToPath } from "./lib.mjs";
import { CATS, CAT_ORDER, CLUSTERS, PLACES, LEGS, TRIP } from "../src/data/places.js";
import { SUBWAY } from "../src/data/subway.js";
import { SUBWAY_BUSAN } from "../src/data/subway-busan.js";
import { RAIL } from "../src/data/rail.js";
import { ROUTES, PLACE_OFF, STATION_COORDS, HOTEL_STATION, AUTO_WALK_MAX } from "../src/data/routing.js";
import { PLAN_PARAMS, PLAN_MAX_STOPS, planDow, legForDate, tripDays } from "../src/lib/plan-core.js";
import { offlinePack } from "../src/lib/tiles.js";
import { ICONS } from "../src/data/icons.js";
import SPEC from "../src/data/plan-url-spec.json" with { type: "json" };
const CITY_BOX = {                      // generous, just to catch a transposed pair
  seoul: [37.2, 126.6, 37.9, 127.5],
  busan: [34.9, 128.7, 35.5, 129.4],
  jeju:  [33.1, 126.1, 33.7, 127.0],
};
const STATION_ON_LINE_M = 400;          // a station should sit on the line that serves it

const errors = [], warnings = [];
const err  = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

/* ---------- the place list ---------- */
const ids = new Set();
const legIds = new Set(LEGS.map(l => l.id));
for (const p of PLACES){
  const at = `${p.id || "(no id)"}`;
  if (!p.id) err(`a place has no id: ${p.name}`);
  else if (ids.has(p.id)) err(`duplicate id: ${p.id}`);
  ids.add(p.id);
  if (!p.name) err(`${at}: no name`);
  if (!legIds.has(p.city)) err(`${at}: city "${p.city}" is not one of ${[...legIds].join(", ")}`);
  if (!CATS[p.cat]) err(`${at}: cat "${p.cat}" is not in CATS`);
  // the list is built by walking CLUSTERS, so an unlisted cluster is invisible there
  if (!(CLUSTERS[p.city] || []).includes(p.cluster))
    err(`${at}: cluster "${p.cluster}" is missing from CLUSTERS.${p.city} — the pin shows, the list row does not`);
  const box = CITY_BOX[p.city];
  if (box && !(p.lat >= box[0] && p.lat <= box[2] && p.lng >= box[1] && p.lng <= box[3]))
    err(`${at}: ${p.lat},${p.lng} is outside ${p.city}`);
}

/* ---------- the category and cluster tables ---------- */
for (const k of CAT_ORDER) if (!CATS[k]) err(`CAT_ORDER has "${k}", CATS does not`);
for (const k of Object.keys(CATS)) if (!CAT_ORDER.includes(k)) err(`CATS has "${k}", CAT_ORDER does not — it will never be shown`);
for (const c of Object.keys(CLUSTERS)) if (!legIds.has(c)) err(`CLUSTERS has "${c}", which is not a leg`);
for (const [cityId, list] of Object.entries(CLUSTERS))
  for (const cl of list)
    if (!PLACES.some(p => p.city === cityId && p.cluster === cl)) warn(`CLUSTERS.${cityId} lists "${cl}", which has no places`);

/* ---------- the rail data ---------- */
for (const [cityId, lines] of Object.entries(RAIL)){
  const refs = new Set();
  for (const l of lines){
    if (refs.has(l.ref)) err(`${cityId} rail: two lines share ref "${l.ref}"`);
    refs.add(l.ref);
    if (!l.label || !l.color) err(`${cityId} line ${l.ref}: missing label or color`);
    for (const [i, p] of l.paths.entries()){
      if (!p.pts || p.pts.length < 2) err(`${cityId} line ${l.ref} path ${i}: fewer than 2 points`);
      if (!p.ends || p.ends.length !== 2) err(`${cityId} line ${l.ref} path ${i}: ends must have exactly 2 entries`);
      else for (const e of p.ends)
        if (!["clip", "terminus", "junction"].includes(e))
          err(`${cityId} line ${l.ref} path ${i}: unknown end "${e}"`);
    }
  }
}

/* ---------- the routing tables ---------- */
const lineRef = (ref) => SUBWAY.find(l => l.ref === ref);
const distToLine = (coord, ref) => {
  const l = lineRef(ref);
  if (!l) return Infinity;
  return Math.min(...l.paths.map(p => distToPath(coord, p.pts)));
};

if (!STATION_COORDS[HOTEL_STATION]) err(`HOTEL_STATION "${HOTEL_STATION}" has no coordinates`);

for (const [id, station] of Object.entries(PLACE_OFF)){
  if (!ids.has(id)) err(`PLACE_OFF has "${id}", which is not a place`);
  if (!STATION_COORDS[station]) err(`PLACE_OFF ${id} → "${station}" has no coordinates`);
  if (!ROUTES[station]) err(`PLACE_OFF ${id} → "${station}" has no ROUTES entry, so it draws nothing`);
}

for (const [station, legs] of Object.entries(ROUTES)){
  if (!legs.length){ err(`ROUTES "${station}" is empty`); continue; }
  if (legs[legs.length - 1].to !== station)
    err(`ROUTES "${station}" ends at "${legs[legs.length - 1].to}" — the last leg must end at the key`);
  for (const leg of legs){
    if (!lineRef(leg.line)) err(`ROUTES "${station}": line "${leg.line}" is not in SUBWAY`);
    if (!STATION_COORDS[leg.to]) err(`ROUTES "${station}": "${leg.to}" has no coordinates`);
    else {
      const d = distToLine(STATION_COORDS[leg.to], leg.line);
      if (d > STATION_ON_LINE_M)
        err(`ROUTES "${station}": ${leg.to} is ${Math.round(d)}m from line ${leg.line} — wrong line, or bad coordinates`);
    }
  }
  // you board at the hotel, so the first leg has to run past it
  const d = distToLine(STATION_COORDS[HOTEL_STATION], legs[0].line);
  if (d > STATION_ON_LINE_M)
    err(`ROUTES "${station}": you cannot board line ${legs[0].line} at ${HOTEL_STATION} (${Math.round(d)}m away)`);
}

/* A route that goes out and doubles back reads as nonsense on the map, and
   nothing else here catches it: every leg is on a real line, the transfer is a
   real transfer, the drawn track is the real track. Compare the hotel → transfers
   → destination dogleg against the straight line and let a human judge. Both
   guards matter — the ratio alone flags a one-stop hop that is barely a detour,
   the extra metres alone flag a long ride that goes nowhere odd. A ring line
   never trips this: Line 2 the long way round has no transfer to bend at. */
const DOGLEG_RATIO = 1.8, DOGLEG_EXTRA_M = 1500;
for (const [station, legs] of Object.entries(ROUTES)){
  if (!STATION_COORDS[station] || !STATION_COORDS[HOTEL_STATION]) continue;
  if (legs.some(l => !STATION_COORDS[l.to])) continue;
  let from = HOTEL_STATION, via = 0;
  for (const leg of legs){ via += metres(STATION_COORDS[from], STATION_COORDS[leg.to]); from = leg.to; }
  const direct = metres(STATION_COORDS[HOTEL_STATION], STATION_COORDS[station]);
  if (via > direct * DOGLEG_RATIO && via - direct > DOGLEG_EXTRA_M)
    warn(`ROUTES "${station}" doubles back: ${legs.map(l => l.line + "\u2192" + l.to).join(", ")} `
       + `covers ${Math.round(via)}m of ground to reach a station ${Math.round(direct)}m away`);
}

for (const s of Object.keys(STATION_COORDS))
  if (s !== HOTEL_STATION && !ROUTES[s] && !Object.values(ROUTES).some(legs => legs.some(l => l.to === s)))
    warn(`STATION_COORDS has "${s}", which no route uses — the nearest-station fallback ignores it`);

/* ---------- what actually gets a ride ---------- */
const offFor = (p) => {                 // mirrors offStationFor() in src/lib/journey.js
  if (PLACE_OFF[p.id]) return PLACE_OFF[p.id];
  if (p.cat === "hotel") return null;
  let best = null;
  for (const s in STATION_COORDS){
    if (!ROUTES[s]) continue;
    const d = metres([p.lat, p.lng], STATION_COORDS[s]);
    if (!best || d < best.d) best = { s, d };
  }
  return best && best.d <= AUTO_WALK_MAX ? best.s : null;
};

console.log("coverage");
for (const leg of LEGS){
  const here = PLACES.filter(p => p.city === leg.id);
  const routed = here.filter(p => offFor(p) && ROUTES[offFor(p)]);
  const hotels = here.filter(p => p.cat === "hotel").length;
  console.log(`  ${leg.label.padEnd(6)} ${String(routed.length).padStart(3)}/${String(here.length).padEnd(3)} spots draw a ride`
    + (hotels ? `  (${hotels} hotel${hotels > 1 ? "s" : ""}, where the ride starts)` : "")
    + (RAIL[leg.id].length ? "" : "  — no rail data for this leg"));
}
const walks = PLACES.filter(p => !PLACE_OFF[p.id] && offFor(p))
  .map(p => metres([p.lat, p.lng], STATION_COORDS[offFor(p)]));
if (walks.length)
  console.log(`  ${walks.length} of those picked a station automatically; longest walk ${Math.round(Math.max(...walks))}m of ${AUTO_WALK_MAX}m allowed`);

/* ---------- what the day planner leans on ---------- */
/* A plan is a list of place ids in the query string, so an id has to survive being
   written there verbatim — that is what keeps the link readable to a person and to
   an agent that cannot run the page. */
for (const p of PLACES){
  if (p.id && !/^[a-z0-9-]+$/.test(p.id))
    err(`${p.id}: plan ids go into the URL as-is, so they must be lowercase letters, digits and dashes`);
}

/* The fields synced from the trip database. `hours` is the one piece of structured
   schedule on this map — if a string here stops parsing, the card quietly falls back to
   printing it and the planner stops warning, so fail the build instead. */
const HANGUL = /[가-힣]/;
for (const p of PLACES){
  const at = p.id || p.name;
  if (p.hours && !parseHours(p.hours))
    err(`${at}: hours "${p.hours}" does not parse — see the grammar in src/lib/hours.js`);
  if (p.closed !== undefined){
    if (!Array.isArray(p.closed)) err(`${at}: closed must be an array of weekday keys`);
    else for (const d of p.closed)
      if (!DOW.includes(d)) err(`${at}: closed has "${d}", which is not one of ${DOW.join(", ")}`);
  }
  if (p.hours && Array.isArray(p.closed)){
    const fromHours = closedFromHours(p.hours);
    if (fromHours && String([...fromHours].sort()) !== String([...p.closed].sort()))
      err(`${at}: closed ${JSON.stringify(p.closed)} disagrees with hours "${p.hours}"`);
  }
  if (p.ko !== undefined && !HANGUL.test(p.ko))
    err(`${at}: ko "${p.ko}" has no hangul in it`);
  /* The whole point of the ko field: the bold line of a list row is for the name you can
     read. A parenthetical creeping back into `name` would undo that silently. */
  if (HANGUL.test(p.name || ""))
    err(`${at}: name "${p.name}" contains hangul — that belongs in ko`);
  if (p.signature !== undefined && typeof p.signature !== "string")
    err(`${at}: signature must be a string`);
}

/* Every leg needs exactly one hotel: it is what the planner offers as a day's start. */
for (const leg of LEGS){
  const hotels = PLACES.filter(p => p.city === leg.id && p.cat === "hotel");
  if (hotels.length !== 1)
    err(`${leg.id} has ${hotels.length} hotels; a day starts at the one hotel for its leg`);
}

/* The longest plan anyone can build still has to be a link you can paste. */
const widest = PLACES.map(p => p.id.length).sort((a, b) => b - a)
  .slice(0, PLAN_MAX_STOPS).reduce((a, b) => a + b + 1, 0);
if (widest > 1500) err(`${PLAN_MAX_STOPS} of the longest ids is ${widest} characters of query string`);

/* ---------- the calendar ---------- */
/* The day picker offers these dates and legForDate() routes a date to a leg, so a span
   that has drifted from the dates on the tab is a day plan quietly filed under the
   wrong city. Nothing else would notice. */
if (!planDow(TRIP.start) || !planDow(TRIP.end)) err(`TRIP is ${TRIP.start}..${TRIP.end}, which is not two dates`);
else if (TRIP.start >= TRIP.end) err(`TRIP starts on ${TRIP.start} and ends on ${TRIP.end}`);
for (const leg of LEGS){
  if (!leg.spans || !leg.spans.length){ err(`${leg.id} has no date spans, so no date can land in it`); continue; }
  for (const [a, b] of leg.spans){
    if (!planDow(a) || !planDow(b)) err(`${leg.id}: span ${a}..${b} is not two dates`);
    else if (a > b) err(`${leg.id}: span ${a}..${b} runs backwards`);
    else if (a < TRIP.start || b > TRIP.end) err(`${leg.id}: span ${a}..${b} falls outside the trip (${TRIP.start}..${TRIP.end})`);
  }
}
{
  const days = tripDays();
  const placed = days.filter(d => d.leg).length;
  const orphans = days.filter(d => !d.leg).map(d => d.day);
  if (!days.length) err("the trip window covers no days at all");
  if (orphans.length > 2) warn(`${orphans.length} trip days belong to no leg: ${orphans.join(", ")}`);
  for (const leg of LEGS)
    if (!days.some(d => d.leg === leg.id))
      err(`no date in the trip resolves to ${leg.id} — legForDate() would never pick it`);
  console.log(`\n  ${days.length} trip days, ${placed} of them in a leg`
    + (orphans.length ? ` (${orphans.join(", ")} travelling)` : ""));
}

/* ---------- what ships offline ---------- */
/* public/sw.js is copied to the site verbatim and precaches a list of files by hand,
   because it is not bundled and nothing rewrites those paths. Rename a vendored font
   and the page still builds, still works online, and quietly stops working offline. */
{
  const sw = readFileSync(join(ROOT, "public/sw.js"), "utf8");
  const listed = [...sw.matchAll(/^\s*"\.\/([^"]*)",\s*$/gm)].map(m => m[1]).filter(Boolean);
  if (listed.length < 10) err("public/sw.js lists almost nothing to precache — has SHELL_FILES moved?");
  for (const f of listed){
    if (f === "index.html") continue;                  // built, not committed
    try { readFileSync(join(ROOT, "public", f)); }
    catch (e){ err(`public/sw.js precaches "${f}", which is not in public/`); }
  }
  const mf = JSON.parse(readFileSync(join(ROOT, "public/manifest.webmanifest"), "utf8"));
  if (mf.start_url !== "./index.html") err(`the manifest starts at ${mf.start_url}; build.format is "file", so it has to be ./index.html`);
  for (const icon of mf.icons || [])
    try { readFileSync(join(ROOT, "public", icon.src.replace(/^\.\//, ""))); }
    catch (e){ err(`the manifest names an icon that is not there: ${icon.src}`); }
  for (const leg of LEGS){
    const n = offlinePack(PLACES.filter(p => p.city === leg.id)).length;
    if (n > 2500) err(`${leg.id}'s offline tile pack is ${n} tiles — too much to ask anyone to download`);
    console.log(`  ${leg.label.padEnd(6)} offline pack: ${String(n).padStart(4)} tiles, roughly ${Math.round(n * 18 / 1024)} MB`);
  }
}

/* src/lib/ is the half of the code the node tests can run, and it can only stay that
   way while nothing in it reaches for the page. The single-file page fenced this off
   with a pair of sentinel comments; a directory does it better, but only if someone
   checks — nothing else would notice a document. creeping in here. */
const IMPURE = /(?<![.\w])(document|window|location|history|localStorage|navigator)\b/g;
for (const f of readdirSync(join(ROOT, "src/lib"))){
  const text = readFileSync(join(ROOT, "src/lib", f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const hits = [...new Set(text.match(IMPURE) || [])];
  if (hits.length) err(`src/lib/${f} touches the page (${hits.join(", ")}) — that belongs in src/client/`);
}

/* ---------- the design tokens ----------
   styles/tokens.css is meant to be the only place a colour, a shadow, an icon size or a
   tap target is written down, so that swapping the palette is one edit rather than a
   hunt through eight stylesheets and a dozen modules. That is a convention, and a
   convention nobody checks lasts about a fortnight — so this checks it. */
{
  const tokensPath = "src/styles/tokens.css";
  const css = readFileSync(join(ROOT, tokensPath), "utf8");
  /* the two theme blocks, read as declarations: :root (day) and body.night */
  const block = (sel) => {
    const out = {};
    const re = new RegExp(`${sel}\\s*\\{([^}]*)\\}`, "g");
    for (const m of css.matchAll(re))
      for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim();
    return out;
  };
  const day = block(":root"), night = { ...day, ...block("body\\.night") };
  /* one level of var() is all the palette needs: --paper is var(--cream) is a hex */
  const hex = (vars, name) => {
    const v = (vars[name] || "").trim();
    const via = v.match(/^var\((--[\w-]+)\)$/);
    return (via ? (vars[via[1]] || "").trim() : v).toUpperCase();
  };

  for (const k of CAT_ORDER)
    if (!day[`--cat-${k}`])
      err(`no --cat-${k} in ${tokensPath} — a category names its own colour token, see catVar() in src/lib/design.js`);

  /* Four things cannot read a stylesheet: the two <meta name="theme-color"> tags, the
     manifest and the launcher icon. They are the only colours outside tokens.css, and
     this is what stops them going stale the next time the palette changes — which is
     exactly what had happened to all four of them. */
  const nightPaper = hex(night, "--paper"), dayPaper = hex(day, "--paper");
  const nightAccent = hex(night, "--accent");
  const layout = readFileSync(join(ROOT, "src/layouts/FieldMap.astro"), "utf8");
  const meta = (scheme) => (layout.match(
    new RegExp(`<meta name="theme-color" content="(#[0-9A-Fa-f]{6})" media="\\(prefers-color-scheme: ${scheme}\\)"`)) || [])[1];
  if ((meta("dark") || "").toUpperCase() !== nightPaper)
    err(`FieldMap.astro's dark theme-color is ${meta("dark")}; night --paper is ${nightPaper}`);
  if ((meta("light") || "").toUpperCase() !== dayPaper)
    err(`FieldMap.astro's light theme-color is ${meta("light")}; day --paper is ${dayPaper}`);
  const mf2 = JSON.parse(readFileSync(join(ROOT, "public/manifest.webmanifest"), "utf8"));
  for (const k of ["background_color", "theme_color"])
    if ((mf2[k] || "").toUpperCase() !== nightPaper)
      err(`the manifest's ${k} is ${mf2[k]}; night --paper is ${nightPaper}`);
  const svg = readFileSync(join(ROOT, "public/icon.svg"), "utf8");
  const svgHex = [...svg.matchAll(/(?:fill|stroke)="(#[0-9A-Fa-f]{6})"/g)].map(m => m[1].toUpperCase());
  for (const h of svgHex)
    if (![nightPaper, nightAccent, hex(night, "--line")].includes(h))
      err(`public/icon.svg paints ${h}, which is not the night paper, accent or line — the launcher icon is the trip's palette, not its own`);

  /* And the other half of the same rule: nothing else may hold one. */
  const LITERAL = /#[0-9A-Fa-f]{3,8}\b|\brgba?\(/;
  const sheets = readdirSync(join(ROOT, "src/styles")).filter(f => f !== "tokens.css");
  for (const f of sheets){
    const text = readFileSync(join(ROOT, "src/styles", f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const hit = text.split("\n").findIndex(l => LITERAL.test(l));
    if (hit >= 0) err(`src/styles/${f}:${hit + 1} writes a colour — every colour is a token in ${tokensPath}`);
  }
  for (const f of readdirSync(join(ROOT, "src/client"))){
    const text = readFileSync(join(ROOT, "src/client", f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const hit = text.split("\n").findIndex(l => LITERAL.test(l));
    if (hit >= 0) err(`src/client/${f}:${hit + 1} writes a colour — read it from a token through cssVar() in client/theme.js`);
  }
}

/* Every category draws an icon, and an icon name that is not in the generated table
   renders nothing at all — a pin with an empty middle, a legend chip with a gap, and
   no error anywhere. src/data/icons.js is generated by tools/fetch-icons.mjs; this is
   what notices when CATS names something that run never wrote. */
for (const [k, c] of Object.entries(CATS)){
  if (!c.icon) err(`CATS.${k} has no icon`);
  else if (!ICONS[c.icon]) err(`CATS.${k} draws icon "${c.icon}", which is not in src/data/icons.js — add it to STREAMLINE in tools/fetch-icons.mjs and re-run it`);
  if (!c.emoji) err(`CATS.${k} has no emoji — planShareText() falls back to it when a day is copied out as a message`);
}

/* The spec is what an agent reads when it cannot run the page. One that has drifted
   from the code is worse than no spec at all. */
const documented = Object.keys(SPEC.params || {}).sort().join();
const real = Object.values(PLAN_PARAMS).sort().join();
if (documented !== real)
  err(`plan-url-spec.json documents ${documented} but PLAN_PARAMS is ${real}`);

/* ---------- verdict ---------- */
console.log();
for (const w of warnings) console.log("warning: " + w);
for (const e of errors)   console.log("ERROR:   " + e);
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
