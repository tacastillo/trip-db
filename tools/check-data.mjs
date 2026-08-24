#!/usr/bin/env node
/* Check that everything in index.html still agrees with everything else.

     node tools/check-data.mjs

   No network, no arguments. Run it after editing PLACES, after either fetch
   script, and before pushing. Exits non-zero if anything is wrong, so it works
   as a pre-push hook or a CI step.

   Most of these catch a failure the page itself will not report: a spot with a
   typo'd cluster still drops its pin, but never appears in the list. */

import { readIndex, readConst, sliceBetween, metres, distToPath } from "./lib.mjs";

const src = readIndex();
const K = (n) => readConst(src, n);
const [CATS, CAT_ORDER, CLUSTERS, PLACES, LEGS, SUBWAY, SUBWAY_BUSAN, ROUTES, PLACE_OFF,
       STATION_COORDS, HOTEL_STATION, AUTO_WALK_MAX] =
  ["CATS","CAT_ORDER","CLUSTERS","PLACES","LEGS","SUBWAY","SUBWAY_BUSAN","ROUTES","PLACE_OFF",
   "STATION_COORDS","HOTEL_STATION","AUTO_WALK_MAX"].map(K);

const PLAN_PARAMS = K("PLAN_PARAMS"), PLAN_MAX_STOPS = K("PLAN_MAX_STOPS");

const RAIL = { seoul: SUBWAY, busan: SUBWAY_BUSAN, jeju: [] };
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
const offFor = (p) => {                 // mirrors offStationFor() in index.html
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

/* tools/test-plan.mjs lifts the planner core out from between these. A missing
   sentinel means it tests an empty string and passes, which is worse than failing. */
for (const [a, b] of [["/* ==== plan-core:start ==== */", "/* ==== plan-core:end ==== */"],
                      ["/* ==== geo-core:start ==== */",  "/* ==== geo-core:end ==== */"]]){
  try {
    if (!sliceBetween(src, a, b).trim()) err(`nothing between ${a} and ${b}`);
  } catch (e){ err(e.message); }
}

/* The spec block is what an agent reads when it cannot run the page. A spec that has
   drifted from the code is worse than no spec at all. */
const spec = /<script type="application\/json" id="plan-url-spec">([\s\S]*?)<\/script>/.exec(src);
if (!spec) err("no #plan-url-spec block in index.html");
else {
  try {
    const documented = Object.keys(JSON.parse(spec[1]).params || {}).sort().join();
    const real = Object.values(PLAN_PARAMS).sort().join();
    if (documented !== real)
      err(`#plan-url-spec documents ${documented} but PLAN_PARAMS is ${real}`);
  } catch (e){ err(`#plan-url-spec is not valid JSON: ${e.message}`); }
}

/* ---------- verdict ---------- */
console.log();
for (const w of warnings) console.log("warning: " + w);
for (const e of errors)   console.log("ERROR:   " + e);
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
