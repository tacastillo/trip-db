import { fitPlan } from "./plan-map.js";
import { plan, planHas, planStops } from "./plan-state.js";
import { routeDraw, spaceLabels } from "./route.js";
import { deselect, select, selectedId } from "./selection.js";
import { active, currentTab, map, night, railOn, setMap } from "./state.js";
import { isMobile } from "./view.js";
import { CATS, PLACES } from "../data/places.js";
import { RAIL } from "../data/rail.js";

/* Leaflet's own objects. Every one of these is written here and nowhere else,
   so the other modules import them as live bindings and always see the current
   value without a setter. */
export const markers = {};
export let baseLayer = null, tilesOk = false;
export let railLayer = null, railRenderer = null;
export let routeLayer = null;

/* Track geometry runs to the real termini now (OpenStreetMap via Overpass, ODbL),
   and every path says how each of its two ends came about: "terminus" is where
   the line actually stops, "junction" is where a branch or loop path meets
   another path of the same line, and "clip" is the 40km cut-off around the city.
   Only a "clip" end is a lie about the network, so only that one gets faded out
   over its last few km. Everything else draws solid, right to the end. */
export const TAPER_STEPS = 8;             // a long dissolve, not a few visible steps
export function railSegments(path){
  const pa = path.pts, ends = path.ends || [];
  const solid = [{ pts: pa, fade: 1 }];
  if (pa.length < 12) return solid;
  const cutA = ends[0] === "clip", cutB = ends[1] === "clip";
  const cuts = (cutA ? 1 : 0) + (cutB ? 1 : 0);
  if (!cuts) return solid;
  // ~3km of fade where there is room, but never more than 40% of a short stub
  const chunk = Math.max(1, Math.min(6, Math.floor(pa.length * 0.4 / (cuts * TAPER_STEPS))));
  const fade = j => (j + 1) / (TAPER_STEPS + 1);   // j = 0 at the tip
  const segs = [];
  let lo = 0, hi = pa.length - 1;
  if (cutA) {
    // chunks overlap by a point so the ramp has no seams
    for (let j = 0; j < TAPER_STEPS; j++) segs.push({ pts: pa.slice(j * chunk, (j + 1) * chunk + 1), fade: fade(j) });
    lo = TAPER_STEPS * chunk;
  }
  if (cutB) {
    for (let j = 0; j < TAPER_STEPS; j++) {
      const b = pa.length - 1 - j * chunk;
      segs.push({ pts: pa.slice(b - chunk, b + 1), fade: fade(j) });
    }
    hi = pa.length - 1 - TAPER_STEPS * chunk;
  }
  if (hi > lo) segs.push({ pts: pa.slice(lo, hi + 1), fade: 1 });
  return segs;
}

/* the day has to read against thirteen coloured lines, so they step back for it */
export function railFade(){ return document.body.classList.contains("planning") ? 0.3 : 1; }
export function drawRail(){
  if (!railLayer || !window.L) return;
  railLayer.clearLayers();
  const casing = night ? "#15120D" : "#ffffff";
  (RAIL[currentTab]||[]).forEach(function(ln){ ln.paths.forEach(function(pa){
    railSegments(pa).forEach(function(sg){
      L.polyline(sg.pts, { renderer: railRenderer, color: casing, weight: 6, opacity: 0.5 * sg.fade * railFade(), lineCap: "round", lineJoin: "round", interactive: false }).addTo(railLayer);
    });
  }); });
  (RAIL[currentTab]||[]).forEach(function(ln){ ln.paths.forEach(function(pa){
    railSegments(pa).forEach(function(sg){
      L.polyline(sg.pts, { renderer: railRenderer, color: ln.color, weight: 3, opacity: 0.92 * sg.fade * railFade(), lineCap: "round", lineJoin: "round", interactive: false }).addTo(railLayer);
    });
  }); });
}

export function setBaseLayer(){
  if (!map) return;
  if (baseLayer) map.removeLayer(baseLayer);
  const style = night ? "dark_all" : "light_all";
  baseLayer = L.tileLayer(`https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`, {
    attribution: "© OpenStreetMap © CARTO", subdomains: "abcd", maxZoom: 20,
  });
  baseLayer.on("load", () => { tilesOk = true; document.getElementById("tilebanner").style.display = "none"; });
  baseLayer.addTo(map);
}


export function fitCity(){
  const pts = PLACES.filter(p => p.city === currentTab).map(p => [p.lat, p.lng]);
  if (!pts.length || !map) return;
  // Tighter padding than a plain fitBounds — the rail now runs off every edge
  // by itself, so this is purely about not stranding the pins in dead space.
  const pad = isMobile() ? 16 : 40;
  map.fitBounds(L.latLngBounds(pts), { padding: [pad, pad], animate: false });
}
export function initMap(){
  setMap(L.map("map", { scrollWheelZoom: true, zoomSnap: 0.25 }).setView([37.5535, 126.9905], 12));

  setBaseLayer();

  // the fade multiplies the polyline count, so draw the rail on canvas to keep panning cheap.
  // Its own pane below the overlay lets a picked route drop the whole network back a step.
  map.createPane("railPane").style.zIndex = 380;
  railRenderer = L.canvas({ padding: 0.4, pane: "railPane" });
  railLayer = L.layerGroup();
  if (railOn) railLayer.addTo(map);
  drawRail();
  routeLayer = L.layerGroup().addTo(map);
  map.on("click", () => { if (selectedId) deselect(); });
  // station labels pick their side from the map centre, which panning moves out from under them
  map.on("moveend", () => {
    if (!routeDraw) return;
    routeLayer.eachLayer(l => { const t = l.getTooltip && l.getTooltip(); if (t) t.update(); });
    spaceLabels();
  });

  PLACES.forEach(p => {
    const m = L.marker([p.lat, p.lng], { icon: pinIcon(p, null) });
    m.on("click", () => select(p.id));
    markers[p.id] = m;
    if (p.city === currentTab) m.addTo(map);
    if (selectedId === p.id) markPin(p.id, true);
  });

  // a day restored from the link has to reach the pins before they are first drawn
  syncMarkers();
  if (document.body.classList.contains("planning")) drawRail();
  // opening a plan link and landing on the whole city hides the very thing the link
  // was for, so a day in the URL frames itself instead
  if (planStops().some(s => s.place)) fitPlan(); else fitCity();

  // Tiles are the one thing still fetched live. Everything else ships with the page,
  // so losing them degrades to pins-on-a-blank-canvas rather than a broken map.
  setTimeout(() => { if (!tilesOk) showTileBanner(); }, 3500);
  window.addEventListener("offline", showTileBanner);
  window.addEventListener("online", () => {
    document.getElementById("tilebanner").style.display = "none";
    if (baseLayer) baseLayer.redraw();
  });
}

export function showTileBanner(){
  const b = document.getElementById("tilebanner");
  b.textContent = navigator.onLine
    ? "Street tiles aren’t loading — the pins, subway lines, notes and list all still work."
    : "Offline, so no street tiles — the pins, subway lines, notes and list all still work.";
  b.style.display = "block";
}

/* The pin a planned stop gets: the same shape and category colour, carrying its place
   in the day instead of its emoji. One marker per stop, not a pin plus a chip beside it. */
export function pinIcon(p, n){
  const c = CATS[p.cat] || {};
  return L.divIcon({
    className: "",
    html: `<div class="pin${n ? " plan" : ""}" style="--pin:${c.color}">
             <div class="pin-b"><span${n ? ' class="pin-n"' : ""}>${n || c.emoji}</span></div></div>`,
    iconSize: [30, 30], iconAnchor: [15, 30],
  });
}

export function syncMarkers(){
  if (!map) return;
  const order = {};
  planStops().forEach((s, i) => { if (s.place) order[s.id] = i + 1; });
  document.body.classList.toggle("planning",
    currentTab === plan.city && Object.keys(order).length > 0);
  PLACES.forEach(p => {
    const m = markers[p.id]; if (!m) return;
    const n = order[p.id] || null;
    // setIcon rebuilds the element, so only touch it when the number actually changed
    if (m._planN !== n){
      m._planN = n;
      m.setIcon(pinIcon(p, n));
      if (selectedId === p.id) markPin(p.id, true);
    }
    const el = m.getElement();
    if (el) el.classList.toggle("mk-plan", !!n);
    // a planned stop stays on the map whatever the chips say — otherwise its number
    // in the plan points at a pin that isn't there
    if (p.city === currentTab && (active[p.cat] || planHas(p.id))) { if (!map.hasLayer(m)) m.addTo(map); }
    else { if (map.hasLayer(m)) map.removeLayer(m); }
  });
  // filtering the selected pin away shouldn't leave its card and ride stranded
  const sel = selectedId && PLACES.find(x => x.id === selectedId);
  if (sel && !(sel.city === currentTab && (active[sel.cat] || planHas(sel.id)))) deselect();
}

export function markPin(id, on){
  const m = markers[id], el = m && m.getElement();
  if (el) el.classList.toggle("mk-sel", on);
}
