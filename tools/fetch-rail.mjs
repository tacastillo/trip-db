#!/usr/bin/env node
/* Rebuild the vendored subway geometry (SUBWAY, SUBWAY_BUSAN) from OpenStreetMap.
   Data © OpenStreetMap contributors, ODbL.

     node tools/fetch-rail.mjs            # fetch and report, change nothing
     node tools/fetch-rail.mjs --write    # fetch and rewrite src/data/subway*.js
     node tools/fetch-rail.mjs --city busan --write

   The page never runs this. src/data/ ships with the geometry inside it; this
   is how that geometry gets refreshed when a line extends or a branch opens.

   Colours and labels are OURS, not OSM's — the `colour` tag is inconsistent
   across these relations, and the labels are what fits the legend. Only the
   geometry comes from the fetch, so editing a colour here is safe. */

import { readSource, saveSource, sourceFor, readConst, writeConst, serializeRail,
         overpass, buildLine, bbox, argv, flag } from "./lib.mjs";

const CITIES = {
  seoul: {
    constant: "SUBWAY",
    centre: [37.5665, 126.9780],
    clipKm: 40,
    /* `osm` is an Overpass tag filter, applied to route_master relations. If a
       line comes back empty, this is the line to fix — check the relation on
       osm.org and copy its tags. */
    lines: [
      { ref:"1",  label:"Line 1",           color:"#004A85", osm:'["ref"="1"]["network"~"Seoul",i]' },
      { ref:"2",  label:"Line 2",           color:"#00A23F", osm:'["ref"="2"]["network"~"Seoul",i]' },
      { ref:"3",  label:"Line 3",           color:"#ED6C00", osm:'["ref"="3"]["network"~"Seoul",i]' },
      { ref:"4",  label:"Line 4",           color:"#009BCE", osm:'["ref"="4"]["network"~"Seoul",i]' },
      { ref:"5",  label:"Line 5",           color:"#794698", osm:'["ref"="5"]["network"~"Seoul",i]' },
      { ref:"6",  label:"Line 6",           color:"#7C4932", osm:'["ref"="6"]["network"~"Seoul",i]' },
      { ref:"7",  label:"Line 7",           color:"#6E7E31", osm:'["ref"="7"]["network"~"Seoul",i]' },
      { ref:"9",  label:"Line 9",           color:"#A49D87", osm:'["ref"="9"]["network"~"Seoul",i]' },
      { ref:"SB", label:"Sinbundang",       color:"#B81B30", osm:'["name"~"신분당"]' },
      { ref:"B",  label:"Suin–Bundang",     color:"#ECA300", osm:'["name"~"수인.분당"]' },
      { ref:"GJ", label:"Gyeongui–Jungang", color:"#6AC2B3", osm:'["name"~"경의.중앙"]' },
    ],
  },
  busan: {
    constant: "SUBWAY_BUSAN",
    centre: [35.1796, 129.0756],
    clipKm: 40,
    lines: [
      { ref:"1", label:"Line 1", color:"#F06A00", osm:'["ref"="1"]["network"~"Busan",i]' },
      { ref:"2", label:"Line 2", color:"#81BF48", osm:'["ref"="2"]["network"~"Busan",i]' },
      { ref:"3", label:"Line 3", color:"#BB8C00", osm:'["ref"="3"]["network"~"Busan",i]' },
    ],
  },
};

const arg = (name, fallback) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

async function fetchLine(line){
  /* route_master → its child route relations → their ways, with coordinates.
     Asking for the master first is what keeps both directions and every branch
     together under one ref. Each child relation is kept as its own group:
     buildLine stitches inside a group, never across, because a branch shares
     its junction node with the line it joins. */
  const q = `[out:json][timeout:180];
relation["type"="route_master"]["route_master"~"subway|light_rail|train"]${line.osm};
rel(r);
out geom;`;
  const json = await overpass(q);
  const groups = [];
  for (const el of json.elements || []){
    const ways = [];
    for (const m of el.members || []){
      if (m.type !== "way" || !m.geometry) continue;
      if (m.role && !/^(forward|backward)$/.test(m.role)) continue;
      ways.push(m.geometry.map(g => [g.lat, g.lon]));
    }
    if (ways.length) groups.push(ways);
  }
  return groups;
}

const stats = (lines) => {
  const pts = lines.flatMap(l => l.paths.flatMap(p => p.pts));
  return { lines: lines.length, paths: lines.reduce((n, l) => n + l.paths.length, 0),
           points: pts.length, bbox: pts.length ? bbox(pts) : null };
};

async function main(){
  const only = arg("city", null);
  const targets = only ? [only] : Object.keys(CITIES);
  const touched = new Map();          // file -> its text, so two cities in one file both land

  for (const name of targets){
    const city = CITIES[name];
    if (!city) throw new Error(`unknown city "${name}" — have ${Object.keys(CITIES).join(", ")}`);
    console.log(`\n${name} → ${city.constant}`);

    const built = [];
    for (const line of city.lines){
      process.stdout.write(`  ${line.label.padEnd(18)} `);
      const groups = await fetchLine(line);
      if (!groups.length){
        /* Stopping beats writing a map with a line missing from it. */
        throw new Error(`${name} ${line.label}: Overpass returned no geometry for ${line.osm}. `
          + `Check the relation on openstreetmap.org and fix its \`osm\` filter in this file.`);
      }
      const l = buildLine(line, groups, city);
      built.push(l);
      console.log(`${String(groups.length).padStart(3)} relation(s) → ${l.paths.length} path(s), `
        + `${l.paths.reduce((n, p) => n + p.pts.length, 0)} pts`);
    }

    const file = sourceFor(city.constant);
    if (!touched.has(file)) touched.set(file, readSource(file));
    const before = stats(readConst(touched.get(file), city.constant)), after = stats(built);
    console.log(`  in the file: ${before.paths} paths / ${before.points} pts   bbox ${before.bbox}`);
    console.log(`  just fetched: ${after.paths} paths / ${after.points} pts   bbox ${after.bbox}`);

    if (flag("write"))
      touched.set(file, writeConst(touched.get(file), city.constant, serializeRail(built)));
    else touched.delete(file);
  }

  if (flag("write") && touched.size){
    for (const [file, text] of touched) saveSource(file, text);
    console.log(`\n${[...touched.keys()].join(", ")} updated — run \`node tools/check-data.mjs\`, then diff it.`);
  } else console.log("\nNothing written. Re-run with --write to update the data modules.");
}

main().catch(e => {
  console.error("\n" + e.message);
  console.error("\nNothing was written.");
  process.exit(1);
});
