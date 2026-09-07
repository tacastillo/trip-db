import { renderLegend } from "./legend.js";
import { renderList, scrollListTop } from "./list.js";
import { save, saved } from "./store.js";
import { allTab, currentTab, map } from "./state.js";
import { setToolBtn } from "./toolbtn.js";
import { LEGS, PLACES } from "../data/places.js";
import { legForPoint, metres } from "../lib/geo.js";
import { fmtM } from "../lib/plan-core.js";
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

/* Redrawn when a fix first arrives or is given up, handed in the way palette.js is
   handed its redraw: an open card carries "N m away" in its subtitle, and that line is
   not there at all until the dot is. Set by main.js; a page with no card (the two tool
   pages) sets none. */
let onFix = null;
export const setGeoFixHandler = (fn) => { onFix = fn; };

/* Switching leg, handed in the same way and for the same reason: this module may not
   import tabs.js — tabs renders the list, and the list reads the distances from here.
   main.js hands it setTab; the two tool pages have no map and hand it nothing. */
let onLeg = null;
export const setGeoLegHandler = (fn) => { onLeg = fn; };

/** The leg you are standing in, or null if that is nowhere this trip goes. */
export function legHere(){
  return here ? legForPoint([here.lat, here.lng], PLACES) : null;
}

/* It offers; it does not take over.

   The first cut of this switched the map to whatever leg the fix landed in. That is
   right often enough to be tempting and wrong in the case that matters: looking up
   Seoul while standing in Busan is a thing people do all the time — planning tomorrow,
   answering "what was that place" — and a page that yanks you back every time you ask
   where you are has taken a decision off you that was never its to make. The map does
   what you last told it, and a fix is not an instruction.

   So the mismatch is stated and the switch is one tap, which is the same bargain the
   plan pane already strikes with "This day is in Jeju — Show Jeju". Offered once per
   arrival in a leg, so it cannot nag: crossing into a new one offers again, and tapping
   📍 yourself always does, because that is you asking. */
let offeredLeg = null, offerFor = null, offerTimer = null, offerShown = false;

/* Twenty seconds is long enough to read a line and tap it, and short enough that a line
   you have decided to ignore is not still sitting over the map you chose to look at. */
export const OFFER_MS = 20000;

export function syncLegOffer(asked){
  const leg = legHere();
  // A new leg under your feet, or you asking outright, is what puts the offer up — and
  // the clock starts there rather than on every redraw, or a watch handing over a fix
  // every few seconds would keep pushing the deadline back and the line would never go.
  if (leg && (leg !== offeredLeg || asked)){
    offerFor = leg;
    clearTimeout(offerTimer);
    offerTimer = setTimeout(() => { if (offerFor === leg) retractOffer(); }, OFFER_MS);
  }
  offeredLeg = leg;
  /* And nothing to offer when the map is already showing it — "Everywhere" is showing
     it, which is the other half of this change and the better answer to the same
     question: on that tab the pins around you are on screen whatever the date says. */
  if (!leg || leg === currentTab || allTab() || !onLeg) offerFor = null;
  // taking it down is as much this function's job as putting it up: switching to Jeju by
  // hand answers the offer, and only the line we put there is ours to clear
  if (!offerFor){ if (offerShown) retractOffer(); return; }
  const label = (LEGS.find(l => l.id === offerFor) || {}).label || offerFor;
  const leaving = offerFor;
  geoBanner(`You’re in ${label}.`,
    { label: `Show ${label}`, run: () => { offerFor = null; offerShown = false; onLeg(leaving); } });
  offerShown = true;
}

function retractOffer(){
  offerFor = null;
  offerShown = false;
  clearTimeout(offerTimer);
  geoBanner("");
}

export function distanceFrom(p){
  return here ? metres([here.lat, here.lng], [p.lat, p.lng]) : null;
}

/* The banner, with an optional way out of what it is telling you. A line that names a
   problem and hands you the fix is one tap; the same line on its own is a line you have
   to work out what to do about, standing in a street. */
export function geoBanner(msg, action){
  const b = document.getElementById("geobanner");
  if (!b) return;
  offerShown = !!action;      // anything else written here has taken the offer's place
  b.textContent = msg || "";
  if (msg && action){
    const btn = document.createElement("button");
    btn.className = "gb-fix";
    btn.textContent = action.label;
    btn.onclick = () => { geoBanner(""); action.run(); };
    b.appendChild(btn);
  }
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
/* Filled in place rather than by re-rendering: a re-render throws away the list's scroll
   position and the search box's focus. The root is the list when the list has just drawn
   itself and the whole page when a new fix has arrived — the same loop either way, which
   is why it is one function and not one per caller. It lives here rather than in list.js
   because distanceFrom does, and list.js already imports this module: the other direction
   is the cycle that keeps tabs.js out of here too. */
export function fillDistances(root){
  (root || document).querySelectorAll("[data-dist]").forEach(el => {
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
  // and, if the map is showing a city you are not in, one line saying so and one tap out
  syncLegOffer(false);
  fillDistances();
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
  offeredLeg = null; retractOffer();
  clearMe();
  fillDistances();
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
  // you asked, so the offer is made again even if it was ignored the first time
  syncLegOffer(true);
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
