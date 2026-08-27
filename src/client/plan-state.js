import { drawRail, syncMarkers } from "./map.js";
import { renderPlan } from "./plan-pane.js";
import { resyncSelection, selectedId } from "./selection.js";
import { PLACES } from "../data/places.js";
import { HOTEL_STATION } from "../data/routing.js";
import { journeyFor, offStationFor } from "../lib/journey.js";
import { PLAN_MAX_STOPS, encodePlanQuery, resolvePlan } from "../lib/plan-core.js";

/* Written from plan-boot (which decodes the link) and from the drag, so these
   few need a setter rather than a bare live binding. */
export const setPlan = (v) => { plan = v; };
export const setPlanOver = (v) => { planOver = v; };
export const setPlaceQuery = (v) => { placeQuery = v; };
export const setPlanDragging = (v) => { planDragging = v; };
export const setPlanDragFrom = (v) => { planDragFrom = v; };
export const setPlanRenderQueued = (v) => { planRenderQueued = v; };

/* ---------------- day plan: state, pane and overlay ---------------- */
/* Everything below here is allowed to touch the page. Everything above the
   plan-core:end sentinel is not — that is what keeps tools/test-plan.mjs honest. */

export let plan = { city:"seoul", ids:[], day:"", title:"", extra:[] };
export let planOver = 0;          // stops a too-long link had to drop, so the pane can say so
export let sideTab = "places";
export let placeQuery = "";
export let planDragging = false, planRenderQueued = false, planDragFrom = -1;
export let urlWritable = true, urlTimer = null, planFull = false;

/* place notes are ours, but a title arrives off the query string, so it is not */
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g,
  c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

/* body.planning is set in syncMarkers, from the plan and the leg you are looking at.
   It is the page's one answer to "are we planning right now", so everything that
   behaves differently mid-plan asks it rather than keeping its own flag. */
export const planningMode = () => document.body.classList.contains("planning");

export const planHas = (id) => plan.ids.indexOf(id) >= 0;
export const planStops = () => resolvePlan(plan.ids, PLACES);

/* offStationFor() gives a hotel nothing, because a hotel is where a ride starts rather
   than somewhere you ride to. A hop out of one still leaves from a platform, though. */
export function planOffFor(p){
  return p.cat === "hotel" ? (p.city === "seoul" ? HOTEL_STATION : null) : offStationFor(p);
}

/** The ride from the hotel as plain text, for the brief. routeStripHtml() stays the
    one that speaks HTML; this one exists so neither has to serve two masters. */
export function planHotelLine(p){
  const j = journeyFor(p);
  if (!j) return null;
  const hops = j.rail.map(l => `${l.label} to ${l.to}`).join(", then ");
  const walk = j.walk < 950 ? `${Math.round(j.walk / 10) * 10} m` : `${(j.walk / 1000).toFixed(1)} km`;
  return `${hops}${hops ? ", then " : ""}${walk} on foot, about ${j.minutes} min door to door`;
}

/* Debounced, because Safari throttles replaceState at 100 calls in 30 seconds and
   typing a title would spend that in a sentence. Wrapped, because file:// refuses it
   outright — losing the bookmarkable URL is a shame, not a reason to stop working. */
export function syncPlanUrl(){
  if (!urlWritable) return;
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => {
    try {
      history.replaceState(null, "", encodePlanQuery(plan) || location.pathname);
    } catch (e){
      urlWritable = false;
      renderPlan();
    }
  }, 400);
}

export function afterPlanChange(){
  syncPlanUrl();
  renderPlan();
  syncMarkers();
  drawRail();
  // an open card says something different in planning mode, and syncMarkers is what
  // decides whether we are in it — so the card is caught up after that, not before
  resyncSelection();
  refreshPlanControls();
  const c = document.getElementById("planCount");
  if (c) c.textContent = plan.ids.length || "";
}

export function planAdd(id, at){
  if (planHas(id)) return;
  if (plan.ids.length >= PLAN_MAX_STOPS){ planFull = true; renderPlan(); return; }
  planFull = false;
  const i = (at == null || at < 0 || at > plan.ids.length) ? plan.ids.length : at;
  plan.ids.splice(i, 0, id);
  afterPlanChange();
}
export function planRemove(id){
  const i = plan.ids.indexOf(id);
  if (i < 0) return;
  plan.ids.splice(i, 1);
  planOver = 0; planFull = false;
  afterPlanChange();
}
export function planToggle(id){ planHas(id) ? planRemove(id) : planAdd(id); }
export function planMove(from, to){
  if (from === to || from < 0 || to < 0 || from >= plan.ids.length || to >= plan.ids.length) return;
  plan.ids.splice(to, 0, plan.ids.splice(from, 1)[0]);
  afterPlanChange();
}
export function planReorder(order){
  plan.ids = order.map(i => plan.ids[i]);
  afterPlanChange();
}
export function planClear(){
  plan.ids = [];
  afterPlanChange();
}

/** The add buttons are updated in place rather than by re-rendering the list: a
    re-render would throw away the list's scroll position and the search box's focus. */
export function refreshPlanControls(){
  document.querySelectorAll("[data-plan-add]").forEach(b => {
    const on = planHas(b.dataset.planAdd);
    b.classList.toggle("on", on);
    b.textContent = on ? "✓" : "+";
    b.title = on ? "Remove from the day" : "Add to the day";
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const cp = document.getElementById("cardPlan");
  if (cp && selectedId){
    const on = planHas(selectedId);
    cp.classList.toggle("done", on);
    cp.textContent = on ? "✓ In the day" : "+ Add to the day";
  }
}

export function setSideTab(t){
  sideTab = t;
  document.getElementById("side").dataset.sidetab = t;
  [["tabPlaces","places"],["tabPlan","plan"]].forEach(([id, v]) => {
    const b = document.getElementById(id);
    if (b){ b.classList.toggle("on", t === v); b.setAttribute("aria-pressed", t === v ? "true" : "false"); }
  });
  if (t === "plan") renderPlan();
}

