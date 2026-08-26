import { planDragStart } from "./plan-drag.js";
import { fitPlan } from "./plan-map.js";
import { afterPlanChange, esc, plan, planAdd, planClear, planDragging, planFull, planHotelLine, planMove, planOffFor, planOver, planRemove, planReorder, planSeedStart, planStops, setPlanRenderQueued, syncPlanUrl, urlWritable } from "./plan-state.js";
import { focus } from "./selection.js";
import { active, currentTab, map } from "./state.js";
import { setTab } from "./tabs.js";
import { CATS, LEGS, PLACES } from "../data/places.js";
import { PLAN_MAX_STOPS, PLAN_TITLE_MAX, SWAP_GAIN_M, encodePlanQuery, fmtM, homeLeg, hotelFor, nearbySuggestions, orderCautions, planBriefMarkdown, planStats, reorderByProximity } from "../lib/plan-core.js";
import { ride } from "../lib/rail.js";

/* ---------------- the plan pane ---------------- */

export function planStopHtml(s, i, n){
  const p = s.place;
  const c = p ? (CATS[p.cat] || {}) : {};
  const body = p
    ? `<span class="pname">${p.name}</span>
       <span class="phood">${p.cluster}</span>
       ${p.note ? `<span class="pnote">${p.note}</span>` : ""}
       ${p.meta ? `<span class="pmetaline">${p.meta}</span>` : ""}`
    : `<span class="pname">unknown spot “${esc(s.id)}”</span>
       <span class="phood">this link names an id the map no longer has</span>`;
  return `<div class="pstop${p ? "" : " gone"}" data-i="${i}">
    <button class="pdrag" data-drag="${i}" title="Drag to reorder" aria-label="Drag to reorder">⠿</button>
    <span class="pnum-i" style="background:${p ? (c.color || "#888") : "#888"}">${i + 1}</span>
    <button class="pbody" data-focus="${p ? p.id : ""}">${body}</button>
    <span class="pctrl">
      <button class="pmove" data-up="${i}" ${i === 0 ? "disabled" : ""} title="Move up" aria-label="Move up">▲</button>
      <button class="pmove" data-down="${i}" ${i === n - 1 ? "disabled" : ""} title="Move down" aria-label="Move down">▼</button>
      <button class="pdrop" data-drop="${esc(s.id)}" title="Remove" aria-label="Remove">✕</button>
    </span>
  </div>`;
}

/** The one thing on this page that actually navigates you somewhere, so it is a
    control rather than a footnote: filled, labelled, and a 44px target on a phone.
    Every hop, the walk home and the card all use this same button. */
export function naverBtnHtml(href, to, label){
  return `<a class="phop-a" href="${href}" target="_blank" rel="noopener noreferrer"
    aria-label="Directions to ${esc(to)} in Naver Maps">${label || "Naver"} <span class="phop-a-x">↗</span></a>`;
}

export function hopHow(leg){
  return leg.walkable ? `about ${leg.walkMin} min on foot`
                      : (leg.mode === "car" ? "worth driving" : "worth riding");
}

export function planHopHtml(leg, cls){
  if (!leg) return "";
  // named only where the geometry proves it: one line, both stations, no transfer guessed
  const line = leg.line
    ? `<span class="phop-l" style="--ln:${leg.line.color}">${leg.line.label}</span>
       <span class="phop-s">${leg.line.from} → ${leg.line.to}</span>`
    : "";
  return `<div class="phop${cls ? " " + cls : ""}"><span class="phop-r"></span>
    <span class="phop-d">${fmtM(leg.metres)} · ${hopHow(leg)}</span>
    ${line}${naverBtnHtml(leg.naver, leg.b.name)}</div>`;
}

/** A day ends at the hotel, so the pane says so and hands you the way back. It is a
    closing row rather than a stop — see homeLeg() for why it cannot be one. */
export function planHomeHtml(stops){
  const leg = homeLeg(stops, plan.city, planOffFor, PLACES);
  if (!leg) return "";
  return planHopHtml(leg, "home") + `<div class="pend">
    <span class="pend-i" style="background:${(CATS.hotel || {}).color}">🏨</span>
    <span class="pend-t">Ends back at ${leg.home.name}</span></div>`;
}

export function renderPlan(){
  // a re-render mid-drag would yank the row out from under the pointer
  if (planDragging){ setPlanRenderQueued(true); return; }
  const el = document.getElementById("planpane");
  if (!el) return;
  const stops = planStops();
  const st = planStats(stops, planOffFor);
  const cautions = orderCautions(stops, plan.city, plan.day);
  const cityLabel = (LEGS.find(l => l.id === plan.city) || {}).label || plan.city;
  const out = [];

  const bits = [`<b>${st.resolved}</b> stop${st.resolved === 1 ? "" : "s"}`];
  if (st.walkM) bits.push(`${fmtM(st.walkM)} on foot`);
  if (st.rides) bits.push(`${st.rides} hop${st.rides === 1 ? "" : "s"} to ride`);
  out.push(`<div class="phead">
    <input class="ptitle" id="planTitle" placeholder="Name this day" maxlength="${PLAN_TITLE_MAX}" value="${esc(plan.title)}" />
    <div class="pmeta">${cityLabel} · ${bits.join(" · ")}</div>
  </div>`);

  if (!plan.ids.length){
    const h = hotelFor(plan.city, PLACES);
    out.push(`<div class="pempty">Nothing planned yet.<br />Pick spots from the map or the Places tab and they land here, in order.
      ${h ? `<br />The day starts at ${h.name}; the first spot you add puts it in front.` : ""}</div>`);
    if (h) out.push(`<div class="pacts"><button class="pact" id="planStart">Start at ${h.name}</button></div>`);
  } else {
    out.push(`<div class="pacts">
      <button class="pact" id="planFit">Frame the day</button>
      <button class="pact" id="planBrief">Copy briefing</button>
      <button class="pact" id="planLink">Copy link</button>
      <button class="pact" id="planWipe">Clear</button>
    </div>`);
    if (planOver) out.push(`<div class="pcaution">That link named ${planOver} more stop${planOver > 1 ? "s" : ""} than a day holds, so the last ${planOver === 1 ? "one was" : "ones were"} left off. A day tops out at ${PLAN_MAX_STOPS}.</div>`);
    if (planFull) out.push(`<div class="pcaution">This day is full at ${PLAN_MAX_STOPS} stops. Drop one to add another.</div>`);
    if (!urlWritable) out.push(`<div class="pcaution">This browser will not let the page rewrite its address, so the link above is the one to copy by hand. Everything else works.</div>`);
    if (currentTab !== plan.city) out.push(`<div class="pcaution">This day is in ${cityLabel}, and you are looking at ${(LEGS.find(l => l.id === currentTab) || {}).label}. <button class="pcaution-fix" id="planGoCity">Show ${cityLabel}</button></div>`);

    cautions.forEach((c, k) => {
      const fix = c.kind === "order"
        ? `<button class="pcaution-fix" data-swap="${c.i}">Swap them</button>` : "";
      out.push(`<div class="pcaution ${c.kind}">${esc(c.text)}${fix}</div>`);
    });
    const ro = reorderByProximity(stops);
    if (ro.gain_m > SWAP_GAIN_M) out.push(`<div class="pcaution">
      Walked in a different order this day is about ${fmtM(ro.gain_m)} shorter.
      <button class="pcaution-fix" id="planReorder">Reorder by proximity</button></div>`);

    stops.forEach((s, i) => {
      out.push(planStopHtml(s, i, stops.length));
      out.push(planHopHtml(st.legs[i]));
    });
    out.push(planHomeHtml(stops));
  }

  const sug = nearbySuggestions(stops, { places: PLACES, city: plan.city, cats: active });
  if (sug.length){
    out.push(`<div class="psec"><div class="psec-h">Nearby what you have</div></div>`);
    sug.forEach(s => {
      const c = CATS[s.place.cat] || {};
      const anchor = stops[s.nearIdx] && stops[s.nearIdx].place;
      out.push(`<button class="psug" data-suggest="${s.place.id}" data-at="${s.insertAt}">
        <span class="pindot" style="background:${c.color}">${c.emoji}</span>
        <span class="it-body">
          <span class="it-name">${s.place.name}</span>
          <span class="it-note">${s.place.note}</span>
          <span class="psug-d">${fmtM(s.d)} from ${anchor ? anchor.name : "your plan"}</span>
        </span></button>`);
    });
  }
  el.innerHTML = out.join("");
  wirePlanPane(el);
}

export function wirePlanPane(el){
  const on = (sel, ev, fn) => el.querySelectorAll(sel).forEach(n => n.addEventListener(ev, fn));
  on("[data-focus]", "click", e => { const id = e.currentTarget.dataset.focus; if (id) focus(id); });
  on("[data-drop]", "click", e => planRemove(e.currentTarget.dataset.drop));
  on("[data-up]", "click", e => { const i = +e.currentTarget.dataset.up; planMove(i, i - 1); });
  on("[data-down]", "click", e => { const i = +e.currentTarget.dataset.down; planMove(i, i + 1); });
  on("[data-swap]", "click", e => { const i = +e.currentTarget.dataset.swap; planMove(i, i + 1); });
  on("[data-suggest]", "click", e => planAdd(e.currentTarget.dataset.suggest, +e.currentTarget.dataset.at));
  on("[data-drag]", "pointerdown", planDragStart);

  const t = el.querySelector("#planTitle");
  if (t) t.oninput = () => { plan.title = t.value.slice(0, PLAN_TITLE_MAX); syncPlanUrl(); };
  const wire = (id, fn) => { const b = el.querySelector("#" + id); if (b) b.onclick = fn; };
  wire("planStart", () => { planSeedStart(); afterPlanChange(); });
  wire("planFit", fitPlan);
  wire("planWipe", () => { if (!plan.ids.length || confirm("Clear this day?")) planClear(); });
  wire("planReorder", () => planReorder(reorderByProximity(planStops()).order));
  wire("planGoCity", () => setTab(plan.city));
  wire("planBrief", e => copyOut(e, planBriefMarkdown(plan, planStops(), planHref(), planHotelLine, planOffFor), "Briefing copied"));
  wire("planLink", e => copyOut(e, planHref(), "Link copied"));
}

export function planHref(){
  return location.origin + location.pathname + encodePlanQuery(plan);
}

/* clipboard needs a secure context, which file:// is not — fall back to a selection
   the person can copy themselves rather than failing silently */
export function copyOut(e, text, okLabel){
  const btn = e.currentTarget, was = btn.textContent;
  const done = () => { btn.textContent = okLabel; btn.classList.add("done");
    setTimeout(() => { btn.textContent = was; btn.classList.remove("done"); }, 1600); };
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
export function fallbackCopy(text, done){
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed; left:-9999px; top:0;";
  document.body.appendChild(ta);
  ta.select();
  let okd = false;
  try { okd = document.execCommand("copy"); } catch (e){ okd = false; }
  document.body.removeChild(ta);
  if (okd) done(); else window.prompt("Copy this:", text);
}

