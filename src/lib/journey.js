/* Hotel to door: which station you get off at, which lines take you there, and the
   shape of the track between them. Traced from the geometry, never stored. */

import { AUTO_WALK_MAX, HOTEL_STATION, PLACE_OFF, RIDE_KMH, ROUTES, STATION_COORDS, WALK_BEND, WALK_KMH, XFER_MIN } from "../data/routing.js";
import { metres } from "./geo.js";
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
export function buildJourney(p){
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
    off, legs, rail, box, ridden, walk,
    minutes: Math.max(1, Math.round(ridden / 1000 / RIDE_KMH * 60
      + (rail.length - 1) * XFER_MIN + walk / 1000 / WALK_KMH * 60)),
  };
}

