import { distanceFrom, here } from "./geo-me.js";
import { renderLegend } from "./legend.js";
import { renderList } from "./list.js";
import { syncMarkers } from "./map.js";
import { planBody, planHas, planOffFor, planToggle, planningMode } from "./plan-state.js";
import { deselect } from "./selection.js";
import { isVisited, toggleVisited } from "./visited.js";
import { CATS } from "../data/places.js";
import { journeyFor } from "../lib/journey.js";
import { dirBtnsHtml, hopHow } from "./plan-pane.js";
import { fmtM, hotelFor, kakaoDirUrl, koreaClock, naverDirUrl, planLegs } from "../lib/plan-core.js";
import { DOW_SHORT } from "../lib/plan-core.js";
import { fmtMin, openState } from "../lib/hours.js";
import { icon } from "../lib/icons.js";

/* Open or shut, right now, in Korea. Computed at render time rather than on a timer:
   the card is rebuilt on every select, which is the only moment anyone reads this.
   An hours string the parser does not recognise is printed verbatim instead — a line a
   person can read beats a status nobody can trust. */
export function hoursChipHtml(p){
  if (!p.hours) return "";
  const st = openState(p, koreaClock());
  if (st.state === "unknown") return `<span class="pop-hours">${p.hours}</span>`;
  if (st.state === "open")
    return `<span class="pop-hours on">Open · til ${fmtMin(st.until)}</span>`;
  if (st.opensAt == null) return `<span class="pop-hours">Closed</span>`;
  const when = st.opensAhead === 0 ? "" : st.opensAhead === 1 ? " tomorrow" : ` ${DOW_SHORT[st.opensDow]}`;
  return `<span class="pop-hours">Closed · opens ${fmtMin(st.opensAt)}${when}</span>`;
}

/* ---------------- map ---------------- */
export function cardHtml(p){
  const c = CATS[p.cat];
  return `<button class="card-x" id="cardX" title="Close" aria-label="Close">${icon("close")}</button>
    <div class="pop-top">
      <div class="pop-cat" style="color:${c.color}">${icon(c.icon)} ${c.label}</div>
      ${hoursChipHtml(p)}
    </div>
    <div class="pop-name">${p.name}${p.ko ? ` <span class="pop-ko" lang="ko">${p.ko}</span>` : ""}</div>
    <div class="pop-sub">${[p.cluster, here ? `${icon("pin")} ${fmtM(distanceFrom(p))}` : ""].filter(Boolean).join(" · ")}</div>
    <div class="pop-note">${p.note}</div>
    ${p.signature || p.meta ? `<div class="pop-extra">${
      [p.signature ? `<span class="pop-sig">${p.signature}</span>` : "",
       p.meta ? `<span class="pop-meta">${p.meta}</span>` : ""].filter(Boolean).join(" ")}</div>` : ""}
    <div class="card-acts">
      <button class="pact card-plan" id="cardPlan">${icon(planHas(p.id) ? "check" : "add")} ${planHas(p.id) ? "In the day" : "Add to the day"}</button>
      <button class="pact card-been${isVisited(p.id) ? " done" : ""}" id="cardBeen"><span class="tickbox${isVisited(p.id) ? " on" : ""}"></span> Been</button>
    </div>
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
  const cb = document.getElementById("cardBeen");
  if (cb) cb.onclick = () => {
    toggleVisited(p.id);
    showCard(p);            // the card is the thing that just changed, so redraw it
    renderList();
    renderLegend();
    syncMarkers();
  };
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
  const stops = planBody();
  const i = stops.findIndex(s => s.id === p.id);
  const home = hotelFor(p.city);
  const planned = stops.filter(s => s.place).map(s => s.place);
  // stop one is walked to from the hotel, because that is where the day starts — the
  // same hop the pane draws above stop one, worded the same way
  const fromHome = i === 0 || (i < 0 && !planned.length);
  const from = fromHome ? home : (i > 0 ? stops[i - 1].place : planned[planned.length - 1]);
  if (!from || from.id === p.id) return "";
  const leg = planLegs([{ id:from.id, place:from }, { id:p.id, place:p }], planOffFor)[0];
  if (!leg) return "";
  const line = leg.line
    ? `<div class="pr-step"><span class="pr-line" style="background:${leg.line.color}">${leg.line.label}</span>
       <span class="pr-txt">${leg.line.from} ${icon("next", "pr-arr")} ${leg.line.to}</span></div>`
    : "";
  const kicker = fromHome ? `From ${from.name}, where the day starts`
    : i > 0 ? `From stop ${i}, ${from.name}`
            : `From your last stop, ${from.name}`;
  return `<div class="pop-route"><span class="pr-k">${kicker}</span>${line}
    <div class="pr-walk">${fmtM(leg.metres)} · ${hopHow(leg)}</div>
    ${dirBtnsHtml(leg, p.name, "Open in Naver Maps")}</div>`;
}

export function routeStripHtml(p){
  const j = journeyFor(p);
  if (!j) return "";
  const rows = j.rail.map((leg, i) => {
    const last = i === j.rail.length - 1;
    return `<div class="pr-step"><span class="pr-line" style="background:${leg.color}">${leg.label}</span>
      <span class="pr-txt">${icon("next", "pr-arr")}
      <span class="${last ? "pr-off" : "pr-to"}">${leg.to}</span>
      <span class="pr-tag${last ? " hop" : ""}">${last ? "get off" : "transfer"}</span></span></div>`;
  });
  const walk = j.walk < 950 ? `${Math.round(j.walk / 10) * 10} m walk` : `${(j.walk / 1000).toFixed(1)} km walk`;
  // the traced ride names the platforms; Naver is what you actually follow on the day
  const home = hotelFor(p.city);
  const links = home ? { naver: naverDirUrl(home, p), kakao: kakaoDirUrl(home, p) } : null;
  return `<div class="pop-route"><span class="pr-k">From the hotel</span>${rows.join("")}
    <div class="pr-walk">${icon("walk")} ${walk} to the door · ≈ ${j.minutes} min door to door</div>
    ${links ? dirBtnsHtml(links, p.name, "Open in Naver Maps") : ""}</div>`;
}

