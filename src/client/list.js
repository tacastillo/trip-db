import { placeQuery, planHas, planToggle } from "./plan-state.js";
import { focus, selectedId } from "./selection.js";
import { active, currentTab } from "./state.js";
import { CATS, CLUSTERS, PLACES } from "../data/places.js";
import { journeyFor } from "../lib/journey.js";
import { matchesQuery } from "../lib/plan-core.js";

/* ---------------- sidebar list ---------------- */
export const listEl = document.getElementById("list");
export function renderList(){
  listEl.innerHTML = "";
  let hoods = 0, shown = 0;
  (CLUSTERS[currentTab] || []).forEach(cl => {
    const items = PLACES.filter(p => p.city === currentTab && p.cluster === cl && active[p.cat]
                                     && matchesQuery(p, placeQuery));
    if (!items.length) return;
    hoods++; shown += items.length;
    const head = document.createElement("div");
    head.className = "cluster";
    head.innerHTML = `<div class="cluster-h">${cl}</div>`;
    listEl.appendChild(head);
    items.forEach(p => {
      const c = CATS[p.cat];
      const b = document.createElement("button");
      b.className = "item" + (selectedId === p.id ? " sel" : "");
      b.dataset.id = p.id;
      b.innerHTML = `<span class="pindot" style="background:${c.color}">${c.emoji}</span>
        <span class="it-body">
          <span class="it-name">${p.name}${p.added ? '<span class="tag">new</span>' : ""}</span>
          <span class="it-note">${p.note}</span>
          ${p.meta ? `<span class="it-meta">${p.meta}</span>` : ""}
        </span>`;
      b.onclick = () => focus(p.id);
      // .item is itself a button, so the add control has to be its sibling
      const add = document.createElement("button");
      add.className = "planbtn" + (planHas(p.id) ? " on" : "");
      add.dataset.planAdd = p.id;
      add.textContent = planHas(p.id) ? "✓" : "+";
      add.title = planHas(p.id) ? "Remove from the day" : "Add to the day";
      add.setAttribute("aria-pressed", planHas(p.id) ? "true" : "false");
      add.onclick = () => planToggle(p.id);
      const row = document.createElement("div");
      row.className = "itemrow";
      row.appendChild(b); row.appendChild(add);
      listEl.appendChild(row);
    });
  });
  if (!shown) {
    const e = document.createElement("div");
    e.className = "pempty";
    e.textContent = placeQuery.trim() ? `Nothing matches “${placeQuery.trim()}”.`
                                      : "Every category is switched off.";
    listEl.appendChild(e);
  }
  document.getElementById("shownCount").textContent = shown;
  const vsc = document.getElementById("vsCount"); if (vsc) vsc.textContent = shown;
  document.getElementById("hoodCount").textContent = hoods;
  const sub = document.getElementById("sumSub");
  // rail geometry isn't the test — Busan draws lines but has no station table yet
  if (sub) sub.textContent = PLACES.some(p => p.city === currentTab && journeyFor(p))
    ? "tap a spot for the ride there from the hotel"
    : "tap a spot to see it on the map";
}

export function highlightList(){
  listEl.querySelectorAll(".item").forEach(el =>
    el.classList.toggle("sel", el.dataset.id === selectedId));
}

