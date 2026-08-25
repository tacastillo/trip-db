import { renderLegend } from "./legend.js";
import { renderList } from "./list.js";
import { drawRail, fitCity, syncMarkers } from "./map.js";
import { renderPlan } from "./plan-pane.js";
import { plan } from "./plan-state.js";
import { renderRailLegend } from "./rail-legend.js";
import { deselect } from "./selection.js";
import { map, railOn, setCurrentTab } from "./state.js";
import { isMobile, setView } from "./view.js";
import { LEGS } from "../data/places.js";
import { RAIL } from "../data/rail.js";

/* ---------------- build tabs ---------------- */
export const tabsEl = document.getElementById("tabs");
LEGS.forEach(leg => {
  const b = document.createElement("button");
  b.className = "tab" + (leg.id === "seoul" ? " active" : "");
  b.dataset.tab = leg.id;
  b.innerHTML = `<span class="tab-l">${leg.label}</span>
                 <span class="tab-d">${leg.dates}</span>`;
  b.onclick = () => setTab(leg.id);
  tabsEl.appendChild(b);
});

/* ---------------- tabs ---------------- */
export function setTab(id){
  setCurrentTab(id);
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === id));
  deselect();
  renderLegend();
  renderList();
  drawRail();
  renderRailLegend();
  // switching city never discards a day; an empty plan just follows you
  if (!plan.ids.length) plan.city = id;
  renderPlan();
  syncMarkers();
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

