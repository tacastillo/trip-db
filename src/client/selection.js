import { hideCard, showCard } from "./card.js";
import { highlightList } from "./list.js";
import { markPin, markers } from "./map.js";
import { clearRoute, showRoute } from "./route.js";
import { map } from "./state.js";
import { isMobile, setView, view } from "./view.js";
import { PLACES } from "../data/places.js";

export let selectedId = null;

export function select(id){
  const p = PLACES.find(x => x.id === id); if (!p) return;
  if (selectedId && selectedId !== id) markPin(selectedId, false);
  selectedId = id;
  highlightList();
  showCard(p);
  if (!map || !markers[id]) return;
  markPin(id, true);
  // the map stays put: a ride that draws while the view is still moving is
  // two animations fighting, and the opening view already frames the city
  showRoute(p);
}
export function deselect(){
  if (selectedId) markPin(selectedId, false);
  selectedId = null;
  hideCard();
  clearRoute();
  highlightList();
}
export function focus(id){
  if (!PLACES.some(x => x.id === id)) return;
  if (isMobile() && view !== "map") {
    // swap to the map first, let it re-measure, then move — a hidden map flies to the wrong spot
    setView("map");
    setTimeout(() => { map && map.invalidateSize(); select(id); }, 90);
  } else select(id);
}


