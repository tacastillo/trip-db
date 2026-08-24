#!/usr/bin/env node
/* Exercise the day-planner core against the data already in index.html.

     node tools/test-plan.mjs

   No network, no arguments, no browser. The planner's pure half lives between two
   sentinel comments in index.html so it can be lifted out and run here; everything
   that touches the DOM, the map or the URL sits outside them and is not covered by
   this file. Drive the real page for that. */

import { readIndex, readConst, sliceBetween } from "./lib.mjs";

const src = readIndex();
let failures = 0;
const ok = (name, pass, detail) => {
  if (!pass) failures++;
  console.log(`  ${pass ? "pass" : "FAIL"}  ${name}${detail && !pass ? `\n        ${detail}` : ""}`);
};
const group = (n) => console.log(`\n${n}`);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------- lift the core out of the page ---------- */

const CORE_A = "/* ==== plan-core:start ==== */", CORE_B = "/* ==== plan-core:end ==== */";
const GEO_A  = "/* ==== geo-core:start ==== */",  GEO_B  = "/* ==== geo-core:end ==== */";
const body = sliceBetween(src, CORE_A, CORE_B);
const geo  = sliceBetween(src, GEO_A, GEO_B);

const EXPORTS = ["decodePlanQuery","encodePlanQuery","resolvePlan","matchesQuery","hopMetres",
  "hopWalk","planLegs","planStats","pathLen","naverMode","naverDirUrl","naverAppUrl","backtracks",
  "reorderByProximity","nearbySuggestions","orderCautions","planBriefMarkdown","closedDays",
  "planDow","fmtM","metres","PLAN_MAX_STOPS","PLAN_PARAMS","NEAR_MAX","NEAR_RADIUS_M",
  "SWAP_GAIN_M","HOP_WALKABLE_M"];

/* The page's own metres() goes in, not lib.mjs's: lib is haversine, the page is
   equirectangular, and every threshold below is a distance comparison. */
const core = new Function("PLACES","CATS","CLUSTERS","LEGS","WALK_KMH","WALK_BEND",
  `${geo}\n${body}\nreturn {${EXPORTS.join(",")}};`)(
    readConst(src,"PLACES"), readConst(src,"CATS"), readConst(src,"CLUSTERS"),
    readConst(src,"LEGS"), readConst(src,"WALK_KMH"), readConst(src,"WALK_BEND"));

const PLACES = readConst(src, "PLACES");
const seoul = PLACES.filter(p => p.city === "seoul");
const pick = (id) => PLACES.find(p => p.id === id);
const R = (ids) => core.resolvePlan(ids, PLACES);

/* ---------- the sentinels themselves ---------- */

group("the extracted block");
ok("plan-core sentinels appear exactly once each",
  src.split(CORE_A).length === 2 && src.split(CORE_B).length === 2);
ok("geo-core sentinels appear exactly once each",
  src.split(GEO_A).length === 2 && src.split(GEO_B).length === 2);

// comments in the block legitimately name these; only real code counts
const code = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const impure = [...new Set(code.match(/(?<![.\w])(document|window|location|history|localStorage|navigator|currentTab|selectedId|railLayer|routeLayer|planLayer)\b/g) || [])];
ok("the core touches no DOM, no page state", impure.length === 0, impure.join(", "));

/* ---------- the URL ---------- */

group("the query string");
const rt = (p) => {
  const back = core.decodePlanQuery(core.encodePlanQuery(p));
  return eq([back.city, back.ids, back.day, back.title, back.extra],
            [p.city, p.ids, p.day, p.title, p.extra || []]);
};
let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
let allRt = true;
for (let n = 0; n < 200; n++){
  const ids = [];
  const k = Math.floor(rnd() * core.PLAN_MAX_STOPS);
  while (ids.length < k){
    const id = PLACES[Math.floor(rnd() * PLACES.length)].id;
    if (ids.indexOf(id) < 0) ids.push(id);
  }
  const p = { city:["seoul","jeju","busan"][Math.floor(rnd()*3)], ids,
              day: rnd() < .5 ? "2026-09-01" : "",
              title: rnd() < .5 ? "Jongno crawl & tea, 2pm" : "", extra: [] };
  if (!rt(p)) { allRt = false; break; }
}
ok("200 random plans survive encode -> decode", allRt);
ok("ids stay legible in the link — no %2C",
  core.encodePlanQuery({city:"seoul", ids:["a","b","c"], extra:[]}).indexOf("stops=a,b,c") > 0);
ok("an empty plan encodes to just the city",
  core.encodePlanQuery({city:"seoul", ids:[], extra:[]}) === "?city=seoul");

group("a link that has rotted");
const junk = core.decodePlanQuery("?city=atlantis&stops=gwangjang,NOPE,gwangjang,,onion&day=yesterday&title=x&utm=abc");
ok("an unknown city falls back to the first leg", junk.city === "seoul");
ok("a repeated id collapses", eq(junk.ids, ["gwangjang","NOPE","onion"]));
ok("an unresolvable id is kept, not amputated", junk.ids.indexOf("NOPE") === 1);
ok("a junk date is dropped", junk.day === "");
ok("somebody else's param survives", eq(junk.extra, [["utm","abc"]]));
ok("and rides along on the way out", core.encodePlanQuery(junk).indexOf("utm=abc") > 0);
const many = core.decodePlanQuery("?stops=" + PLACES.slice(0,20).map(p=>p.id).join(","));
ok("more than the cap is truncated and counted",
  many.ids.length === core.PLAN_MAX_STOPS && many.over === 20 - core.PLAN_MAX_STOPS);
ok("an unresolved id resolves to a row with no place", R(["NOPE"])[0].place === null);
ok("nothing at all decodes without throwing", core.decodePlanQuery("").ids.length === 0);

/* ---------- naver ---------- */

group("the naver links");
const a = pick("gwangjang"), b = pick("novotel");
const url = core.naverDirUrl(a, b, "transit");
ok("longitude comes first, as naver wants",
  url.indexOf(`/${a.lng},${a.lat},`) > 0 && url.indexOf(`/${b.lng},${b.lat},`) > 0);
ok("each block keeps its five fields",
  url.split("/p/directions/")[1].split("/-/")[0].split("/").every(x => x.split(",").length === 5));
ok("the mode lands at the end", url.endsWith("/-/transit"));
const comma = core.naverDirUrl({lat:1,lng:2,name:"A, B & C"}, b, "walk");
ok("a comma in a name cannot split the block",
  comma.indexOf("A%2C%20B%20%26%20C") > 0
  && comma.split("/p/directions/")[1].split("/-/")[0].split("/")[0].split(",").length === 5);
ok("a short hop is a walk", core.naverMode(a, {lat:a.lat+0.002, lng:a.lng, city:"seoul"}) === "walk");
ok("a long seoul hop is transit", core.naverMode(a, pick("coex")||seoul[seoul.length-1]) === "transit");
const j = PLACES.filter(p => p.city === "jeju");
ok("a long jeju hop drives", core.naverMode(j[0], j[j.length-1]) === "car");
ok("the app scheme maps transit -> public",
  core.naverAppUrl(a, b, "transit").startsWith("nmap://route/public?")
  && core.naverAppUrl(a, b, "transit").indexOf("appname=") > 0);

/* ---------- hours prose ---------- */

group("closed-day prose");
ok('"Closed Mon"', eq(core.closedDays("Closed Mon"), ["mon"]));
ok('"Closed Mon–Tue" is a range', eq(core.closedDays("Closed Mon–Tue"), ["mon","tue"]));
ok('"Closed Sun/Mon" is a list', eq(core.closedDays("Closed Sun/Mon"), ["sun","mon"]));
ok('"Closed Tue/Wed" is a list', eq(core.closedDays("Closed Tue/Wed"), ["tue","wed"]));
ok('"Closed Tue · Catchtable" stops at the day', eq(core.closedDays("Closed Tue · Catchtable"), ["tue"]));
ok('"Closed Sat–Mon" wraps the week', eq(core.closedDays("Closed Sat–Mon"), ["sat","sun","mon"]));
["Open 24h","9am–10pm","₩2,500 · closes 5:10pm","₩3,000 · last entry 5pm",
 "Confirm hours on Naver","Reserve or queue",""].forEach(s =>
  ok(`"${s}" is left alone`, core.closedDays(s).length === 0));
ok("every Closed meta in the file parses", PLACES.filter(p => /^Closed /.test(p.meta || ""))
  .every(p => core.closedDays(p.meta).length > 0));
ok("2026-09-01 is a Tuesday", core.planDow("2026-09-01") === "tue");
ok("a rolled-over date is refused", core.planDow("2026-13-45") === "");
ok("a non-date is refused", core.planDow("tuesday") === "");

/* ---------- distance, order, suggestions ---------- */

group("the order checks");
const near = seoul.filter(p => p.cluster === seoul[0].cluster).slice(0, 3);
const zig = R([near[0].id, seoul.find(p => p.cluster !== near[0].cluster).id, near[1].id]);
ok("a zig-zag trips the backtrack warning", core.backtracks(zig).length > 0);
ok("a 0- and 1-stop plan check cleanly",
  core.backtracks(R([])).length === 0 && core.backtracks(R([near[0].id])).length === 0);
const ro = core.reorderByProximity(zig);
ok("reorder never lengthens the day", ro.after_m <= ro.before_m + 1e-6);
ok("reorder returns a permutation",
  eq(ro.order.slice().sort((x,y)=>x-y), zig.map((_,i)=>i)));
ok("reorder pins the start", ro.order[0] === 0);
const fixed = ro.order.map(i => zig[i]);
const again = core.reorderByProximity(fixed);
ok("reordering twice changes nothing the second time", again.gain_m === 0 && eq(again.order, fixed.map((_,i)=>i)));
ok("a plan with an unknown id is left alone", core.reorderByProximity(R([near[0].id,"NOPE",near[1].id])).gain_m === 0);

group("nearby suggestions");
const stops = R([pick("gwangjang").id]);
const sug = core.nearbySuggestions(stops, { places: PLACES, city: "seoul" });
ok("it suggests something", sug.length > 0);
ok("never more than the cap", sug.length <= core.NEAR_MAX);
ok("never something already planned", sug.every(s => s.place.id !== "gwangjang"));
ok("never the hotel", sug.every(s => s.place.cat !== "hotel"));
ok("never another city", sug.every(s => s.place.city === "seoul"));
ok("it is deterministic",
  eq(sug.map(s=>s.place.id), core.nearbySuggestions(stops, {places:PLACES, city:"seoul"}).map(s=>s.place.id)));
ok("each one slots in next to the stop it is near",
  sug.every(s => s.insertAt >= 0 && s.insertAt <= stops.length));
ok("an empty plan suggests nothing rather than guessing",
  core.nearbySuggestions([], { places: PLACES, city: "seoul" }).length === 0);
ok("category filters are honoured", core.nearbySuggestions(stops,
  { places: PLACES, city:"seoul", cats:{ food:true } }).every(s => s.place.cat === "food"));

group("search");
ok("a name matches", core.matchesQuery(pick("gwangjang"), "gwangjang"));
ok("two tokens must both match", !core.matchesQuery(pick("gwangjang"), "gwangjang zzzz"));
ok("the category label matches", core.matchesQuery(pick("novotel"), "hotel"));
ok("an empty query matches everything", core.matchesQuery(pick("novotel"), "  "));

/* ---------- the brief ---------- */

group("the agent brief");
const plan = { city:"seoul", ids:[near[0].id, near[1].id], day:"2026-09-01", title:"Jongno crawl", extra:[] };
const md = core.planBriefMarkdown(plan, R(plan.ids), "https://example.test/index.html?x=1", null);
ok("it names every stop, in order",
  md.indexOf(near[0].name) > 0 && md.indexOf(near[0].name) < md.indexOf(near[1].name));
ok("it carries the source link", md.indexOf("https://example.test/index.html?x=1") > 0);
ok("it carries a naver link for the hop", md.indexOf("https://map.naver.com/p/directions/") > 0);
ok("it says what it does not know", md.indexOf("not computed anywhere") > 0);
ok("no undefined or [object Object]", !/undefined|\[object Object\]/.test(md));
const md2 = core.planBriefMarkdown({city:"seoul", ids:["NOPE"], day:"", title:"", extra:[]}, R(["NOPE"]), "", null);
ok("an unknown id degrades in the brief too", md2.indexOf("unknown id") > 0 && !/undefined/.test(md2));
ok("a rideLine callback is used when given",
  core.planBriefMarkdown(plan, R(plan.ids), "", () => "Line 4 -> Dongdaemun").indexOf("From the hotel: Line 4") > 0);

/* ---------- the two metres() ---------- */

group("the geometry the page ships");
import { metres as libMetres } from "./lib.mjs";
let worst = 0;
for (let i = 0; i < seoul.length - 1; i++){
  const p = seoul[i], q = seoul[i+1];
  worst = Math.max(worst, Math.abs(core.metres([p.lat,p.lng],[q.lat,q.lng]) - libMetres([p.lat,p.lng],[q.lat,q.lng])));
}
ok("the page's equirectangular metres and lib's haversine agree within a metre",
  worst < 1, `worst ${worst.toFixed(3)} m`);

console.log(`\n${failures} failure(s)\n`);
process.exit(failures ? 1 : 0);
