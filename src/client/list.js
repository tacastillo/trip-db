import { distanceFrom, here, nearFirst } from "./geo-me.js";
import { placeQuery, planHas, planToggle } from "./plan-state.js";
import { focus, selectedId } from "./selection.js";
import { active, currentTab } from "./state.js";
import { isVisited, toggleVisited, visitedHidden } from "./visited.js";
import { syncMarkers } from "./map.js";
import { renderLegend } from "./legend.js";
import { CATS, CLUSTERS, PLACES } from "../data/places.js";
import { journeyFor } from "../lib/journey.js";
import { fmtM, matchesQuery } from "../lib/plan-core.js";
import { closedDaysFor, koreaClock } from "../lib/plan-core.js";
import { icon } from "../lib/icons.js";

/* ---------------- sidebar list ---------------- */
export const listEl = document.getElementById("list");

/** Everything the chips, the search box and the been-there filter leave standing. A
    planned stop is never filtered away: its number on the map has to point at a pin. */
export function listed(p){
  return p.city === currentTab && matchesQuery(p, placeQuery)
    && (active[p.cat] || planHas(p.id))
    && !(visitedHidden(p.id) && !planHas(p.id));
}

/* The one thing the list says about hours. A live open/shut chip on 137 rows would be
   137 things to read past; the day you cannot go at all is the one worth a word. */
function shutToday(p){
  return closedDaysFor(p).indexOf(koreaClock().dow) >= 0;
}

/* The handful of places with no database row carry their closing day as prose in meta, and
   the flag above is built from that same prose — so showing both would print "Closed today"
   next to "Closed Mon". The flag wins there: it is the one that answers today. Only when the
   meta is *nothing but* that clause, though — "Closed Tue · Catchtable" still has to say
   Catchtable, which is the half you would act on. */
const META_ONLY_CLOSED = /^closed\s+(?:mon|tue|wed|thu|fri|sat|sun)(?:\s*[–—\-\/,&]\s*(?:mon|tue|wed|thu|fri|sat|sun))*$/i;
function metaSaysClosed(p){
  return META_ONLY_CLOSED.test(String(p.meta || "").trim());
}

export function itemRow(p){
  const c = CATS[p.cat];
  const been = isVisited(p.id);
  const shut = shutToday(p);
  const b = document.createElement("button");
  b.className = "item" + (selectedId === p.id ? " sel" : "") + (been ? " been" : "");
  b.dataset.id = p.id;
  b.innerHTML = `<span class="pindot" style="background:${c.color}">${icon(c.icon)}</span>
    <span class="it-body">
      <span class="it-name">${p.name}${p.added ? '<span class="tag">new</span>' : ""}</span>
      <span class="it-note">${p.note}</span>
      ${shut ? '<span class="it-shut">Closed today</span>' : ""}
      ${p.meta && !(shut && metaSaysClosed(p)) ? `<span class="it-meta">${p.meta}</span>` : ""}
      <span class="it-dist" data-dist="${p.id}"></span>
    </span>`;
  b.onclick = () => focus(p.id);
  // .item is itself a button, so both controls have to be its siblings
  const been_b = document.createElement("button");
  been_b.className = "beenbtn" + (been ? " on" : "");
  been_b.dataset.been = p.id;
  been_b.innerHTML = `<span class="tickbox${been ? " on" : ""}"></span>`;
  been_b.title = been ? "Been there — tap to un-tick" : "Mark as been to";
  been_b.setAttribute("aria-pressed", been ? "true" : "false");
  been_b.onclick = () => {
    toggleVisited(p.id);
    renderList();
    renderLegend();
    syncMarkers();
  };
  const add = document.createElement("button");
  add.className = "planbtn" + (planHas(p.id) ? " on" : "");
  add.dataset.planAdd = p.id;
  add.innerHTML = icon(planHas(p.id) ? "check" : "add");
  add.title = planHas(p.id) ? "Remove from the day" : "Add to the day";
  add.setAttribute("aria-pressed", planHas(p.id) ? "true" : "false");
  add.onclick = () => planToggle(p.id);
  const row = document.createElement("div");
  row.className = "itemrow";
  row.appendChild(b); row.appendChild(been_b); row.appendChild(add);
  return row;
}

export function head(text){
  const h = document.createElement("div");
  h.className = "cluster";
  h.innerHTML = `<div class="cluster-h">${text}</div>`;
  return h;
}

export function renderList(){
  listEl.innerHTML = "";
  let hoods = 0, shown = 0;
  /* With a position, "which neighbourhood is this in" stops being the question and
     "what is near me" starts being it — so the clusters give way to one list in order
     of how far you would have to walk. Without one the chip is inert and says so. */
  if (nearFirst && here){
    const items = PLACES.filter(listed)
      .map(p => ({ p, d: distanceFrom(p) }))
      .sort((a, b) => a.d - b.d || (a.p.id < b.p.id ? -1 : 1));
    if (items.length){
      hoods = new Set(items.map(x => x.p.cluster)).size;
      shown = items.length;
      listEl.appendChild(head("Nearest to you"));
      items.forEach(x => listEl.appendChild(itemRow(x.p)));
    }
  } else {
    (CLUSTERS[currentTab] || []).forEach(cl => {
      const items = PLACES.filter(p => p.cluster === cl && listed(p));
      if (!items.length) return;
      hoods++; shown += items.length;
      listEl.appendChild(head(cl));
      items.forEach(p => listEl.appendChild(itemRow(p)));
    });
  }
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
  fillDistances();
}

/** The distances the rows have room for, filled straight after a render. geo-me does
    the same thing on every position update without going near the DOM it built. */
export function fillDistances(){
  listEl.querySelectorAll("[data-dist]").forEach(el => {
    const p = PLACES.find(x => x.id === el.dataset.dist);
    const d = p && distanceFrom(p);
    el.textContent = d == null ? "" : `${fmtM(d)} away`;
    // the stylesheet hides these by default, so "" would hide them again
    el.style.display = d == null ? "none" : "block";
  });
}

/** Re-sorting under a thumb is disorienting enough without leaving the scroll where it
    was: the row that was under your finger is not the row that is there now. */
export function scrollListTop(){ listEl.scrollTop = 0; }

export function highlightList(){
  listEl.querySelectorAll(".item").forEach(el =>
    el.classList.toggle("sel", el.dataset.id === selectedId));
}
