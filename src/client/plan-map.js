import { plan, planStops } from "./plan-state.js";
import { currentTab, map } from "./state.js";
import { setTab } from "./tabs.js";
import { isMobile } from "./view.js";

/* ---------------- the plan on the map ---------------- */

/* Nothing is drawn between the stops on the map, and nothing should be. A line from
   one stop to the next is a straight streak across a city that says nothing you can
   act on: ROUTES is rooted at the hotel, so there is no station-to-station geometry to
   trace, and a straight line is not a route, a walk, or a ride. The pins carry their
   own numbers once the rest of the map steps back, and the hop rows in the pane carry
   the distance, the line where the geometry proves one, and the Naver link — which is
   the part you can actually use. */
export function fitPlan(){
  if (!map) return;
  const pts = planStops().filter(s => s.place).map(s => [s.place.lat, s.place.lng]);
  if (!pts.length) return;
  if (currentTab !== plan.city) setTab(plan.city);
  const pad = isMobile() ? 40 : 70;
  map.fitBounds(L.latLngBounds(pts), { padding: [pad, pad], maxZoom: 15, animate: false });
}

