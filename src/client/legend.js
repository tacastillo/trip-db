import { renderList } from "./list.js";
import { syncMarkers } from "./map.js";
import { active, currentTab } from "./state.js";
import { CATS, CAT_ORDER, PLACES } from "../data/places.js";

/* ---------------- legend ---------------- */
export let counts = {};
export function computeCounts(){ counts = {}; CAT_ORDER.forEach(k => counts[k] = 0); PLACES.forEach(p => { if (p.city === currentTab) counts[p.cat]++; }); }
computeCounts();
export const legendEl = document.getElementById("legend");
export function renderLegend(){
  computeCounts();
  legendEl.innerHTML = "";
  CAT_ORDER.forEach(k => {
    const c = CATS[k];
    const b = document.createElement("button");
    b.className = "chip" + (active[k] ? "" : " off");
    b.innerHTML = `<span class="dot" style="background:${c.color}"></span>${c.label}<span class="ct">${counts[k]}</span>`;
    b.onclick = () => { active[k] = !active[k]; syncMarkers(); renderLegend(); renderList(); };
    legendEl.appendChild(b);
  });
  if (CAT_ORDER.some(k => !active[k])) {
    const b = document.createElement("button");
    b.className = "chip"; b.textContent = "Show all";
    b.onclick = () => { CAT_ORDER.forEach(k => active[k] = true); syncMarkers(); renderLegend(); renderList(); };
    legendEl.appendChild(b);
  }
}
