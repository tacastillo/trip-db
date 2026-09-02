import { drawRail, syncMarkers } from "./map.js";
import { renderPlan } from "./plan-pane.js";
import { resyncSelection, selectedId } from "./selection.js";
import { save } from "./store.js";
import { setTab } from "./tabs.js";
import { PLACES } from "../data/places.js";
import { HOTEL_STATION } from "../data/routing.js";
import { journeyFor, offStationFor } from "../lib/journey.js";
import { PLAN_MAX_STOPS, encodePlanQuery, hotelFor, legForDate, resolvePlan } from "../lib/plan-core.js";
import { icon } from "../lib/icons.js";

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
  // nothing to ride: the whole journey is the walk, so it is not "door to door" after a ride
  if (!hops) return `${walk} on foot, about ${j.minutes} min`;
  return `${hops}, then ${walk} on foot, about ${j.minutes} min door to door`;
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

/* The link is still the only thing you can share, and it is still the truth when one
   names stops. This is the other half: a day you were part way through building when
   the phone locked is not somebody else's, and losing it to a reload was never a
   decision anyone made. Only the four fields the URL itself carries are kept. */
export function savePlan(){
  save({ plan: { city: plan.city, ids: plan.ids.slice(), day: plan.day, title: plan.title } });
}

/** The date is a label and a source of closure cautions, never a schedule — see
    plan-core's closedDays(). Picking one on an empty day also moves you to the leg you
    are actually in that day, because that is the only reason the spans exist. */
export function setPlanDay(day){
  plan.day = day || "";
  const leg = legForDate(plan.day);
  if (leg && !plan.ids.length && leg !== plan.city){
    plan.city = leg;
    setTab(leg);
  }
  syncPlanUrl();
  savePlan();
  renderPlan();
}

export function afterPlanChange(){
  syncPlanUrl();
  savePlan();
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

/* Every day of this trip starts at the hotel and ends there, and neither end is a stop.
   The way home has always been computed — homeLeg() — because ?stops= collapses a
   repeated id, so a hotel that both opened and closed a day could not survive a round
   trip through a link. The way out is computed the same way now, by startLeg(). Before
   this, adding the first spot to an empty day pushed the hotel in front of it as an
   ordinary stop, which made the two ends of one day two different kinds of thing: one
   you could drag and delete, one fixed. They are both fixed, and both always on screen.

   A link written before that change still names the hotel first, and links are never
   quietly edited — so an id at the front that is the leg's home base is absorbed into
   the start row rather than numbered. planLead() is how many ids that accounts for, and
   everything that indexes the day goes through it. */
export function planLead(){
  const h = hotelFor(plan.city, PLACES);
  return h && plan.ids[0] === h.id ? 1 : 0;
}
/** The stops the day is actually made of: what is drawn, numbered, dragged and counted. */
export function planBody(){ return planStops().slice(planLead()); }

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

/* The pane, the drag and the reorder all count in rendered rows, which is the day
   without its absorbed first id. These two are the only translation between the two
   numberings; nothing else should be doing the arithmetic. */
export function planMoveBody(from, to){
  const off = planLead();
  planMove(from + off, to + off);
}
export function planReorderBody(order){
  const off = planLead();
  const head = [];
  for (let i = 0; i < off; i++) head.push(i);
  planReorder(head.concat(order.map(i => i + off)));
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
    b.innerHTML = icon(on ? "check" : "add");
    b.title = on ? "Remove from the day" : "Add to the day";
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const cp = document.getElementById("cardPlan");
  if (cp && selectedId){
    const on = planHas(selectedId);
    cp.classList.toggle("done", on);
    cp.innerHTML = `${icon(on ? "check" : "add")} ${on ? "In the day" : "Add to the day"}`;
  }
}

export function setSideTab(t){
  sideTab = t;
  save({ sideTab: t });
  document.getElementById("side").dataset.sidetab = t;
  [["tabPlaces","places"],["tabPlan","plan"]].forEach(([id, v]) => {
    const b = document.getElementById(id);
    if (b){ b.classList.toggle("on", t === v); b.setAttribute("aria-pressed", t === v ? "true" : "false"); }
  });
  if (t === "plan") renderPlan();
}

