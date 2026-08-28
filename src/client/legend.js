import { renderList } from "./list.js";
import { syncMarkers } from "./map.js";
import { locating, nearFirst, setNearFirst } from "./geo-me.js";
import { save } from "./store.js";
import { active, currentTab } from "./state.js";
import { hideVisited, setHideVisited, visited } from "./visited.js";
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
    b.onclick = () => { active[k] = !active[k]; saveCats(); syncMarkers(); renderLegend(); renderList(); };
    legendEl.appendChild(b);
  });
  if (CAT_ORDER.some(k => !active[k])) {
    const b = document.createElement("button");
    b.className = "chip"; b.textContent = "Show all";
    b.onclick = () => { CAT_ORDER.forEach(k => active[k] = true); saveCats(); syncMarkers(); renderLegend(); renderList(); };
    legendEl.appendChild(b);
  }
  /* Only while the browser is actually handing over a position: sorting a list by
     distance from nowhere is not a thing to offer. */
  if (locating){
    const b = document.createElement("button");
    b.className = "chip near" + (nearFirst ? " on" : "");
    b.innerHTML = "📍 Nearest first";
    b.title = "Drop the neighbourhoods and list everything by how far away it is";
    b.onclick = () => { setNearFirst(!nearFirst); renderLegend(); };
    legendEl.appendChild(b);
  }
  /* Only once there is something to hide. A chip that says "0 been" on the first
     morning of the trip is a control asking to be explained rather than used. */
  const been = PLACES.filter(p => p.city === currentTab && visited.has(p.id)).length;
  if (been){
    const b = document.createElement("button");
    b.className = "chip been" + (hideVisited ? " on" : "");
    b.innerHTML = `☑ Been<span class="ct">${been}</span>`;
    b.title = hideVisited ? "Show the spots you have been to again" : "Hide the spots you have been to";
    b.onclick = () => { setHideVisited(!hideVisited); syncMarkers(); renderLegend(); renderList(); };
    legendEl.appendChild(b);
  }
}

export function saveCats(){
  const cats = {};
  CAT_ORDER.forEach(k => cats[k] = !!active[k]);
  save({ cats });
}
