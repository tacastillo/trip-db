/* Hotel to door: which station you get off at, which lines take you there, and the
   shape of the track between them. Traced from the geometry, never stored. */

import { AUTO_WALK_MAX, HOTEL_STATION, PLACE_OFF, RIDE_KMH, ROUTES, STATION_COORDS, WALK_BEND, WALK_KMH, XFER_MIN } from "../data/routing.js";
import { metres } from "./geo.js";
import { HOP_WALKABLE_M, hotelFor } from "./plan-core.js";
import { lineMeta, measure, railGraph, ride, tidy } from "./rail.js";

/* hotel → …transfers… → the station you get off at → the door */
export const journeys = {};
export function journeyFor(p){
  if (!(p.id in journeys)) journeys[p.id] = buildJourney(p);
  return journeys[p.id];
}

export function offStationFor(p){
  if (PLACE_OFF[p.id]) return PLACE_OFF[p.id];
  if (p.cat === "hotel") return null;             // the ride starts here
  let best = null;
  for (const s in STATION_COORDS){
    if (!ROUTES[s]) continue;
    const d = metres([p.lat, p.lng], STATION_COORDS[s]);
    if (!best || d < best.d) best = { s, d };
  }
  return best && best.d <= AUTO_WALK_MAX ? best.s : null;
}
/* The walk out of the front door, as a journey of one leg. The hotel place is the
   start rather than HOTEL_STATION: this is the walk you actually take, and it begins
   at the door, not on a platform. */
export function walkJourney(p){
  const home = hotelFor(p.city);
  if (!home || home.id === p.id) return null;
  const a = [home.lat, home.lng], b = [p.lat, p.lng];
  const legs = [{ kind: "walk", from: home.name, to: p.name, pts: [a, b] }];
  legs.forEach(l => { l.cum = measure(l.pts); l.len = l.cum[l.cum.length - 1]; });
  const walk = legs[0].len * WALK_BEND;
  return {
    kind: "walk", off: null, legs, rail: [], ridden: 0, walk,
    box: [[Math.min(a[0], b[0]), Math.min(a[1], b[1])], [Math.max(a[0], b[0]), Math.max(a[1], b[1])]],
    minutes: Math.max(1, Math.round(walk / 1000 / WALK_KMH * 60)),
  };
}

/* One per statement: tools/lib.mjs finds a constant by the literal text `const NAME = `. */
export const RIDE_WORTH_MIN = 3;

/* A ride has to earn itself against the walk, because a table rooted at one hotel will
   happily route you around the block. DDP is one street from the door and this page had
   you riding Line 4 out to Dongdaemun, changing, coming back down Line 1 and walking a
   kilometre — 21 minutes for a seven-minute walk — because the nearest station with a
   ROUTES entry was never the station you would use for a spot that close.
   So the walk wins twice over: inside HOP_WALKABLE_M, where the rest of the page has
   already stopped calling a ride advice, and anywhere past it where walking beats the
   traced ride by more than the estimates are worth — a ride that merely ties a walk is
   a change of trains for nothing. Everything else still gets its ride. */
export function buildJourney(p){
  if (p.cat === "hotel") return null;             // the ride starts here
  const walk = walkJourney(p), rail = railJourney(p);
  if (!rail) return walk && walk.walk <= HOP_WALKABLE_M ? walk : null;
  if (!walk) return rail;
  return (walk.walk <= HOP_WALKABLE_M || walk.minutes + RIDE_WORTH_MIN <= rail.minutes) ? walk : rail;
}

export function railJourney(p){
  const off = offStationFor(p);
  if (!off || !ROUTES[off] || !STATION_COORDS[off] || !STATION_COORDS[HOTEL_STATION]) return null;
  const legs = [];
  let from = HOTEL_STATION;
  for (const leg of ROUTES[off]){
    const g = railGraph(p.city, leg.line), a = STATION_COORDS[from], b = STATION_COORDS[leg.to];
    if (!g || !a || !b) return null;
    const traced = ride(g, a, b);
    if (!traced) return null;
    const m = lineMeta(leg.line, p.city);
    // both ends run to the station dots, so the drawn ride starts and stops where the labels do
    legs.push({ kind: "rail", line: leg.line, label: m.label, color: m.color,
                from, to: leg.to, pts: tidy([a, ...traced, b]) });
    from = leg.to;
  }
  legs.push({ kind: "walk", from: off, to: p.name, pts: [STATION_COORDS[off], [p.lat, p.lng]] });
  legs.forEach(l => { l.cum = measure(l.pts); l.len = l.cum[l.cum.length - 1]; });
  const rail = legs.filter(l => l.kind === "rail");
  const walk = legs[legs.length - 1].len * WALK_BEND;
  const ridden = rail.reduce((s, l) => s + l.len, 0);
  const box = [[90, 180], [-90, -180]];
  legs.forEach(l => l.pts.forEach(pt => {
    box[0][0] = Math.min(box[0][0], pt[0]); box[0][1] = Math.min(box[0][1], pt[1]);
    box[1][0] = Math.max(box[1][0], pt[0]); box[1][1] = Math.max(box[1][1], pt[1]);
  }));
  return {
    kind: "rail", off, legs, rail, box, ridden, walk,
    minutes: Math.max(1, Math.round(ridden / 1000 / RIDE_KMH * 60
      + (rail.length - 1) * XFER_MIN + walk / 1000 / WALK_KMH * 60)),
  };
}

