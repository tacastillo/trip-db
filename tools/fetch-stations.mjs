#!/usr/bin/env node
/* Refresh STATION_COORDS from OpenStreetMap. Data © OpenStreetMap contributors, ODbL.

     node tools/fetch-stations.mjs                # report drift, change nothing
     node tools/fetch-stations.mjs --write        # update the coordinates we already have
     node tools/fetch-stations.mjs --add --write  # also add stations we don't have yet
     node tools/fetch-stations.mjs --city busan --add --write

   This MERGES. It never renames and never deletes, because the station names in
   STATION_COORDS are keys: ROUTES is keyed by them and PLACE_OFF points at them,
   and OSM's English names drift (Jongno 3-ga is "Jongno 3(sam)-ga" there). A
   station it cannot match is reported and left exactly as it was — the tables
   stay valid and you decide what to do. */

import { readIndex, saveIndex, readConst, writeConst, serializeStations,
         overpass, metres, argv, flag } from "./lib.mjs";

const MOVED_M = 40;   // report a station that has shifted further than this

const CITIES = {
  seoul: { centre: [37.5665, 126.9780], radiusKm: 40 },
  busan: { centre: [35.1796, 129.0756], radiusKm: 40 },
};

const arg = (name, fallback) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

/* "Jongno 3(sam)-ga Station" and "Jongno 3-ga" should meet in the middle. */
const norm = (s) => s.toLowerCase()
  .replace(/\([^)]*\)/g, "")
  .replace(/\bstation\b/g, "")
  .replace(/[^a-z0-9]/g, "");

async function main(){
  const city = CITIES[arg("city", "seoul")];
  if (!city) throw new Error(`unknown city — have ${Object.keys(CITIES).join(", ")}`);

  const q = `[out:json][timeout:180];
(
  node["railway"="station"]["station"="subway"](around:${city.radiusKm * 1000},${city.centre[0]},${city.centre[1]});
  node["railway"="station"]["subway"="yes"](around:${city.radiusKm * 1000},${city.centre[0]},${city.centre[1]});
);
out tags center;`;

  console.log(`querying Overpass for stations within ${city.radiusKm}km of ${city.centre}…`);
  const json = await overpass(q);

  const found = new Map();                       // normalised name → { name, coord }
  for (const el of json.elements || []){
    const t = el.tags || {};
    const name = t["name:en"] || t.name;
    if (!name || el.lat == null) continue;
    found.set(norm(name), { name, coord: [el.lat, el.lon] });
  }
  console.log(`  ${found.size} stations found\n`);

  const src = readIndex();
  const coords = readConst(src, "STATION_COORDS");
  const routes = readConst(src, "ROUTES");
  const next = {}, moved = [], missing = [], added = [];

  for (const [name, was] of Object.entries(coords)){
    const hit = found.get(norm(name));
    if (!hit){ next[name] = was; missing.push(name); continue; }
    const d = metres(was, hit.coord);
    next[name] = hit.coord;
    if (d > MOVED_M) moved.push(`${name}: ${Math.round(d)}m (${hit.name})`);
  }

  if (flag("add")){
    const have = new Set(Object.keys(coords).map(norm));
    for (const [key, hit] of found)
      if (!have.has(key)){ next[hit.name] = hit.coord; added.push(hit.name); }
  }

  const report = (title, rows, note) => {
    if (!rows.length) return;
    console.log(`${title} (${rows.length})${note ? " — " + note : ""}`);
    rows.slice(0, 40).forEach(r => console.log("  · " + r));
    if (rows.length > 40) console.log(`  … and ${rows.length - 40} more`);
    console.log();
  };

  report("moved", moved, "coordinates updated");
  report("no match in OSM", missing, "left untouched; rename by hand if a station really was renamed");
  report("added", added);
  if (!flag("add") && !added.length){
    const have = new Set(Object.keys(coords).map(norm));
    const n = [...found.keys()].filter(k => !have.has(k)).length;
    if (n) console.log(`${n} stations are in OSM but not in the file — re-run with --add to include them.\n`);
  }

  /* A station that ROUTES names must keep existing, whatever else happens. */
  const orphaned = Object.keys(routes).filter(s => !next[s]);
  if (orphaned.length) throw new Error(`refusing to write: ROUTES needs ${orphaned.join(", ")}`);

  if (flag("write")){
    saveIndex(writeConst(src, "STATION_COORDS", serializeStations(next)));
    console.log(`index.html updated — ${Object.keys(next).length} stations. `
      + `Run \`node tools/check-data.mjs\`, then diff it.`);
  } else {
    console.log("Nothing written. Re-run with --write to update index.html.");
  }
}

main().catch(e => {
  console.error("\n" + e.message);
  console.error("\nNothing was written.");
  process.exit(1);
});
