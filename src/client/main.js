import { renderLegend } from "./legend.js";
import { renderList } from "./list.js";
import { drawRail, initMap, railLayer, routeLayer, setBaseLayer } from "./map.js";
import { bootPlan } from "./plan-boot.js";
import { planHref } from "./plan-pane.js";
import { plan, planAdd, planClear, planOver, planRemove, planReorder, planToggle, setSideTab } from "./plan-state.js";
import { applyRailLegendState, railLegendOpen, renderRailLegend, setRailLegendOpen } from "./rail-legend.js";
import { routeDraw, showRoute } from "./route.js";
import { deselect, focus, resyncSelection, select, selectedId } from "./selection.js";
import { currentTab, map, night, railOn, setNight, setRailOn } from "./state.js";
import { setTab } from "./tabs.js";
import { bootNav, closeNav, openNav, openTools, setNavHandler } from "./nav.js";
import { isMobile, setView } from "./view.js";
import { save } from "./store.js";
import { setToolBtn } from "./toolbtn.js";
import { applyPalette, armPaletteEgg, bootPalette, palette, setBasemapHandler, setPaletteHandler, syncPaletteEgg } from "./palette.js";
import { applyBasemap, basemap, bootBasemap } from "./basemap.js";
import { here, locating, setGeoFixHandler, startLocating, stopLocating, syncMeButton, toggleLocating } from "./geo-me.js";
import { packSize, registerSW, savePack, syncOfflineButton } from "./offline.js";
import { hideVisited, setHideVisited, visited } from "./visited.js";
import { CATS, PLACES } from "../data/places.js";
import { RAIL } from "../data/rail.js";

/* ---------------- go ---------------- */
bootPalette();       // before anything paints, so nothing paints in the wrong palette
bootBasemap();       // and the tile layer is built from this, so it has to be first too
bootPlan();          // reads the link, so currentTab is right before anything renders
/* nav.js cannot import tabs.js without a cycle, so it is handed the switch instead —
   the same shape as setPaletteHandler below. Booted after bootPlan so the trigger
   opens saying the leg the link or the store actually landed on. */
setNavHandler(setTab);
/* And geo-me is handed the card's redraw for the same reason: an open card says where
   its two hand-off links start from, and a fix arriving changes that sentence from the
   hotel to you. geo-me may not import selection.js — selection imports card.js, which
   imports geo-me. */
setGeoFixHandler(resyncSelection);
bootNav();
renderLegend();
renderList();

export const nightBtn = document.getElementById("nightToggle");
/* The body ships with class="night" so the first paint is never a white flash; if this
   browser remembered otherwise, that is undone here rather than in the markup. */
export function applyNight(){
  document.body.classList.toggle("night", night);
  setToolBtn(nightBtn, night ? "day" : "night", night ? "Day" : "Night");
}
applyNight();
if (nightBtn) nightBtn.onclick = () => {
  setNight(!night);
  save({ night });
  applyNight();
  setBaseLayer();
  drawRail();
  // the casing under a drawn route is painted in the page background colour
  const sel = selectedId && PLACES.find(x => x.id === selectedId);
  if (sel && routeDraw) showRoute(sel);
};

/* Swapping palette while the page is up, for driving it from a browser: the map paints
   from tokens through cssVar(), so whatever is already drawn has to be drawn again —
   the same redraw the night toggle does, and for the same reason. */
export function setPalette(name){
  const now = applyPalette(name);
  save({ palette: now });
  drawRail();
  const sel = selectedId && PLACES.find(x => x.id === selectedId);
  if (sel && routeDraw) showRoute(sel);
  return now;
}
/* The panel picks a palette; this is what makes the map follow. palette.js cannot
   import map.js without a cycle, so it is handed the redraw rather than reaching for it. */
setPaletteHandler(setPalette);

/* Changing the base rebuilds the tile layer, and the offline button has to be asked
   again: a pack downloaded in one style cannot serve another, and saying "Saved" when
   that is untrue is the failure this whole change exists to stop. */
export function setBasemap(name){
  const now = applyBasemap(name);
  save({ basemap: now });
  setBaseLayer();
  syncOfflineButton();
  syncPaletteEgg();
  return now;
}
setBasemapHandler(setBasemap);
/* and the way in: five taps on the title. There is no button — see palette.js. */
armPaletteEgg(document.querySelector(".title"));

export const railBtn = document.getElementById("railToggle");
if (railBtn) railBtn.classList.toggle("on", railOn);
if (railBtn) railBtn.onclick = () => {
  setRailOn(!railOn);
  save({ railOn });
  railBtn.classList.toggle("on", railOn);
  if (map && railLayer) { railOn ? railLayer.addTo(map) : map.removeLayer(railLayer); }
  const rl = document.getElementById("raillegend"); if (rl) rl.style.display = railOn ? "" : "none";
};

renderRailLegend();
export const railLegendEl = document.getElementById("raillegend");
if (railLegendEl) railLegendEl.addEventListener("click", () => {
  if (!isMobile()) return;
  setRailLegendOpen(!railLegendOpen);
  applyRailLegendState();
});

export const meBtn = document.getElementById("meToggle");
if (meBtn) meBtn.onclick = () => toggleLocating();
syncMeButton();

export const offlineBtnEl = document.getElementById("offlineToggle");
if (offlineBtnEl) offlineBtnEl.onclick = () => savePack();
syncOfflineButton();

document.addEventListener("keydown", e => { if (e.key === "Escape" && selectedId) deselect(); });

export function libFail(){
  const b = document.getElementById("tilebanner");
  b.textContent = "The map library in vendor/leaflet didn’t load. The list, filters and notes still work.";
  b.style.display = "block";
}
export function bootMap(){
  // Leaflet ships in this repo, so if it isn't here the file itself is broken — no CDN to retry.
  window.L ? initMap() : libFail();
}
bootMap();

/* Last, and deliberately after the page is up: registering a worker kicks off fetches
   of its own, and none of them are more urgent than the map drawing. */
registerSW();
/* index.html declared all of this in the global scope, which is what made the page
   drivable from a console or a browser test: focus("gwangjang"), then look at
   map.getCenter(). A bundled module exposes nothing at all, so the same handles are
   published here deliberately — CLAUDE.md's browser-driving recipe reaches for them.
   Getters rather than values, because most of what is worth looking at is reassigned
   as the page runs. */
window.trip = {
  focus, select, deselect, setTab, setSideTab, setView, setPalette, setBasemap,
  openNav, openTools, closeNav,
  planAdd, planRemove, planToggle, planClear, planReorder, planHref,
  startLocating, stopLocating, savePack, packSize, setHideVisited,
  PLACES, CATS, RAIL,
  get map(){ return map; },
  get railLayer(){ return railLayer; },
  get routeLayer(){ return routeLayer; },
  get routeDraw(){ return routeDraw; },
  get selectedId(){ return selectedId; },
  get currentTab(){ return currentTab; },
  get plan(){ return plan; },
  get planOver(){ return planOver; },
  get here(){ return here; },
  get locating(){ return locating; },
  get visited(){ return [...visited]; },
  get hideVisited(){ return hideVisited; },
  get palette(){ return palette; },
  get basemap(){ return basemap; },
};

