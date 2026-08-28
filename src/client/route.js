import { routeLayer } from "./map.js";
import { map } from "./state.js";
import { CATS } from "../data/places.js";
import { HOTEL_STATION, STATION_COORDS } from "../data/routing.js";
import { lerpPt } from "../lib/geo.js";
import { journeyFor } from "../lib/journey.js";
import { cssVar } from "./theme.js";

/* ---------------- drawing and animating the ride ---------------- */
export let routeAnim = null, routeDraw = null;
export const lessMotion = window.matchMedia("(prefers-reduced-motion:reduce)");

export function stationDots(j){
  const stops = [{ name: HOTEL_STATION, kind: "board", kicker: "Board", tint: CATS.hotel.color }];
  j.rail.forEach((leg, i) => {
    const last = i === j.rail.length - 1;
    const next = last ? null : j.rail[i + 1];
    stops.push({
      name: leg.to,
      kind: last ? "off" : "transfer",
      kicker: last ? "Get off here" : "Transfer → " + next.label,
      tint: leg.color, then: next ? next.color : null,
    });
  });
  stops.forEach(s => {
    const c = STATION_COORDS[s.name]; if (!c) return;
    if (s.kind === "off"){
      L.circleMarker(c, { radius: 7, color: cssVar("--accent"), weight: 2, opacity: .9,
        fill: false, interactive: false, className: "rs-ping" }).addTo(routeLayer);
    }
    const fill = s.kind === "off" ? cssVar("--accent") : s.tint;
    const dot = L.circleMarker(c, { radius: s.kind === "board" ? 5.5 : s.kind === "off" ? 7 : 8,
      color: cssVar("--pin-edge"), weight: 2.5, fillColor: fill, fillOpacity: 1, interactive: false }).addTo(routeLayer);
    // a transfer wears both lines: the one arriving outside, the one leaving in the middle
    if (s.kind === "transfer" && s.then){
      L.circleMarker(c, { radius: 3.6, stroke: false, fillColor: s.then, fillOpacity: 1,
        interactive: false }).addTo(routeLayer);
    }
    dot.bindTooltip(`<span class="rs-k">${s.kicker}</span>${s.name}`,
      { permanent: true, direction: "auto", className: "rs-tip " + s.kind, offset: [9, 0] });
  });
}

/* Permanent labels don't know about each other, and two stations a few hundred
   metres apart put theirs in the same place. Push the later ones clear. */
export function spaceLabels(){
  if (!routeDraw || !routeLayer) return;
  const els = [];
  routeLayer.eachLayer(l => {
    const t = l.getTooltip && l.getTooltip(), el = t && t.getElement();
    if (el){ el.style.marginTop = ""; els.push(el); }
  });
  if (els.length < 2) return;
  els.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  for (let i = 1; i < els.length; i++){
    let shift = 0;
    for (let k = 0; k < i; k++){
      const prev = els[k].getBoundingClientRect(), cur = els[i].getBoundingClientRect();
      const down = Math.min(prev.bottom, cur.bottom) - Math.max(prev.top, cur.top);
      const across = Math.min(prev.right, cur.right) - Math.max(prev.left, cur.left);
      if (down > -3 && across > -3){
        shift += prev.bottom + 5 - cur.top;
        els[i].style.marginTop = shift + "px";
      }
    }
  }
}

export function showRoute(p){
  clearRoute();
  if (!routeLayer || !map || !window.L) return;
  const j = journeyFor(p);
  if (!j) return;
  document.body.classList.add("routing");
  const casing = cssVar("--casing");
  const accent = cssVar("--accent");
  const shapes = j.legs.map(leg => {
    const walking = leg.kind === "walk";
    const color = walking ? accent : leg.color;
    // glow first so it sits under the casing; its opacity is the pulse, in CSS
    const glow = L.polyline([], { color, weight: walking ? 10 : 16, opacity: 1,
      lineCap: "round", lineJoin: "round", interactive: false, className: "rs-glow" }).addTo(routeLayer);
    const under = L.polyline([], { color: casing, weight: walking ? 6 : 9, opacity: .55,
      lineCap: "round", lineJoin: "round", interactive: false }).addTo(routeLayer);
    const over = L.polyline([], { color, weight: walking ? 3 : 5, opacity: .96,
      lineCap: "round", lineJoin: "round", dashArray: walking ? "1 8" : null,
      interactive: false }).addTo(routeLayer);
    return { leg, glow, under, over, color, start: 0 };
  });
  let run = 0;
  shapes.forEach(s => { s.start = run; run += s.leg.len; });
  const total = run;
  // the moving head rides on top of everything the legs drew
  const comet = L.polyline([], { color: "#fff", weight: 3, opacity: .95,
    lineCap: "round", lineJoin: "round", interactive: false }).addTo(routeLayer);
  const head = L.circleMarker(j.legs[0].pts[0], { radius: 4.5, color: "#fff", weight: 2,
    fillColor: accent, fillOpacity: 1, interactive: false }).addTo(routeLayer);
  stationDots(j);
  routeDraw = { shapes, comet, head, total, j };
  requestAnimationFrame(spaceLabels);
  hideComet();
  if (lessMotion.matches || total <= 0){ revealTo(total); return; }
  animateRoute();
}

export function revealTo(dist){
  if (!routeDraw) return;
  routeDraw.shapes.forEach(s => {
    const local = dist - s.start;
    if (local <= 0){ s.glow.setLatLngs([]); s.under.setLatLngs([]); s.over.setLatLngs([]); return; }
    const pts = s.leg.pts, cum = s.leg.cum, out = [pts[0]];
    for (let i = 1; i < pts.length; i++){
      if (cum[i] <= local){ out.push(pts[i]); continue; }
      const span = cum[i] - cum[i - 1];
      out.push(lerpPt(pts[i - 1], pts[i], span > 0 ? (local - cum[i - 1]) / span : 1));
      break;
    }
    s.glow.setLatLngs(out); s.under.setLatLngs(out); s.over.setLatLngs(out);
  });
}

export function pointAt(dist){
  const shapes = routeDraw.shapes;
  let s = shapes[0];
  for (const sh of shapes) if (dist >= sh.start) s = sh;
  const local = Math.max(0, Math.min(s.leg.len, dist - s.start));
  const pts = s.leg.pts, cum = s.leg.cum;
  let i = 1;
  while (i < pts.length - 1 && cum[i] < local) i++;
  const span = cum[i] - cum[i - 1];
  return { pt: lerpPt(pts[i - 1], pts[i], span > 0 ? (local - cum[i - 1]) / span : 1), shape: s };
}

export function drawComet(from, to){
  const { comet, head, total } = routeDraw;
  const a = Math.max(0, from), b = Math.min(total, to);
  if (b <= a){ hideComet(); return; }
  const tail = pointAt(a), tip = pointAt(b);
  const out = [tail.pt];
  routeDraw.shapes.forEach(s => s.leg.pts.forEach((pt, i) => {
    const d = s.start + s.leg.cum[i];
    if (d > a && d < b) out.push(pt);
  }));
  out.push(tip.pt);
  comet.setLatLngs(out);
  head.setLatLng(tip.pt);
  if (routeDraw.tint !== tip.shape.color){
    routeDraw.tint = tip.shape.color;
    head.setStyle({ opacity: 1, fillOpacity: 1, fillColor: tip.shape.color });
  }
}
export function hideComet(){
  if (!routeDraw) return;
  routeDraw.comet.setLatLngs([]);
  routeDraw.tint = null;
  routeDraw.head.setStyle({ opacity: 0, fillOpacity: 0 });
}

export function animateRoute(){
  const total = routeDraw.total;
  const revealMs = Math.max(900, Math.min(2400, total * .26));
  const runMs = Math.max(1500, Math.min(3400, total * .34));
  const restMs = 600;
  const tail = Math.max(350, total * .13);
  let t0 = null, whole = false;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const step = ts => {
    if (!routeDraw) return;
    if (t0 === null) t0 = ts;
    const el = ts - t0;
    if (el < revealMs){
      revealTo(ease(el / revealMs) * total);
    } else {
      if (!whole){ revealTo(total); whole = true; }
      const c = (el - revealMs) % (runMs + restMs);
      if (c < runMs){
        const tip = (c / runMs) * (total + tail);
        drawComet(tip - tail, tip);
      } else hideComet();
    }
    routeAnim = requestAnimationFrame(step);
  };
  routeAnim = requestAnimationFrame(step);
}

export function clearRoute(){
  if (routeAnim){ cancelAnimationFrame(routeAnim); routeAnim = null; }
  routeDraw = null;
  if (routeLayer) routeLayer.clearLayers();
  document.body.classList.remove("routing");
}

