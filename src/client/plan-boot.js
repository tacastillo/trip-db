import { renderList } from "./list.js";
import { renderPlan } from "./plan-pane.js";
import { placeQuery, plan, savePlan, setPlaceQuery, setPlan, setPlanOver, setSideTab, syncPlanUrl } from "./plan-state.js";
import { setCurrentTab } from "./state.js";
import { saved } from "./store.js";
import { LEGS, TRIP } from "../data/places.js";
import { PLAN_MAX_STOPS, PLAN_PARAMS, decodePlanQuery, inTrip, isoDay, legForDate } from "../lib/plan-core.js";

/* ---------------- boot ---------------- */

/* What a link says beats what this browser remembers, always: a link is someone
   handing you their day, and a day picked up off one is never seeded, reordered or
   quietly replaced by yours. A URL with no stops in it is not that — it is just the
   page — so the day you were building last time comes back instead of being thrown
   away. Anything else the link carries (a city, a date, a stranger's query params)
   still wins over the store, because it was stated. */
export function restored(search){
  const q = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const got = decodePlanQuery(search, LEGS);
  const linked = !!(q.get(PLAN_PARAMS.stops) || "").trim();
  const mine = saved.plan && Array.isArray(saved.plan.ids) ? saved.plan : null;
  const plan = linked || !mine
    ? { city: got.city, ids: got.ids, day: got.day, title: got.title, extra: got.extra }
    : { city: q.get(PLAN_PARAMS.city) ? got.city : (mine.city || got.city),
        ids: mine.ids.slice(0, PLAN_MAX_STOPS),
        day: got.day || mine.day || "",
        title: got.title || mine.title || "",
        extra: got.extra };
  /* The day you are on is the day you are planning, nine mornings out of fifteen. Only
     ever filled in when nothing else stated one — a restored day keeps its own date,
     and a date outside the trip is nobody's business of ours. */
  if (!plan.day && !linked){
    const today = isoDay();
    if (inTrip(today, TRIP)){
      plan.day = today;
      const leg = legForDate(today);
      if (leg && !plan.ids.length) plan.city = leg;
    }
  }
  return { plan, over: got.over, linked, restored: !linked && !!mine && mine.ids.length > 0 };
}

export function bootPlan(){
  const boot = restored(location.search);
  setPlan(boot.plan);
  setPlanOver(boot.over);
  setCurrentTab(plan.city);
  // a restored day belongs in the address bar too, or "Copy link" would hand over a
  // link to an empty page
  if (boot.restored){ savePlan(); syncPlanUrl(); }
  const s = document.getElementById("search");
  if (s){
    s.oninput = () => {
      setPlaceQuery(s.value);
      document.getElementById("searchClear").classList.toggle("on", !!placeQuery.trim());
      renderList();
    };
    s.onkeydown = e => { if (e.key === "Escape" && s.value){ e.stopPropagation(); s.value = ""; s.oninput(); } };
  }
  const sc = document.getElementById("searchClear");
  if (sc) sc.onclick = () => { s.value = ""; s.oninput(); s.focus(); };
  document.getElementById("tabPlaces").onclick = () => setSideTab("places");
  document.getElementById("tabPlan").onclick = () => setSideTab("plan");
  const c = document.getElementById("planCount");
  if (c) c.textContent = plan.ids.length || "";
  if (plan.ids.length) setSideTab("plan");
  else if (saved.sideTab === "plan") setSideTab("plan");
  renderPlan();
}

