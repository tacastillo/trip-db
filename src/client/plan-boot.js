import { renderList } from "./list.js";
import { renderPlan } from "./plan-pane.js";
import { placeQuery, plan, setPlaceQuery, setPlan, setPlanOver, setSideTab } from "./plan-state.js";
import { setCurrentTab } from "./state.js";
import { LEGS } from "../data/places.js";
import { decodePlanQuery } from "../lib/plan-core.js";

/* ---------------- boot ---------------- */

export function bootPlan(){
  const got = decodePlanQuery(location.search, LEGS);
  setPlan({ city: got.city, ids: got.ids, day: got.day, title: got.title, extra: got.extra });
  setPlanOver(got.over);
  setCurrentTab(plan.city);
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
  renderPlan();
}

