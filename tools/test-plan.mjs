#!/usr/bin/env node
/* Exercise the day-planner core against the data the page ships.

     node tools/test-plan.mjs

   No network, no arguments, no browser. The planner's pure half is src/lib/, which
   imports cleanly into node; everything that touches the DOM, the map or the URL sits
   in src/client/ and is not covered by this file. Drive the real page for that.
   check-data.mjs is what holds src/lib/ to being importable at all. */

import * as core from "../src/lib/plan-core.js";
import { metres } from "../src/lib/geo.js";
import { metres as libMetres } from "./lib.mjs";
import { PLACES } from "../src/data/places.js";
import { STATION_COORDS } from "../src/data/routing.js";

let failures = 0;
const ok = (name, pass, detail) => {
  if (!pass) failures++;
  console.log(`  ${pass ? "pass" : "FAIL"}  ${name}${detail && !pass ? `\n        ${detail}` : ""}`);
};
const group = (n) => console.log(`\n${n}`);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const seoul = PLACES.filter(p => p.city === "seoul");
const pick = (id) => PLACES.find(p => p.id === id);
const R = (ids) => core.resolvePlan(ids, PLACES);

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
ok("reorder pins the start when there is no anchor", ro.order[0] === 0);
const fixed = ro.order.map(i => zig[i]);
const again = core.reorderByProximity(fixed);
ok("reordering twice changes nothing the second time", again.gain_m === 0 && eq(again.order, fixed.map((_,i)=>i)));
ok("a plan with an unknown id is left alone", core.reorderByProximity(R([near[0].id,"NOPE",near[1].id])).gain_m === 0);

/* An anchored day is a loop out of the hotel and back into it. Every ordering question
   is asked about that loop, which is what stops the advice proposing an order that
   saves metres between stops and strands you a kilometre from your bed. */
const HOME = core.hotelFor("seoul", PLACES);
const ordered = core.reorderByProximity(zig, HOME);
ok("an anchored reorder is free to move the first stop too",
  ordered.order.length === zig.length && ordered.after_m <= ordered.before_m + 1e-6);
ok("an anchored reorder is still a permutation",
  eq(ordered.order.slice().sort((x,y)=>x-y), zig.map((_,i)=>i)));
const settled = core.reorderByProximity(ordered.order.map(i => zig[i]), HOME);
ok("and still settles after one pass", settled.gain_m === 0);
ok("the anchored length counts both ends",
  Math.abs(core.pathLen(zig, HOME) - (core.pathLen(zig)
    + core.hopMetres(HOME, zig[0].place) + core.hopMetres(zig[zig.length-1].place, HOME))) < 1e-6);

/* The bug this model exists to kill: with the hotel sitting in the list as stop 1, the
   swap check saw two ordinary stops and offered to put a landmark before the bed. */
const withHotel = R(["novotel","ddp","sancheong"]);
ok("the old shape really did offer to move the hotel out of first place",
  core.backtracks(withHotel).some(b => b.i === 0));
ok("the anchored day it became says nothing of the kind",
  core.backtracks(R(["ddp","sancheong"]), HOME).length === 0);

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

/* ---------- which line carries a hop ---------- */

group("naming the line for a hop");
const stns = Object.keys(STATION_COORDS);
ok("every station resolves to at least one line",
  stns.every(st => core.stationLines(st, "seoul").length > 0),
  stns.filter(st => !core.stationLines(st, "seoul").length).join(", "));
const onLine3 = stns.filter(st => core.stationLines(st, "seoul").indexOf("3") >= 0);
ok("two stations on one line name it",
  onLine3.length > 1 && (core.hopLine(onLine3[0], onLine3[1], "seoul") || {}).ref === "3");
ok("a station with itself names nothing", core.hopLine("Anguk", "Anguk", "seoul") === null);
ok("a missing station names nothing", core.hopLine("Anguk", "Nowhere", "seoul") === null);
/* The case that made a routing engine the wrong answer: these two are 1.3 km apart,
   share no line in this table, and the interchange you would really use is not in it.
   Naming a line here would mean inventing a transfer. */
ok("stations that share no line are left to Naver",
  core.hopLine("Hongik Univ.", "Mangwon", "seoul") === null);
let bogus = 0;
for (const a of stns) for (const b of stns){
  const h = core.hopLine(a, b, "seoul");
  if (!h) continue;
  if (core.stationLines(a,"seoul").indexOf(h.ref) < 0 || core.stationLines(b,"seoul").indexOf(h.ref) < 0) bogus++;
}
ok("a named line always actually serves both ends", bogus === 0);
ok("legs carry the line when an offFor is given",
  core.planLegs(R([pick("gyeongbok").id, pick("novotel").id]), p => ({gyeongbok:"Gyeongbokgung", novotel:"Dongdaemun History & Culture Park"})[p.id])
    .every(l => l === null || "line" in l));
ok("and carry none when it is not", core.planLegs(R([pick("gyeongbok").id, pick("novotel").id]))[0].line === null);

/* ---------- where a day starts ---------- */

group("the home base");
["seoul","busan","jeju"].forEach(c => {
  const h = core.hotelFor(c, PLACES);
  ok(`${c} has one, and it is a hotel in ${c}`, !!h && h.cat === "hotel" && h.city === c);
});
ok("a city with no hotel simply has none", core.hotelFor("nowhere", PLACES) === null);

const day = R(["gwangjang","gyeongbok"]);
const out = core.leadLeg(day, "seoul", null, PLACES);
const back = core.homeLeg(day, "seoul", null, PLACES);
ok("the day leaves the hotel for its first stop",
  !!out && out.home.id === "novotel" && out.a.id === "novotel" && out.b.id === "gwangjang");
ok("and comes back to it from its last",
  !!back && back.home.id === "novotel" && back.a.id === "gyeongbok" && back.b.id === "novotel"
  && back.naver.includes("map.naver.com"));
ok("both ends are null for an empty day",
  core.leadLeg(R([]), "seoul", null, PLACES) === null && core.homeLeg(R([]), "seoul", null, PLACES) === null);
ok("an unknown id at an end does not swallow either hop",
  (core.leadLeg(R(["nope","gwangjang"]), "seoul", null, PLACES) || {}).b?.id === "gwangjang"
  && (core.homeLeg(R(["gwangjang","nope"]), "seoul", null, PLACES) || {}).a?.id === "gwangjang");
ok("a day of nothing but the hotel has no hop to either end",
  core.leadLeg(R(["novotel"]), "seoul", null, PLACES) === null
  && core.homeLeg(R(["novotel"]), "seoul", null, PLACES) === null);

// a link written when the hotel was a stop still means the same day
ok("a leading hotel id is dropped", eq(core.stripAnchorStops(["novotel","gwangjang"], "seoul", PLACES), ["gwangjang"]));
ok("so is a trailing one", eq(core.stripAnchorStops(["gwangjang","novotel"], "seoul", PLACES), ["gwangjang"]));
ok("but one in the middle of the day is a real stop",
  eq(core.stripAnchorStops(["gwangjang","novotel","gyeongbok"], "seoul", PLACES),
     ["gwangjang","novotel","gyeongbok"]));
ok("another leg's hotel is left alone",
  eq(core.stripAnchorStops(["parkhyatt","gwangjang"], "seoul", PLACES), ["parkhyatt","gwangjang"]));

const st = core.planStats(day, null, "seoul", PLACES);
ok("the totals count the two anchor hops",
  st.lead && st.home && Math.abs(st.total - (core.planStats(day, null).total
    + st.lead.metres + st.home.metres)) < 1e-6);
const brief = core.planBriefMarkdown({ city:"seoul", ids:[] }, day, "", null, null);
ok("the brief says where the day starts and ends",
  brief.includes("Starts at **Novotel") && brief.includes("Ends back at **Novotel"));

/* ---------- the two metres() ---------- */

group("the geometry the page ships");
let worst = 0;
for (let i = 0; i < seoul.length - 1; i++){
  const p = seoul[i], q = seoul[i+1];
  worst = Math.max(worst, Math.abs(metres([p.lat,p.lng],[q.lat,q.lng]) - libMetres([p.lat,p.lng],[q.lat,q.lng])));
}
ok("the page's equirectangular metres and lib's haversine agree within a metre",
  worst < 1, `worst ${worst.toFixed(3)} m`);

console.log(`\n${failures} failure(s)\n`);
process.exit(failures ? 1 : 0);
