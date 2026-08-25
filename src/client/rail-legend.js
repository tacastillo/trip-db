import { currentTab } from "./state.js";
import { isMobile } from "./view.js";
import { RAIL } from "../data/rail.js";

/* Toggled from the boot sequence's click handler, which is the only writer. */
export const setRailLegendOpen = (v) => { railLegendOpen = v; };

export let railLegendOpen = false;
export function applyRailLegendState(){
  const el = document.getElementById("raillegend"); if (!el) return;
  el.classList.toggle("collapsed", isMobile() && !railLegendOpen);
}
export function renderRailLegend(){
  const el = document.getElementById("raillegend"); if (!el) return;
  el.innerHTML = '<div class="rl-h">Subway</div>' + (RAIL[currentTab]||[]).map(ln =>
    `<span class="rl-item"><span class="rl-bar" style="background:${ln.color}"></span>${ln.label}</span>`).join("");
  applyRailLegendState();
}
