#!/usr/bin/env node
/**
 * Rebuilds the CLUSTERS + PLACES literals in index.html from the data/ files.
 *
 * Runs with no network and no secrets, so the page can be rebuilt and tested from the
 * committed snapshot alone. Only the text between the PLACES:START/END markers is touched.
 *
 *   node scripts/build-page.mjs [--check]
 *
 * --check exits 1 if the page is out of date instead of writing it (for CI).
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = join(ROOT, "index.html");
const START = "/* PLACES:START";
const END = "/* PLACES:END */";
const NEW_DAYS = 14; // a row created this recently gets the "new" tag

const read = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

/** Notion Name -> pin id. Ids are internal to the page (marker keys), never persisted. */
export function slug(name) {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "place"
  );
}

/** "Walk-in" is the default and earns no badge; the rest are worth surfacing on the pin. */
function metaFor(row) {
  const r = row.reservation;
  if (!r || r === "Walk-in") return null;
  if (r === "Recommended") return "Reserve or queue";
  return r; // Catchtable, KakaoTalk
}

function clusterFor(row, city, map, report) {
  // clusterByPlace wins: Notion's Neighborhood is a multi-select that often lists a chain's
  // branches rather than where this row's coordinates actually are (Eulji Darak is tagged
  // Cheongdam/Seongsu/Garosugil but its pin is in Euljiro), so an explicit entry beats it.
  const byName = map.clusterByPlace[row.name];
  if (byName) return byName;
  for (const n of row.neighborhoods || []) {
    const c = map.neighborhoodToCluster[n];
    if (c) return c;
    report.unmappedNeighborhoods.add(n);
  }
  report.fellBack.push(row.name);
  return map.fallbackCluster[city];
}

function isNew(row, now) {
  if (!row.createdTime) return false;
  const age = (now - Date.parse(row.createdTime)) / 86400000;
  return Number.isFinite(age) && age <= NEW_DAYS;
}

export function buildPlaces({ notion, extra, mapping, now = Date.now() }) {
  const report = {
    noCoords: [],
    unmappedTypes: new Set(),
    unmappedNeighborhoods: new Set(),
    fellBack: [],
    staleRefs: [],
    dropped: [],
    overridden: [],
    badCluster: [],
    idCollisions: [],
  };

  const drops = new Map((extra.drop || []).map((d) => [d.notionId, d]));
  const overrides = new Map((extra.override || []).map((o) => [o.notionId, o]));
  const booked = new Set(extra.booked || []);

  const seen = new Map(); // slug -> count, so two rows can never share a marker key
  const uniqueId = (base) => {
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    if (n === 1) return base;
    report.idCollisions.push(`${base} -> ${base}-${n}`);
    return `${base}-${n}`;
  };

  const places = [];
  for (const row of notion.rows) {
    if (drops.has(row.id)) {
      report.dropped.push(`${row.name} (${drops.get(row.id).why || "no reason given"})`);
      continue;
    }
    if (row.lat == null || row.lng == null) {
      report.noCoords.push(row.name);
      continue;
    }
    const city = row.city.toLowerCase();
    const override = overrides.get(row.id);
    if (override) report.overridden.push(row.name);

    const cat = override?.cat ?? mapping.typeToCat[row.type];
    if (!cat) report.unmappedTypes.add(row.type);

    const place = {
      id: uniqueId(slug(override?.name || row.name)),
      city,
      cluster: override?.cluster ?? clusterFor(row, city, mapping, report),
      cat: cat || "landmark",
      lat: override?.lat ?? row.lat,
      lng: override?.lng ?? row.lng,
      name: override?.name ?? row.name,
      note: override?.note ?? (row.signature || row.address || ""),
    };
    const meta = override?.meta ?? metaFor(row);
    if (meta) place.meta = meta;
    if (booked.has(row.id)) place.booked = true;
    if (isNew(row, now)) place.added = true;
    places.push(place);
  }

  // Straight additions: the hotels, the branch pins, anything not in Notion at all.
  for (const e of extra.places || []) {
    places.push({ ...e, id: uniqueId(e.id) });
  }

  // A cluster the sidebar never lists would render into a group that never displays.
  const known = new Set(Object.values(mapping.clusterOrder).flat());
  for (const p of places) {
    if (!known.has(p.cluster)) report.badCluster.push(`${p.name} -> ${p.cluster}`);
  }

  // Drops/overrides pointing at rows that no longer exist are dead weight worth reporting.
  const rowIds = new Set(notion.rows.map((r) => r.id));
  const rowNames = new Set(notion.rows.map((r) => r.name));
  for (const [id, d] of [...drops, ...overrides]) {
    if (!rowIds.has(id)) report.staleRefs.push(`${d.name || id} (drop/override)`);
  }
  for (const id of booked) {
    if (!rowIds.has(id)) report.staleRefs.push(`${id} (booked)`);
  }
  for (const n of Object.keys(mapping.clusterByPlace)) {
    if (!rowNames.has(n)) report.staleRefs.push(`${n} (clusterByPlace)`);
  }

  // Sidebar order: cities as listed in clusterOrder, clusters in their listed order.
  const cityOrder = Object.keys(mapping.clusterOrder);
  places.sort((a, b) => {
    const byCity = cityOrder.indexOf(a.city) - cityOrder.indexOf(b.city);
    if (byCity) return byCity;
    const order = mapping.clusterOrder[a.city] || [];
    return order.indexOf(a.cluster) - order.indexOf(b.cluster);
  });

  return { places, report };
}

/** One place per line, in the field order the hand-written file used. */
function renderPlaces(places) {
  const ORDER = ["id", "city", "cluster", "cat", "lat", "lng", "name", "note", "meta", "booked", "added"];
  return places
    .map((p) => {
      const fields = ORDER.filter((k) => p[k] !== undefined && p[k] !== null && p[k] !== "")
        .map((k) => `${k}:${JSON.stringify(p[k])}`)
        .join(", ");
      return `  { ${fields} },`;
    })
    .join("\n");
}

function main() {
  const notion = read("data/places.notion.json");
  const extra = read("data/places.extra.json");
  const mapping = read("data/mapping.json");
  const { places, report } = buildPlaces({ notion, extra, mapping });

  const clusters = {};
  for (const [city, order] of Object.entries(mapping.clusterOrder)) {
    clusters[city] = order.filter((c) => places.some((p) => p.city === city && p.cluster === c));
  }

  const generated = [
    `${START} — generated by scripts/build-page.mjs from data/. Edit Notion or data/, not this. */`,
    `const CLUSTERS = ${JSON.stringify(clusters)};`,
    "",
    "const PLACES = [",
    renderPlaces(places),
    "];",
    END,
  ].join("\n");

  const page = readFileSync(PAGE, "utf8");
  const from = page.indexOf(START);
  const to = page.indexOf(END);
  if (from === -1 || to === -1) {
    console.error(`index.html is missing the ${START} / ${END} markers.`);
    process.exit(1);
  }
  const next = page.slice(0, from) + generated + page.slice(to + END.length);

  const summary = [];
  const line = (s) => { summary.push(s); console.log(s); };
  line(`${places.length} places — ${notion.rows.length} Notion rows + ${(extra.places || []).length} local`);
  for (const city of Object.keys(mapping.clusterOrder)) {
    line(`  ${city}: ${places.filter((p) => p.city === city).length}`);
  }
  const note = (label, list) => { if (list.length) line(`${label}: ${list.join(" | ")}`); };
  note("skipped, no coordinates in Notion", report.noCoords);
  note("dropped by places.extra.json", report.dropped);
  note("overridden by places.extra.json", report.overridden);
  note("no Neighborhood set, used the city fallback", report.fellBack);
  note("duplicate ids, disambiguated", report.idCollisions);
  note("stale references (row is gone — safe to delete)", report.staleRefs);

  let fatal = false;
  const fail = (msg) => { console.error(msg); fatal = true; };
  if (report.unmappedTypes.size) fail(`\nUNMAPPED Type — add to mapping.json typeToCat: ${[...report.unmappedTypes].join(", ")}`);
  if (report.unmappedNeighborhoods.size) fail(`UNMAPPED Neighborhood — add to mapping.json neighborhoodToCluster: ${[...report.unmappedNeighborhoods].join(", ")}`);
  if (report.badCluster.length) fail(`Cluster missing from clusterOrder (place would never render): ${report.badCluster.join(" | ")}`);
  if (fatal) process.exit(1);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Build\n\n\`\`\`\n${summary.join("\n")}\n\`\`\`\n`);
  }

  if (process.argv.includes("--check")) {
    if (next !== page) {
      console.error("\nindex.html is out of date. Run: node scripts/build-page.mjs");
      process.exit(1);
    }
    console.log("index.html is up to date.");
    return;
  }

  if (next === page) console.log("index.html already up to date.");
  else { writeFileSync(PAGE, next); console.log("index.html updated."); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
