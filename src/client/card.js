import { planHas, planOffFor, planStops, planToggle, planningMode } from "./plan-state.js";
import { deselect } from "./selection.js";
import { CATS } from "../data/places.js";
import { journeyFor } from "../lib/journey.js";
import { fmtM, planLegs } from "../lib/plan-core.js";

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
    ${planningMode() ? hopStripHtml(p) : routeStripHtml(p)}`;
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


/* Mid-plan the useful question is not "how do I get here from the hotel" — it is "what
   is between the stop before this one and this one". That is the same hop the plan pane
   already words, so it is worded the same way here: the distance, the line only where
   the geometry proves one without a guessed transfer, and a Naver link for the rest.
   No time is invented, because ROUTES is rooted at the hotel and cannot answer it.
   For a spot that is not in the day yet, the hop is measured from the last stop there
   is — which is exactly what you are weighing up before you tap add. */
export function hopStripHtml(p){
  const stops = planStops();
  const i = stops.findIndex(s => s.id === p.id);
  if (i === 0) return `<div class="pop-route"><span class="pr-k">Stop 1</span>
    <div class="pr-walk">Where the day starts.</div></div>`;
  const from = i > 0 ? stops[i - 1].place
                     : stops.filter(s => s.place).map(s => s.place).pop();
  if (!from || from.id === p.id) return "";
  const leg = planLegs([{ id:from.id, place:from }, { id:p.id, place:p }], planOffFor)[0];
  if (!leg) return "";
  const how = leg.walkable ? `about ${leg.walkMin} min on foot`
            : (leg.mode === "car" ? "worth driving" : "worth riding");
  const line = leg.line
    ? `<div class="pr-step"><span class="pr-line" style="background:${leg.line.color}">${leg.line.label}</span>
       <span class="pr-txt">${leg.line.from} <span class="pr-arr">→</span> ${leg.line.to}</span></div>`
    : "";
  const kicker = i > 0 ? `From stop ${i}, ${from.name}` : `From your last stop, ${from.name}`;
  return `<div class="pop-route"><span class="pr-k">${kicker}</span>${line}
    <div class="pr-walk">${fmtM(leg.metres)} · ${how} ·
      <a class="phop-a" href="${leg.naver}" target="_blank" rel="noopener noreferrer">Naver ↗</a></div></div>`;
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

