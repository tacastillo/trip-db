#!/usr/bin/env node
/* Refresh HOODS from OpenStreetMap admin boundaries. Data © OpenStreetMap
   contributors, ODbL.

     node tools/fetch-hoods.mjs                 # report matches, change nothing
     node tools/fetch-hoods.mjs --write         # rewrite the source:"osm" entries
     node tools/fetch-hoods.mjs --city jeju --write

   Each cluster maps to the administrative dongs (or eup/myeon on Jeju) that
   cover the day's area; the polygon a cluster draws is those boundaries'
   outer rings, simplified. This MERGES: only entries whose source is "osm"
   are ever rewritten. source:"hand" entries are areas OSM cannot represent
   (a park, a hillside village, a shopping street) and are left alone, as is
   any cluster whose boundaries could not all be matched — the hand-drawn
   hull it shipped with keeps drawing. Boundary names are matched in Korean,
   which does not drift the way OSM's romanisations do; a name that appears
   twice in the radius (Sinsa-dong exists in two gu) is settled by which
   candidate sits nearest the cluster's own pins. */

import { readIndex, saveIndex, readConst, writeConst, serializeHoods,
         overpass, metres, simplify, stitch, argv, flag } from "./lib.mjs";

const SIMPLIFY_M = 60;      // ring tolerance; the shapes are shading, not survey
const SLIVER_KM2 = 0.2;     // drop islets and mapping debris below this area
const CLOSE_M = 150;        // a stitched ring whose ends sit this close is closed

const CITIES = {
  seoul: { centre: [37.5665, 126.9780], radiusKm: 25 },
  busan: { centre: [35.1600, 129.0600], radiusKm: 35 },
  jeju:  { centre: [33.3800, 126.5500], radiusKm: 50 },
};

/* cluster → the Korean names of the admin boundaries that cover it.
   { park: "…" } targets a boundary=national_park relation instead. */
const BOUNDARIES = {
  seoul: {
    "Dongdaemun · home base": ["광희동", "을지로동", "장충동"],
    "Jongno · palaces & Ikseon-dong": ["청운효자동", "사직동", "삼청동", "가회동", "종로1·2·3·4가동", "종로5·6가동"],
    "Gangnam · Sinsa · COEX": ["신사동", "압구정동", "논현1동", "논현2동", "청담동", "역삼1동", "삼성1동", "삼성2동"],
    "Seongsu · Seoul Forest": ["성수1가1동", "성수1가2동", "성수2가1동", "성수2가3동", "마장동", "화양동"],
    "Hongdae · Yeonnam · Mangwon": ["서교동", "합정동", "망원1동", "망원2동", "연남동", "신촌동"],
    "Hannam · Itaewon": ["한남동", "이태원1동", "이태원2동"],
    "Yeouido": ["여의동"],
  },
  busan: {
    "Haeundae · Marine City": ["우1동", "우2동", "중1동", "중2동"],
    "Gwangalli · Suyeong": ["광안1동", "광안2동", "광안3동", "광안4동", "민락동", "남천1동", "남천2동"],
    "Seomyeon · Jeonpo": ["부전1동", "부전2동", "전포1동", "전포2동"],
  },
  jeju: {
    "Jeju City · Dongmun": ["일도1동", "삼도2동", "건입동", "연동", "노형동"],
    "Aewol · West coast": ["애월읍", "한림읍"],
    "Seogwipo · South": ["송산동", "천지동", "정방동", "중앙동", "동홍동"],
    "Jungmun · Southwest": ["중문동", "안덕면", "대정읍"],
    "Hallasan · Central": [{ park: "한라산" }],
    "East · Hamdeok & Seongsan": ["조천읍", "구좌읍", "성산읍"],
  },
};

const arg = (name, fallback) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

/** Outer rings of one relation from `out geom` members: stitch, close, prune. */
function relationRings(rel){
  const ways = (rel.members || [])
    .filter(m => m.type === "way" && (m.role === "outer" || !m.role) && m.geometry)
    .map(m => m.geometry.map(g => [g.lat, g.lon]));
  return stitch(ways, 30)
    .filter(p => p.length > 3 && metres(p[0], p[p.length - 1]) <= CLOSE_M)
    .filter(p => ringAreaKm2(p) >= SLIVER_KM2)
    .map(p => simplify(p, SIMPLIFY_M))
    .filter(p => p.length > 3);
}

function ringAreaKm2(ring){
  const lat0 = ring[0][0];
  const mLat = 111320, mLng = 111320 * Math.cos(lat0 * Math.PI / 180);
  let a = 0;
  for (let i = 0; i < ring.length; i++){
    const [y1, x1] = ring[i], [y2, x2] = ring[(i + 1) % ring.length];
    a += (x1 * mLng) * (y2 * mLat) - (x2 * mLng) * (y1 * mLat);
  }
  return Math.abs(a / 2) / 1e6;
}

const centroid = (pts) => [
  pts.reduce((s, p) => s + p[0], 0) / pts.length,
  pts.reduce((s, p) => s + p[1], 0) / pts.length,
];

async function main(){
  const cityId = arg("city", null);
  const cities = cityId ? [cityId] : Object.keys(BOUNDARIES);
  if (cityId && !BOUNDARIES[cityId]) throw new Error(`unknown city — have ${Object.keys(BOUNDARIES).join(", ")}`);

  let src = readIndex();
  const hoods = readConst(src, "HOODS");
  const places = readConst(src, "PLACES");
  const matched = [], unmatched = [], skipped = [];
  let points = 0;

  for (const id of cities){
    const city = CITIES[id];
    const table = BOUNDARIES[id];
    const names = [...new Set(Object.values(table).flat().filter(n => typeof n === "string"))];
    const parks = Object.values(table).flat().filter(n => typeof n === "object").map(n => n.park);

    const q = `[out:json][timeout:180];
(
  rel["boundary"="administrative"]["name"~"^(${names.join("|")})$"](around:${city.radiusKm * 1000},${city.centre[0]},${city.centre[1]});
  ${parks.map(p => `rel["boundary"="national_park"]["name"~"${p}"](around:${city.radiusKm * 1000},${city.centre[0]},${city.centre[1]});`).join("\n  ")}
);
out tags geom;`;
    console.log(`${id}: querying Overpass for ${names.length + parks.length} boundaries…`);
    const json = await overpass(q);
    const rels = json.elements || [];
    console.log(`  ${rels.length} relations returned`);

    for (const h of hoods[id] || []){
      const want = table[h.cluster];
      if (!want){ skipped.push(`${id} "${h.cluster}" — no boundary mapping, left as-is`); continue; }
      if (h.source !== "osm"){ skipped.push(`${id} "${h.cluster}" — source:"${h.source}", never touched`); continue; }

      const pins = places.filter(p => p.city === id && p.cluster === h.cluster).map(p => [p.lat, p.lng]);
      const anchor = pins.length ? centroid(pins) : city.centre;
      const rings = [], misses = [];

      for (const target of want){
        const name = typeof target === "object" ? target.park : target;
        const cands = rels.filter(r => (r.tags || {}).name && r.tags.name.includes(name));
        if (!cands.length){ misses.push(name); continue; }
        // the homonym rule: the candidate whose rings sit nearest the cluster's pins wins
        const best = cands
          .map(r => ({ r, rings: relationRings(r) }))
          .filter(c => c.rings.length)
          .sort((a, b) => metres(centroid(a.rings[0]), anchor) - metres(centroid(b.rings[0]), anchor))[0];
        if (!best){ misses.push(`${name} (no closed outer ring)`); continue; }
        rings.push(...best.rings);
      }

      if (misses.length || !rings.length){
        unmatched.push(`${id} "${h.cluster}" — missing ${misses.join(", ") || "everything"}; hand hull kept`);
        continue;
      }
      h.rings = rings;
      points += rings.reduce((s, r) => s + r.length, 0);
      matched.push(`${id} "${h.cluster}" — ${rings.length} ring(s), ${rings.reduce((s, r) => s + r.length, 0)} pts`);
    }
  }

  const report = (title, rows) => {
    if (!rows.length) return;
    console.log(`\n${title} (${rows.length})`);
    rows.forEach(r => console.log("  · " + r));
  };
  report("updated from OSM", matched);
  report("left alone", [...unmatched, ...skipped]);
  console.log(`\n${points} boundary points in the updated entries`);

  if (flag("write")){
    saveIndex(writeConst(src, "HOODS", serializeHoods(hoods)));
    console.log(`index.html updated. Run \`node tools/check-data.mjs\`, then diff it.`);
  } else {
    console.log("Nothing written. Re-run with --write to update index.html.");
  }
}

main().catch(e => {
  console.error("\n" + e.message);
  console.error("\nNothing was written.");
  process.exit(1);
});
