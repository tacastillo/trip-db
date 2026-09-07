import { renderList } from "./list.js";
import { renderPlan } from "./plan-pane.js";
import { placeQuery, plan, savePlan, setPlaceQuery, setPlan, setPlanOver, setSideTab, syncPlanUrl } from "./plan-state.js";
import { setCurrentTab, setStatedCity } from "./state.js";
import { saved } from "./store.js";
import { restored } from "../lib/plan-core.js";

/* ---------------- boot ---------------- */

export function bootPlan(){
  const boot = restored(location.search, saved.plan);
  setPlan(boot.plan);
  setPlanOver(boot.over);
  setStatedCity(boot.stated);
  setCurrentTab(boot.tab);
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
  /* ...but not when you asked for a different city than the day belongs to: the pane
     would open on somebody else's leg. The day is still there, one tap away. */
  const elsewhere = boot.stated && boot.stated !== plan.city;
  if (plan.ids.length && !elsewhere) setSideTab("plan");
  else if (saved.sideTab === "plan" && !elsewhere) setSideTab("plan");
  renderPlan();
}

