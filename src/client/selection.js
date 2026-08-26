import { hideCard, showCard } from "./card.js";
import { highlightList } from "./list.js";
import { markPin, markers } from "./map.js";
import { planningMode } from "./plan-state.js";
import { clearRoute, routeDraw, showRoute } from "./route.js";
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
  // Mid-plan the ride from the hotel is an answer to a question nobody asked: you are
  // ordering a day, not arriving from the hotel to each stop in turn, and a red streak
  // across the city buries the numbered pins the plan is being read off. The card
  // carries the hop from the stop before instead. Out of planning mode nothing changes.
  // The map stays put either way: a ride that draws while the view is still moving is
  // two animations fighting, and the opening view already frames the city.
  if (planningMode()) clearRoute(); else showRoute(p);
}

/** The plan changing can flip the page in or out of planning mode with a card open,
    which changes both what that card says and whether a ride belongs on the map. */
export function resyncSelection(){
  const p = selectedId && PLACES.find(x => x.id === selectedId);
  if (!p) return;
  showCard(p);
  if (planningMode()) clearRoute();
  else if (!routeDraw) showRoute(p);
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


