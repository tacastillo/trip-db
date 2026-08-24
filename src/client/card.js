import { planHas, planToggle } from "./plan-state.js";
import { deselect } from "./selection.js";
import { CATS } from "../data/places.js";
import { journeyFor } from "../lib/journey.js";

/* ---------------- map ---------------- */
export function cardHtml(p){
  const c = CATS[p.cat];
  return `<button class="card-x" id="cardX" title="Close" aria-label="Close">✕</button>
    <div class="pop-cat" style="color:${c.color}">${c.emoji} ${c.label}</div>
    <div class="pop-name">${p.name}</div>
    <div class="pop-hood">${p.cluster}</div>
    <div class="pop-note">${p.note}</div>
    ${p.meta ? `<div class="pop-meta">${p.meta}</div>` : ""}
    <button class="pact card-plan" id="cardPlan">${planHas(p.id) ? "✓ In the day" : "+ Add to the day"}</button>
    ${routeStripHtml(p)}`;
}
export const cardEl = document.getElementById("card");
export function showCard(p){
  cardEl.innerHTML = cardHtml(p);
  cardEl.classList.add("show");
  document.body.classList.add("carded");
  cardEl.scrollTop = 0;
  document.getElementById("cardX").onclick = deselect;
  const cp = document.getElementById("cardPlan");
  if (cp){ cp.classList.toggle("done", planHas(p.id)); cp.onclick = () => planToggle(p.id); }
}
export function hideCard(){
  cardEl.classList.remove("show");
  cardEl.innerHTML = "";
  document.body.classList.remove("carded");
}


export function routeStripHtml(p){
  const j = journeyFor(p);
  if (!j) return "";
  const rows = j.rail.map((leg, i) => {
    const last = i === j.rail.length - 1;
    return `<div class="pr-step"><span class="pr-line" style="background:${leg.color}">${leg.label}</span>
      <span class="pr-txt"><span class="pr-arr">→</span>
      <span class="${last ? "pr-off" : "pr-to"}">${leg.to}</span>
      <span class="pr-tag${last ? " hop" : ""}">${last ? "get off" : "transfer"}</span></span></div>`;
  });
  const walk = j.walk < 950 ? `${Math.round(j.walk / 10) * 10} m walk` : `${(j.walk / 1000).toFixed(1)} km walk`;
  return `<div class="pop-route"><span class="pr-k">From the hotel</span>${rows.join("")}
    <div class="pr-walk">🚶 ${walk} to the door · ≈ ${j.minutes} min door to door</div></div>`;
}

