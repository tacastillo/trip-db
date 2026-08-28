import { save, saved } from "./store.js";

/* Been there. Half of what a field map is for on the eleventh day is knowing what you
   have already crossed off, and that is knowledge only this browser has — it is not in
   the link, because it is not part of the day you are handing someone. Kept as a Set
   here and as a plain array of ids in the store. */

export const visited = new Set(Array.isArray(saved.visited) ? saved.visited : []);
export let hideVisited = !!saved.hideVisited;

export const isVisited = (id) => visited.has(id);
export function setVisited(id, on){
  on ? visited.add(id) : visited.delete(id);
  save({ visited: [...visited] });
}
export function toggleVisited(id){ setVisited(id, !isVisited(id)); }
export function setHideVisited(on){
  hideVisited = !!on;
  save({ hideVisited });
}
/** The filter only ever hides a spot you have been to. A planned stop is never hidden
    — its number in the day would then point at a pin that is not on the map. */
export const visitedHidden = (id) => hideVisited && visited.has(id);
