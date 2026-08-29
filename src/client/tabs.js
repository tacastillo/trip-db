import { renderLegend } from "./legend.js";
import { renderList } from "./list.js";
import { drawRail, fitCity, syncMarkers } from "./map.js";
import { renderPlan } from "./plan-pane.js";
import { plan } from "./plan-state.js";
import { syncOfflineButton } from "./offline.js";
import { renderRailLegend } from "./rail-legend.js";
import { deselect } from "./selection.js";
import { map, railOn, setCurrentTab } from "./state.js";
import { isMobile, setView } from "./view.js";
import { RAIL } from "../data/rail.js";
import { syncNav } from "./nav.js";

/* ---------------- which leg the map is on ---------------- */
/* The three tabs this file used to build are one trigger and one menu now — see
   client/nav.js. Everything below is unchanged: switching leg is still the same dozen
   things, and nav.js calls straight into it. The import goes one way (this file reads
   syncNav, nav.js never reads this one), which is what keeps the two off a cycle. */
export function setTab(id){
  setCurrentTab(id);
  syncNav();
  deselect();
  renderLegend();
  renderList();
  drawRail();
  renderRailLegend();
  // switching city never discards a day; an empty plan just follows you
  if (!plan.ids.length) plan.city = id;
  renderPlan();
  syncMarkers();
  // the tile pack is per leg, so the button is answering a different question now
  syncOfflineButton();
  const hasRail = (RAIL[id] || []).length > 0;
  const rt = document.getElementById("railToggle");
  const rl = document.getElementById("raillegend");
  if (rt) rt.style.display = hasRail ? "" : "none";
  if (rl) rl.style.display = (hasRail && railOn) ? "" : "none";
  if (map) {
    syncMarkers();
    fitCity();
    // the box can still be the old size here (list view, a tab tapped mid-resize) — refit once it settles
    setTimeout(() => { if (map) { map.invalidateSize(); fitCity(); } }, 60);
  }
  if (isMobile()) {
    setView("map");
  }
}

