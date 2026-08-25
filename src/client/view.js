import { applyRailLegendState } from "./rail-legend.js";
import { map } from "./state.js";

/* ---------------- mobile map/list view ---------------- */
export const mobileMQ = window.matchMedia("(max-width:780px), (max-height:500px) and (max-width:950px)");
export let view = "map";
export function isMobile(){ return mobileMQ.matches; }
export function setView(v){
  view = v;
  document.body.classList.toggle("view-map", v === "map");
  document.body.classList.toggle("view-list", v === "list");
  const mb = document.getElementById("vsMap"), lb = document.getElementById("vsList");
  if (mb){ mb.classList.toggle("on", v === "map"); mb.setAttribute("aria-pressed", v === "map"); }
  if (lb){ lb.classList.toggle("on", v === "list"); lb.setAttribute("aria-pressed", v === "list"); }
  if (v === "map" && map) setTimeout(() => map.invalidateSize(), 50);
}
setView("map");
document.getElementById("vsMap").onclick = () => setView("map");
document.getElementById("vsList").onclick = () => setView("list");
// the map is hidden while the list is up, so it needs re-measuring whenever the box changes
mobileMQ.addEventListener("change", () => {
  if (map) setTimeout(() => map.invalidateSize(), 60);
  if (typeof applyRailLegendState === "function") applyRailLegendState();
});
window.addEventListener("orientationchange", () => { if (map) setTimeout(() => map.invalidateSize(), 250); });
export let resizeT;
window.addEventListener("resize", () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { if (map) map.invalidateSize(); }, 180);
});
