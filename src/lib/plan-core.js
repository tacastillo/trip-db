/* The day planner's pure half. No DOM, no map, no page state — it reads the data tables
   and its arguments and nothing else, which is what lets tools/test-plan.mjs import it
   into node. Anything that touches the page belongs in src/client/, and
   tools/check-data.mjs fails if something in this directory reaches for it. */

import { CATS, LEGS, PLACES, TRIP } from "../data/places.js";
import { RAIL } from "../data/rail.js";
import { STATION_COORDS, WALK_BEND, WALK_KMH } from "../data/routing.js";
import { metres, projectOnSeg } from "./geo.js";
import { ride } from "./rail.js";

/* Everything between these sentinels is pure. It reads the data tables and its own
   arguments and nothing else — no document, no map, no history, no mutable page
   state. tools/test-plan.mjs slices this block straight out of the file and runs it
   in Node, which keeps working only for as long as that stays true. */

/* A plan lives in the query string and nowhere else. Twelve stops keeps the link
   pasteable and keeps the 2-opt pass below trivially cheap. */
export const PLAN_MAX_STOPS = 12;
export const PLAN_TITLE_MAX = 60;
export const PLAN_PARAMS = { city:"city", stops:"stops", day:"day", title:"title" };

/* Suggestions. The radius is deliberately tighter than AUTO_WALK_MAX: that one asks
   "could you walk this from a station", this one asks "is this near enough that you'd
   tack it on", which is a shorter walk. */
export const NEAR_RADIUS_M = 900;
export const NEAR_MAX = 6;
export const NEAR_CLUSTER_BONUS = 0.35, NEAR_NEW_CLUSTER_PENALTY = 0.15;
export const NEAR_VARIETY_BONUS = 0.12, NEAR_NEW_PLACE_BONUS = 0.05;

/* Two guards on the backtracking warning, for the reason check-data.mjs pairs its
   dogleg ratio with an absolute: the fraction alone cries wolf on a tight plan, the
   absolute alone stays quiet on a sprawling one. */
export const SWAP_GAIN_M = 250, SWAP_GAIN_FRAC = 0.08;
export const REORDER_MAX_PASSES = 8;

/* Past this, "walk it" stops being advice. */
export const HOP_WALKABLE_M = 1200;

export const DOW = ["mon","tue","wed","thu","fri","sat","sun"];
export const DOW_LABEL = { mon:"Monday", tue:"Tuesday", wed:"Wednesday", thu:"Thursday",
                    fri:"Friday", sat:"Saturday", sun:"Sunday" };

/* A station should sit on the line that serves it; check-data.mjs holds the tables to
   the same 400m. */
export const STATION_ON_LINE_M = 400;

export const stationLineMemo = {};
/** Which lines run through a station, worked out from the geometry rather than stored. */
export function stationLines(st, city, rail, coords){
  const key = city + "/" + st;
  if (stationLineMemo[key]) return stationLineMemo[key];
  const c = (coords || STATION_COORDS)[st];
  const out = [];
  if (c) (rail || RAIL)[city].forEach(l => {
    const near = l.paths.some(path => {
      for (let i = 1; i < path.pts.length; i++)
        if (projectOnSeg(c, path.pts[i - 1], path.pts[i]).d <= STATION_ON_LINE_M) return true;
      return false;
    });
    if (near) out.push(l.ref);
  });
  return (stationLineMemo[key] = out);
}

/** The one line that carries you between two stations without changing, or null.
    Only the no-transfer case is ever answered. A transfer would mean picking an
    interchange out of STATION_COORDS, which holds the thirty-odd stops the routes
    happen to use rather than the network — routing through it sends you Hongik Univ
    to Mangwon the long way round, 17km for a walk of one. Naver can answer the rest;
    this only says what the geometry already proves. */
export function hopLine(stA, stB, city, rail, coords){
  if (!stA || !stB || stA === stB) return null;
  const R = (rail || RAIL)[city] || [];
  const bs = stationLines(stB, city, rail, coords);
  const ref = stationLines(stA, city, rail, coords).find(r => bs.indexOf(r) >= 0);
  if (!ref) return null;
  const l = R.find(x => x.ref === ref);
  return l ? { ref, label: l.label, color: l.color, from: stA, to: stB } : null;
}

/** The home base for a city, which is where a day starts. The trip has one hotel per
    leg; the first is the answer, and a city without one simply has no default start. */
export function hotelFor(city, places){
  return (places || PLACES).find(p => p.city === city && p.cat === "hotel") || null;
}

/** Metres as the rest of the page words them. */
export function fmtM(m){
  return m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

/** "2026-09-01" -> "tue". Empty for anything that isn't a real calendar date. */
export function planDow(day){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || "");
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  // Date.UTC rolls 2026-13-45 over into next year rather than refusing it
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return "";
  return DOW[(d.getUTCDay() + 6) % 7];
}

/* Korea is UTC+9 all year — no daylight saving — so "what day is it there" is one
   addition rather than a timezone library. `now` is passed in by the caller so this
   stays testable; nothing here reads the clock unless asked to. */
export const KST_OFFSET_MIN = 9 * 60;
export function isoDay(now){
  const t = new Date((now || new Date()).getTime() + KST_OFFSET_MIN * 60000);
  return t.toISOString().slice(0, 10);
}

export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const DOW_SHORT = { mon:"Mon", tue:"Tue", wed:"Wed", thu:"Thu", fri:"Fri", sat:"Sat", sun:"Sun" };

/** "2026-09-01" -> "Tue 1 Sep". Empty for anything that is not a real date. */
export function fmtDay(day){
  const dow = planDow(day);
  if (!dow) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return `${DOW_SHORT[dow]} ${+m[3]} ${MONTHS[+m[2] - 1]}`;
}

/** Every date of the trip, in order, each tagged with the leg it falls in. ISO dates
    sort and compare as strings, which is the whole reason the tables hold them. */
export function tripDays(trip, legs){
  const t = trip || TRIP;
  const out = [];
  for (let d = t.start; d <= t.end; d = nextDay(d)){
    out.push({ day: d, dow: planDow(d), label: fmtDay(d), leg: legForDate(d, legs) });
    if (out.length > 400) break;                  // a malformed date range must not spin
  }
  return out;
}
export function nextDay(day){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || "");
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1));
  return d.toISOString().slice(0, 10);
}
export function inTrip(day, trip){
  const t = trip || TRIP;
  return !!planDow(day) && day >= t.start && day <= t.end;
}

/** Which leg a date belongs to, or null for a date outside every span. The handover
    days sit in two spans — you wake in one city and sleep in another — and a day plan
    made on one of them is for where you are going, so a span that *starts* on the date
    wins over one that merely contains it. */
export function legForDate(day, legs){
  const L = legs || LEGS;
  if (!planDow(day)) return null;
  const arriving = L.find(l => (l.spans || []).some(s => s[0] === day));
  if (arriving) return arriving.id;
  const here = L.find(l => (l.spans || []).some(s => day >= s[0] && day <= s[1]));
  return here ? here.id : null;
}

/* The only shapes that actually occur in meta: "Closed Mon", "Closed Mon-Tue",
   "Closed Sun/Mon", "Closed Tue · Catchtable". A dash is a range, a slash or comma is
   a list. Anything else is left alone and shown verbatim — this reads the handful of
   forms the trip notes use, it is not a hours parser, and it must never become one. */
export const CLOSED_RE = /^closed\s+((?:mon|tue|wed|thu|fri|sat|sun)(?:\s*[–—\-\/,&]\s*(?:mon|tue|wed|thu|fri|sat|sun))*)/i;
export function closedDays(meta){
  const m = CLOSED_RE.exec(String(meta || "").trim());
  if (!m) return [];
  const names = m[1].toLowerCase().match(/mon|tue|wed|thu|fri|sat|sun/g) || [];
  const range = /[–—\-]/.test(m[1]) && names.length === 2;
  if (!range) return names;
  const a = DOW.indexOf(names[0]), b = DOW.indexOf(names[1]);
  if (a < 0 || b < 0) return names;
  const out = [];
  for (let i = a; ; i = (i + 1) % 7){ out.push(DOW[i]); if (i === b || out.length > 7) break; }
  return out;
}

/** location.search -> a plan. Never reads location itself, so it can be tested. */
export function decodePlanQuery(search, legs, max){
  const q = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const cap = max || PLAN_MAX_STOPS;
  const legIds = (legs || LEGS).map(l => l.id);
  const asked = q.get(PLAN_PARAMS.city);
  const city = legIds.indexOf(asked) >= 0 ? asked : legIds[0];
  const ids = [];
  String(q.get(PLAN_PARAMS.stops) || "").split(",").forEach(s => {
    const id = s.trim();
    // a repeated id would give one place two numbers on the map and two rows to drag
    if (id && ids.indexOf(id) < 0) ids.push(id);
  });
  const day = /^\d{4}-\d{2}-\d{2}$/.test(q.get(PLAN_PARAMS.day) || "") ? q.get(PLAN_PARAMS.day) : "";
  const title = String(q.get(PLAN_PARAMS.title) || "").slice(0, PLAN_TITLE_MAX);
  const mine = Object.keys(PLAN_PARAMS).map(k => PLAN_PARAMS[k]);
  const extra = [];
  q.forEach((v, k) => { if (mine.indexOf(k) < 0) extra.push([k, v]); });
  return { city, ids: ids.slice(0, cap), day, title, over: Math.max(0, ids.length - cap), extra };
}

/** The inverse. Anything someone else hung on the URL rides along untouched. */
export function encodePlanQuery(plan){
  const q = new URLSearchParams();
  (plan.extra || []).forEach(kv => q.append(kv[0], kv[1]));
  if (plan.city) q.set(PLAN_PARAMS.city, plan.city);
  if (plan.ids && plan.ids.length) q.set(PLAN_PARAMS.stops, plan.ids.join(","));
  if (plan.day) q.set(PLAN_PARAMS.day, plan.day);
  if (plan.title) q.set(PLAN_PARAMS.title, plan.title);
  // URLSearchParams escapes the separator; the whole point of this grammar is that a
  // person or an agent can read the ids straight off the link, so put it back.
  const s = q.toString().replace(/%2C/g, ",");
  return s ? "?" + s : "";
}

/** Ids to rows. An id we no longer know stays in the list as a row with no place —
    dropping it would quietly amputate a stop from someone else's shared link. */
export function resolvePlan(ids, places){
  const by = {};
  (places || PLACES).forEach(p => { by[p.id] = p; });
  return (ids || []).map(id => ({ id, place: by[id] || null }));
}

/** Free-text search over everything a row actually shows. */
export function matchesQuery(p, q, cats){
  const s = String(q || "").trim().toLowerCase();
  if (!s) return true;
  const cat = (cats || CATS)[p.cat];
  const hay = [p.name, p.note, p.meta, p.cluster, cat && cat.label].join(" ").toLowerCase();
  return s.split(/\s+/).every(t => hay.indexOf(t) >= 0);
}

export function hopMetres(a, b){ return metres([a.lat, a.lng], [b.lat, b.lng]); }

/** The same arithmetic buildJourney already uses for its walk to the door. */
export function hopWalk(a, b){
  const m = hopMetres(a, b) * WALK_BEND;
  return { m, minutes: Math.max(1, Math.round(m / 1000 / WALK_KMH * 60)) };
}

export function naverMode(a, b){
  if (hopMetres(a, b) <= HOP_WALKABLE_M) return "walk";
  return a.city === "jeju" ? "car" : "transit";     // Jeju has no metro to ride
}

/* Naver's web directions URL is positional, not named: two place blocks separated by
   "/", then "/-/" (the waypoint slot, empty), then the mode. A block is

       lng,lat,name,,

   and the two trailing empty fields are Naver's own place-id and place-type slots,
   which we do not have. Note the coordinates are LONGITUDE FIRST — the opposite of
   every other coordinate pair in this file — so that swap happens here and nowhere
   else. encodeURIComponent on the name is load-bearing: it turns a comma inside a
   name into %2C, which the field separator no longer matches.

   This is the one function to change if a link ever stops resolving. Nothing in the
   environment this was written in could reach Naver to check it. Naver's documented
   app scheme, for reference, is
       nmap://route/public|car|walk|bicycle?slat=&slng=&sname=&dlat=&dlng=&dname=&appname= */
/* The last path segment is the routing mode, and this is the vocabulary Naver wants for
   it. Transit is "public", not "transit" — the same word the app scheme uses, and checked
   on a phone in the only way it can be: an unrecognised token does not error, it quietly
   falls back to driving, which looks like a working link right up until you are standing
   on a platform. Nothing in this repository can reach Naver to test that, so this table
   is the one place the vocabulary lives and the only line to change if it moves. */
export const NAVER_MODE_TOKEN = { walk:"walk", transit:"public", car:"car" };

export function naverDirUrl(a, b, mode){
  const block = p => `${p.lng},${p.lat},${encodeURIComponent(p.name)},,`;
  const m = mode || naverMode(a, b);
  return `https://map.naver.com/p/directions/${block(a)}/${block(b)}/-/${NAVER_MODE_TOKEN[m] || m}`;
}
export function naverAppUrl(a, b, mode){
  const m = mode || naverMode(a, b);
  const q = new URLSearchParams({
    slat:a.lat, slng:a.lng, sname:a.name,
    dlat:b.lat, dlng:b.lng, dname:b.name, appname:"trip-db",
  });
  return `nmap://route/${m === "transit" ? "public" : m}?${q}`;
}

/* Kakao is the other half of how anyone actually moves here: its map routes by car
   better than Naver's, and it is what half the country navigates with. The web link is
   deliberately destination-only — map.kakao.com/link/to takes one place, not a pair —
   which on the ground is the right shape anyway: Kakao starts you from where you are
   standing. Like naverDirUrl(), neither of these could be reached from the environment
   they were written in; they are the only things to change if a link stops resolving.

   There is no taxi link. Kakao T is the app everyone actually hails with, but its URL
   scheme is not something this repository can verify, and an unverified scheme is worse
   than no button: it resolves to nothing at all, silently, while you are standing in a
   street at midnight deciding whether to keep waiting. Kakao Map's car route is the
   honest version of that — it is the screen you show the driver anyway. */
export const KAKAO_BY = { walk:"FOOT", transit:"PUBLICTRANSIT", car:"CAR" };
export function kakaoDirUrl(a, b){
  return `https://map.kakao.com/link/to/${encodeURIComponent(b.name)},${b.lat},${b.lng}`;
}
export function kakaoAppUrl(a, b, mode){
  const by = KAKAO_BY[mode || naverMode(a, b)] || "CAR";
  return `kakaomap://route?sp=${a.lat},${a.lng}&ep=${b.lat},${b.lng}&by=${by}`;
}

/** One entry per gap between consecutive stops; null where an end is unresolved.
    offFor maps a place to the station you get off at — passed in rather than reached
    for, so this stays runnable outside the page. */
export function planLegs(stops, offFor){
  const legs = [];
  for (let i = 0; i < stops.length - 1; i++){
    const a = stops[i].place, b = stops[i + 1].place;
    if (!a || !b){ legs.push(null); continue; }
    const mode = naverMode(a, b), w = hopWalk(a, b);
    const line = (mode !== "walk" && offFor) ? hopLine(offFor(a), offFor(b), a.city) : null;
    legs.push({ i, a, b, metres: hopMetres(a, b), mode, walkable: mode === "walk",
                walkM: w.m, walkMin: w.minutes, line,
                naver: naverDirUrl(a, b, mode), naverApp: naverAppUrl(a, b, mode),
                kakao: kakaoDirUrl(a, b), kakaoApp: kakaoAppUrl(a, b, mode) });
  }
  return legs;
}

/** The hop out of the front door. The exact mirror of homeLeg() below, and for the same
    reason: every day of this trip begins at the hotel, so the way out is worked out
    rather than typed in, and it is not a stop. It used to be one — the first spot you
    added put the hotel in front of it as stop 1 — which meant the two ends of the same
    day were different kinds of thing: one draggable and removable, one fixed. Null when
    the leg has no home base, or when the day already opens at it. */
export function startLeg(stops, city, offFor, places){
  const home = hotelFor(city, places);
  if (!home) return null;
  const first = stops.map(s => s.place).find(Boolean);
  if (!first || first.id === home.id) return null;
  const leg = planLegs([{ id:home.id, place:home }, { id:first.id, place:first }], offFor)[0];
  return leg ? Object.assign({ home, to:first }, leg) : null;
}

/** The hop home. Every day of this trip ends where it started — you are sleeping at the
    hotel — so the last thing a day needs is the way back. It is deliberately not a stop:
    ?stops= collapses a repeated id, so a hotel that both opens and closes the day could
    not survive a round trip through the link. It is computed from the last resolved stop
    instead, which means it follows the day around as the order changes and costs the URL
    nothing. Null when there is no home base, or when you already end at it. */
export function homeLeg(stops, city, offFor, places){
  const home = hotelFor(city, places);
  if (!home) return null;
  const last = stops.filter(s => s.place).map(s => s.place).pop();
  if (!last || last.id === home.id) return null;
  const leg = planLegs([{ id:last.id, place:last }, { id:home.id, place:home }], offFor)[0];
  return leg ? Object.assign({ home, from:last }, leg) : null;
}

/** Raw metres end to end. No WALK_BEND: every caller compares two of these, and a
    constant factor cancels out of a comparison. */
export function pathLen(stops){
  let t = 0;
  for (let i = 0; i < stops.length - 1; i++){
    const a = stops[i].place, b = stops[i + 1].place;
    if (a && b) t += hopMetres(a, b);
  }
  return t;
}

export function planStats(stops, offFor){
  const legs = planLegs(stops, offFor);
  let total = 0, walkM = 0, walkMin = 0, rides = 0;
  legs.forEach(l => {
    if (!l) return;
    total += l.metres;
    if (l.walkable){ walkM += l.walkM; walkMin += l.walkMin; } else rides++;
  });
  return { legs, total, walkM, walkMin, rides, resolved: stops.filter(s => s.place).length };
}

/** Adjacent pairs that would be shorter the other way round. */
export function backtracks(stops){
  const base = pathLen(stops), out = [];
  for (let i = 0; i < stops.length - 1; i++){
    const swapped = stops.slice();
    swapped[i] = stops[i + 1]; swapped[i + 1] = stops[i];
    const gain = base - pathLen(swapped);
    if (gain > SWAP_GAIN_M && gain > base * SWAP_GAIN_FRAC) out.push({ i, gain });
  }
  return out;
}

/** Nearest-neighbour from wherever you said you start, then 2-opt. Only ever a
    suggestion: it returns the identity order unless it genuinely beats what you have,
    so offering it twice in a row cannot make the plan wander. */
export function reorderByProximity(stops){
  const idx = stops.map((_, i) => i);
  const before = pathLen(stops);
  const flat = { order: idx, before_m: before, after_m: before, gain_m: 0 };
  if (stops.length < 3 || !stops.every(s => s.place)) return flat;
  const len = o => {
    let t = 0;
    for (let i = 0; i < o.length - 1; i++) t += hopMetres(stops[o[i]].place, stops[o[i + 1]].place);
    return t;
  };
  const order = [0], left = idx.slice(1);
  while (left.length){
    const last = stops[order[order.length - 1]].place;
    let best = 0, bd = Infinity;
    left.forEach((j, k) => {
      const d = hopMetres(last, stops[j].place);
      if (d < bd - 1e-9){ bd = d; best = k; }        // ties keep the earlier stop
    });
    order.push(left.splice(best, 1)[0]);
  }
  for (let pass = 0; pass < REORDER_MAX_PASSES; pass++){
    let improved = false;
    for (let i = 1; i < order.length - 1 && !improved; i++){
      for (let j = i + 1; j < order.length && !improved; j++){
        const cand = order.slice(0, i).concat(order.slice(i, j + 1).reverse(), order.slice(j + 1));
        // first improving move, not the best one: same input must give the same output
        if (len(cand) < len(order) - 1e-9){ order.length = 0; order.push.apply(order, cand); improved = true; }
      }
    }
    if (!improved) break;
  }
  const after = len(order);
  if (after >= before - 1e-9) return flat;
  return { order, before_m: before, after_m: after, gain_m: before - after };
}

/** Spots worth tacking on, given what is already in the day. Deterministic: same plan
    in, same list out, which is what makes this the application's job and not an
    agent's. */
export function nearbySuggestions(stops, opts){
  const o = opts || {};
  const places = o.places || PLACES;
  const cats = o.cats || null;
  const planned = {};
  stops.forEach(s => { planned[s.id] = true; });
  const anchors = stops.map(s => s.place).filter(Boolean);
  if (!anchors.length) return [];
  const clusters = {}, catsIn = {};
  anchors.forEach(p => { clusters[p.cluster] = true; catsIn[p.cat] = true; });
  const out = [];
  places.forEach(q => {
    if (q.city !== o.city || planned[q.id] || q.cat === "hotel") return;
    if (cats && !cats[q.cat]) return;
    let d = Infinity, near = -1;
    anchors.forEach(a => {
      const t = hopMetres(a, q);
      if (t < d){ d = t; near = stops.findIndex(s => s.place === a); }
    });
    const inCluster = !!clusters[q.cluster];
    if (d > NEAR_RADIUS_M && !inCluster) return;
    const score = (1 - Math.min(1, d / NEAR_RADIUS_M))
      + (inCluster ? NEAR_CLUSTER_BONUS : -NEAR_NEW_CLUSTER_PENALTY)
      + (catsIn[q.cat] ? 0 : NEAR_VARIETY_BONUS)
      + (q.added ? NEAR_NEW_PLACE_BONUS : 0);
    // slot it next to the stop it is near, which is the whole point of suggesting it
    out.push({ place:q, d, score, nearIdx:near, insertAt: near < 0 ? stops.length : near + 1 });
  });
  out.sort((x, y) => y.score - x.score || x.d - y.d || (x.place.id < y.place.id ? -1 : 1));
  return out.slice(0, NEAR_MAX);
}

/** Everything the page can say about this order without guessing. */
export function orderCautions(stops, city, day){
  const out = [];
  const unknown = stops.filter(s => !s.place);
  if (unknown.length) out.push({ kind:"unknown", text:
    `${unknown.length} stop${unknown.length > 1 ? "s" : ""} in this link ${unknown.length > 1 ? "are" : "is"} not in the map: ${unknown.map(s => s.id).join(", ")}.` });
  stops.forEach((s, i) => {
    if (s.place && s.place.city !== city) out.push({ kind:"city", i, text:
      `Stop ${i + 1}, ${s.place.name}, is in ${s.place.city} — this day is ${city}.` });
  });
  backtracks(stops).forEach(b => {
    const a = stops[b.i].place, c = stops[b.i + 1].place;
    out.push({ kind:"order", i:b.i, gain:b.gain, text:
      `Stops ${b.i + 1} and ${b.i + 2} look swapped — ${c.name} before ${a.name} saves about ${fmtM(b.gain)}.` });
  });
  const dow = planDow(day);
  if (dow) stops.forEach((s, i) => {
    if (s.place && closedDays(s.place.meta).indexOf(dow) >= 0) out.push({ kind:"closed", i, text:
      `${s.place.name} is shut on a ${DOW_LABEL[dow]} — the note says "${s.place.meta}".` });
  });
  // hardest problems first
  const rank = { unknown:0, city:1, closed:2, order:3 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/** The handoff. rideLine is an optional (place) -> string for the ride from the hotel,
    which lives outside this block because it needs the memoised journey engine. */
export function planBriefMarkdown(plan, stops, href, rideLine, offFor){
  const st = planStats(stops, offFor), lines = [];
  const cityLabel = (LEGS.find(l => l.id === plan.city) || {}).label || plan.city;
  const head = [plan.title || "Day plan", "—", cityLabel].join(" ");
  lines.push(`# ${head}${plan.day ? ` · ${plan.day}` : ""}`);
  const bits = [`${st.resolved} stop${st.resolved === 1 ? "" : "s"}`];
  if (st.walkM) bits.push(`~${fmtM(st.walkM)} of walking between them`);
  if (st.rides) bits.push(`${st.rides} hop${st.rides === 1 ? "" : "s"} you would ride`);
  lines.push(bits.join(" · "));
  if (href) lines.push(`Source: ${href}`);
  lines.push("");
  const out = startLeg(stops, plan.city, offFor);
  if (out){
    lines.push(`Starts at **${out.home.name}** — ${fmtM(out.metres)}${out.walkable
      ? `, about ${out.walkMin} min on foot` : out.line
        ? `, ${out.line.label} from ${out.line.from} to ${out.line.to}` : `, ${out.mode}`} · ${out.naver}`);
    lines.push("");
  }
  stops.forEach((s, i) => {
    const p = s.place;
    if (!p){ lines.push(`${i + 1}. _unknown id \`${s.id}\`_`); lines.push(""); return; }
    const c = CATS[p.cat] || { label:p.cat, emoji:"" };
    lines.push(`${i + 1}. **${p.name}** — ${c.emoji} ${c.label} · ${p.cluster}`);
    lines.push(`   ${p.lat}, ${p.lng}`);
    if (p.note) lines.push(`   ${p.note}`);
    if (p.meta) lines.push(`   Check before you go: "${p.meta}"`);
    const ride = rideLine && rideLine(p);
    if (ride) lines.push(`   From the hotel: ${ride}`);
    const leg = st.legs[i];
    if (leg) lines.push(`   -> next: ${fmtM(leg.metres)}${leg.walkable ? `, about ${leg.walkMin} min on foot`
      : leg.line ? `, ${leg.line.label} from ${leg.line.from} to ${leg.line.to}` : `, ${leg.mode}`} · ${leg.naver}`);
    lines.push("");
  });
  const back = homeLeg(stops, plan.city, offFor);
  if (back){
    lines.push(`Ends back at **${back.home.name}** — ${fmtM(back.metres)}${back.walkable
      ? `, about ${back.walkMin} min on foot` : back.line
        ? `, ${back.line.label} from ${back.line.from} to ${back.line.to}` : `, ${back.mode}`} · ${back.naver}`);
    lines.push("");
  }
  const cautions = orderCautions(stops, plan.city, plan.day);
  if (cautions.length){
    lines.push("## Worth knowing");
    cautions.forEach(c => lines.push(`- ${c.text}`));
    lines.push("");
  }
  lines.push("## What this map does not know");
  lines.push("- How long any hop takes. Rail times between two stops are not computed anywhere:");
  lines.push("  the routing table only knows routes out from the hotel, so each hop carries a");
  lines.push("  Naver Maps link instead of an invented number.");
  lines.push("- Opening hours. Anything above in quotes is prose copied straight from the notes.");
  lines.push("- How busy anywhere is, or how long the queue runs.");
  return lines.join("\n");
}

/** The day as something you can text to someone. Shorter than the brief and with no
    markdown in it: names, the one-line note, and the link you would actually follow. */
export function planShareText(plan, stops, href){
  const lines = [];
  const cityLabel = (LEGS.find(l => l.id === plan.city) || {}).label || plan.city;
  const head = [plan.title || "Day plan", fmtDay(plan.day), cityLabel].filter(Boolean);
  lines.push(head.join(" · "));
  const out = startLeg(stops, plan.city, null);
  if (out) lines.push(`Starts at ${out.home.name} — ${fmtM(out.metres)} to the first stop · ${out.naver}`);
  const legs = planLegs(stops, null);
  stops.forEach((s, i) => {
    const p = s.place;
    if (!p){ lines.push(`${i + 1}. unknown spot "${s.id}"`); return; }
    lines.push(`${i + 1}. ${p.name} — ${p.note || (CATS[p.cat] || {}).label || ""}`);
    if (p.meta) lines.push(`   ${p.meta}`);
    const leg = legs[i];
    if (leg) lines.push(`   ${fmtM(leg.metres)} to the next stop · ${leg.naver}`);
  });
  const back = homeLeg(stops, plan.city, null);
  if (back) lines.push(`Ends back at ${back.home.name} — ${fmtM(back.metres)} · ${back.naver}`);
  if (href) lines.push(`The whole map: ${href}`);
  return lines.join("\n");
}

/* An .ics is a text format with three sharp edges: CRLF endings, escaped commas and
   semicolons, and lines folded at 75 octets with a leading space on the continuation.
   Get one wrong and the file imports as nothing, silently. */
export function icsEscape(s){
  return String(s == null ? "" : s)
    .replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}
/* 75 octets, not 75 characters: the notes are full of ·, — and Korean, and a fold that
   counted characters would break a line in the middle of a UTF-8 sequence. */
export function icsFold(line){
  const out = [];
  let cur = "", n = 0, limit = 74;              // 74 + the CRLF's own room
  for (const ch of String(line)){
    const w = new TextEncoder().encode(ch).length;
    if (n + w > limit){ out.push(cur); cur = " "; n = 1; limit = 73; }
    cur += ch; n += w;
  }
  out.push(cur);
  return out.join("\r\n");
}
export const ICS_PRODID = "-//trip-db//Korea field map//EN";

/** The day as a calendar entry — one all-day event, never a timed schedule. Nothing
    on this map knows when you arrive anywhere or how long a queue runs, and an .ics
    full of invented 10:30s would look authoritative on a phone precisely where it is
    least true. So the day is the event, and the order lives in its description.
    Null without a date: there is nothing to put a calendar entry on. */
export function planIcs(plan, stops, href, opts){
  const o = opts || {};
  if (!planDow(plan.day)) return null;
  const start = plan.day.replace(/-/g, "");
  const end = nextDay(plan.day).replace(/-/g, "");
  const stamp = (o.now instanceof Date ? o.now : new Date(o.now || Date.now()))
    .toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const cityLabel = (LEGS.find(l => l.id === plan.city) || {}).label || plan.city;
  const first = stops.map(s => s.place).find(Boolean);
  const rows = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${ICS_PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    // stable per day and per order, so re-importing an edited day replaces it
    `UID:${plan.day}-${(plan.ids || []).join("-") || "empty"}@trip-db`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${icsEscape(`${plan.title || "Day plan"} · ${cityLabel}`)}`,
    `DESCRIPTION:${icsEscape(planShareText(plan, stops, href))}`,
  ];
  if (first){
    rows.push(`LOCATION:${icsEscape(`${first.name}, ${first.cluster}`)}`);
    rows.push(`GEO:${first.lat};${first.lng}`);
  }
  if (href) rows.push(`URL:${icsEscape(href)}`);
  rows.push("TRANSP:TRANSPARENT", "END:VEVENT", "END:VCALENDAR");
  return rows.map(icsFold).join("\r\n") + "\r\n";
}
