import { renderLegend } from "./legend.js";
import { renderList, scrollListTop } from "./list.js";
import { save, saved } from "./store.js";
import { map } from "./state.js";
import { setToolBtn } from "./toolbtn.js";
import { PLACES } from "../data/places.js";
import { metres } from "../lib/geo.js";
import { fmtM, hereOrigin } from "../lib/plan-core.js";
import { cssVar } from "./theme.js";

/* Where you are standing. On the ground this is the question the map was missing: not
   "how far is Gwangjang from the hotel" but "what is near me, now, and which way is
   it". Nothing is stored and nothing is sent anywhere — the position lives in this
   module for as long as the tab is open and the browser keeps handing it over.

   It is opt-in and stays that way: a page that asks for a location on load gets the
   permission prompt denied once and then never gets another chance. */

export let here = null;                  // { lat, lng, acc } in the browser's own words
export let locating = false;             // is the watch running
export let watchId = null;
export let meMarker = null, meRing = null;
export let nearFirst = !!saved.nearFirst;   // the list, sorted by how far away it is

/* Below this the dot has not really moved and re-sorting the list under a thumb would
   be its own kind of broken. GPS wander in a city street is comfortably inside it. */
export const MOVE_REDRAW_M = 25;
export let lastSort = null;

/* What every hand-off link on this page starts from. A fix if there is one, and the
   place that used to be the only answer — the hotel — if there is not. See hereOrigin()
   in lib/plan-core.js for why the hotel was the wrong default for all but one hop a day.
   `to` is the destination, and it is what lends the origin a city. */
export function dirOrigin(fallback, to){
  return hereOrigin(here, to || fallback) || fallback || null;
}

/* Redrawn when a fix first arrives or is given up, handed in the way palette.js is
   handed its redraw: an open card says where its links start from, and that sentence
   stops being true the moment the dot appears. Set by main.js; a page with no card
   (the two tool pages) sets none. */
let onFix = null;
export const setGeoFixHandler = (fn) => { onFix = fn; };

export function distanceFrom(p){
  return here ? metres([here.lat, here.lng], [p.lat, p.lng]) : null;
}
/** Metres to a place, as the rest of the page words distance. */
export function distanceLabel(p){
  const d = distanceFrom(p);
  return d == null ? "" : fmtM(d);
}

export function geoBanner(msg){
  const b = document.getElementById("geobanner");
  if (!b) return;
  b.textContent = msg || "";
  b.style.display = msg ? "block" : "none";
}

export function setNearFirst(on){
  nearFirst = !!on;
  save({ nearFirst });
  renderList();
  scrollListTop();
}

export function meIcon(){
  return L.divIcon({ className:"", html:'<div class="medot"></div>', iconSize:[18, 18], iconAnchor:[9, 9] });
}

export function drawMe(pan){
  if (!map || !here || !window.L) return;
  const at = [here.lat, here.lng];
  if (!meMarker){
    meMarker = L.marker(at, { icon: meIcon(), interactive:false, zIndexOffset:1000 });
    // the accuracy circle is the honest part: a 900m fix from wifi should not look
    // like a 5m fix from GPS just because both draw the same dot
    const blue = cssVar("--me");
    meRing = L.circle(at, { radius: here.acc || 0, color:blue, weight:1,
                            opacity:.5, fillColor:blue, fillOpacity:.10, interactive:false });
    meRing.addTo(map); meMarker.addTo(map);
  } else {
    meMarker.setLatLng(at);
    meRing.setLatLng(at).setRadius(here.acc || 0);
  }
  if (pan) map.setView(at, Math.max(map.getZoom(), 15), { animate:true });
}

export function clearMe(){
  if (meMarker && map) map.removeLayer(meMarker);
  if (meRing && map) map.removeLayer(meRing);
  meMarker = meRing = null;
}

/** Fill in every "N m away" the list has put on the page. Written in place rather than
    by re-rendering: a re-render every time the GPS twitches would throw away the
    list's scroll position and the search box's focus. */
export function refreshDistances(){
  document.querySelectorAll("[data-dist]").forEach(el => {
    const p = PLACES.find(x => x.id === el.dataset.dist);
    const d = p && distanceFrom(p);
    el.textContent = d == null ? "" : `${fmtM(d)} away`;
    // the stylesheet hides these by default, so "" would hide them again
    el.style.display = d == null ? "none" : "block";
  });
}

export function onPosition(pos){
  const moved = here ? metres([here.lat, here.lng], [pos.coords.latitude, pos.coords.longitude]) : Infinity;
  const first = !here;
  here = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
  geoBanner("");
  drawMe(first);
  refreshDistances();
  if (first) renderLegend();          // the "nearest first" chip only exists with a fix
  // a sorted list is the one thing a small drift really does reorder
  if (nearFirst && (lastSort == null || moved > MOVE_REDRAW_M)){ lastSort = Date.now(); renderList(); }
  else if (first) renderList();
  // an open card's directions now start here rather than at the hotel, and it says so
  if (first && onFix) onFix();
  syncMeButton();
}

export function onGeoError(e){
  // 1 PERMISSION_DENIED · 2 POSITION_UNAVAILABLE · 3 TIMEOUT
  const msg = e && e.code === 1
    ? "Location is blocked for this page — allow it in the address bar to see where you are."
    : e && e.code === 3
      ? "Still looking for a fix. Indoors and underground this can take a while."
      : "Could not work out where you are. Everything else still works.";
  geoBanner(msg);
  if (e && e.code === 1) stopLocating();
  syncMeButton();
}

export function startLocating(){
  if (!navigator.geolocation){
    geoBanner("This browser will not share a location, so distances are from the map only.");
    return;
  }
  locating = true;
  geoBanner("Finding you…");
  renderLegend();
  syncMeButton();
  watchId = navigator.geolocation.watchPosition(onPosition, onGeoError,
    { enableHighAccuracy:true, maximumAge:10000, timeout:20000 });
}

export function stopLocating(){
  if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
  watchId = null; locating = false; here = null; lastSort = null;
  clearMe();
  refreshDistances();
  renderLegend();
  if (nearFirst) renderList();
  if (onFix) onFix();       // and back to the hotel, which the card also has to say
  syncMeButton();
}

/** One button, three things it can sensibly mean. Off, it starts. On and looking
    somewhere else, it brings the map back to you — which is what you want nine times
    out of ten and is otherwise a second control taking up thumb room. On and already
    centred on you, it stops, because by then that is the only thing left to ask for. */
export function toggleLocating(){
  if (!locating) return startLocating();
  if (here && map && metres([here.lat, here.lng], [map.getCenter().lat, map.getCenter().lng]) > 40)
    return drawMe(true);
  stopLocating();
}

export function syncMeButton(){
  const b = document.getElementById("meToggle");
  if (!b) return;
  b.classList.toggle("on", locating);
  setToolBtn(b, "me", locating ? (here ? "Here" : "…") : "Me");
  b.title = locating ? "Centre the map on you, or tap again to stop"
                     : "Show where you are and how far things are";
}
