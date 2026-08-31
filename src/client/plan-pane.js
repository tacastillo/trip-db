import { dirOrigin } from "./geo-me.js";
import { planDragStart } from "./plan-drag.js";
import { fitPlan } from "./plan-map.js";
import { esc, plan, planAdd, planBody, planClear, planDragging, planFull, planHotelLine, planLead, planMoveBody, planOffFor, planOver, planRemove, planReorderBody, savePlan, setPlanDay, setPlanRenderQueued, syncPlanUrl, urlWritable } from "./plan-state.js";
import { focus } from "./selection.js";
import { active, currentTab, map } from "./state.js";
import { storeOk } from "./store.js";
import { setTab } from "./tabs.js";
import { CATS, LEGS, PLACES } from "../data/places.js";
import { dirLinks, PLAN_MAX_STOPS, PLAN_TITLE_MAX, SWAP_GAIN_M, encodePlanQuery, fmtDay, fmtM, homeLeg, hotelFor, isoDay, nearbySuggestions, orderCautions, planBriefMarkdown, planIcs, planShareText, planStats, reorderByProximity, startLeg, tripDays } from "../lib/plan-core.js";
import { ride } from "../lib/rail.js";
import { icon } from "../lib/icons.js";
import { catVar } from "../lib/design.js";

/* ---------------- the plan pane ---------------- */

export function planStopHtml(s, i){
  const p = s.place;
  const c = p ? (CATS[p.cat] || {}) : {};
  const body = p
    ? `<span class="pname">${p.name}</span>
       <span class="phood">${p.cluster}</span>
       ${p.note ? `<span class="pnote">${p.note}</span>` : ""}
       ${p.meta ? `<span class="pmetaline">${p.meta}</span>` : ""}`
    : `<span class="pname">unknown spot “${esc(s.id)}”</span>
       <span class="phood">this link names an id the map no longer has</span>`;
  // Four columns, the same four on every row, so the eye reads straight down: the grab
  // strip, the number, the stop, the remove. There are no up/down arrows — two 9px
  // arrows stacked in a column were the smallest targets on the page and dragging is
  // the gesture people reach for anyway, so the handle got their space instead.
  return `<div class="pstop${p ? "" : " gone"}" data-i="${i}">
    <button class="pdrag" data-drag="${i}" title="Drag to reorder" aria-label="Drag ${p ? p.name : s.id} to reorder">${icon("drag")}</button>
    <span class="pnum-i" style="background:${p ? catVar(p.cat) : "var(--muted)"}">${i + 1}</span>
    <button class="pbody" data-focus="${p ? p.id : ""}">${body}</button>
    <button class="pdrop" data-drop="${esc(s.id)}" title="Remove" aria-label="Remove ${p ? p.name : s.id} from the day">${icon("close")}</button>
  </div>`;
}

/** The one thing on this page that actually navigates you somewhere, so it is a
    control rather than a footnote: filled, labelled, and a 44px target on a phone.
    Every hop, the walk home and the card all use this same button. */
export function naverBtnHtml(href, to, label){
  return `<a class="phop-a" href="${href}" target="_blank" rel="noopener noreferrer"
    aria-label="Directions to ${esc(to)} in Naver Maps">${label || "Naver"} ${icon("out", "phop-a-x")}</a>`;
}

/* Kakao is what half of Korea actually navigates with, but Naver is the one this map's
   links are built and pinned against, so Naver stays the filled button and Kakao is the
   quiet second one beside it. Same shape everywhere: hop rows, the walk home, both
   cards. There is no taxi button — see kakaoDirUrl() for why. */
export function kakaoBtnHtml(href, to, label){
  return `<a class="phop-a alt" href="${href}" target="_blank" rel="noopener noreferrer"
    aria-label="Directions to ${esc(to)} in Kakao Map">${label || "Kakao"}</a>`;
}

/** Every way this page can hand you off to something that actually navigates, as one
    group. It is a wrapper rather than three loose buttons because they have to move
    together: on a 340px hop row they sit on the distance's line or drop below it whole,
    and on a phone Naver takes a row of its own with the other two sharing the next. A
    button that wraps onto a line by itself reads as floating. */
export function dirBtnsHtml(links, to, label){
  return `<span class="phop-go">${naverBtnHtml(links.naver, to, label)}`
    + (links.kakao ? kakaoBtnHtml(links.kakao, to) : "")
    + `</span>`;
}

/* Short enough that the distance, the manner and the Naver button fit on one line in a
   340px sidebar — a button that wraps onto a line of its own reads as floating. */
export function hopHow(leg){
  return leg.walkable ? `${leg.walkMin} min walk`
                      : (leg.mode === "car" ? "worth driving" : "worth riding");
}

export function planHopHtml(leg, cls){
  if (!leg) return "";
  // named only where the geometry proves it: one line, both stations, no transfer guessed
  const line = leg.line
    ? `<span class="phop-l" style="--ln:${leg.line.color}">${leg.line.label}</span>
       <span class="phop-s">${leg.line.from} ${icon("next", "phop-arr")} ${leg.line.to}</span>`
    : "";
  return `<div class="phop${cls ? " " + cls : ""}">
    <span class="phop-d"><b>${fmtM(leg.metres)}</b> · ${hopHow(leg)}</span>
    ${line}${dirBtnsHtml(leg, leg.b.name)}</div>`;
}

/* The two ends of the day, drawn the same way because they are the same thing: every
   morning of this trip starts at the hotel and every night comes back to it, and neither
   is a decision made in this pane. So neither is a stop — they are fixed rows, always on
   screen, with no number, no handle and no remove. What sits between them is the day.
   homeLeg() explains why the end could never have been a stop; startLeg() is its mirror. */
export function planEndHtml(home, text, cls){
  return `<div class="pend${cls ? " " + cls : ""}">
    <span class="pend-i" style="background:${catVar("hotel")}">${icon((CATS.hotel || {}).icon)}</span>
    <span class="pend-t">${text} ${esc(home.name)}</span></div>`;
}

/** The hotel, then the hop out of it. Shown on an empty day too: it is where the day
    starts whether or not anything has been picked, and a day that grows downward from a
    fixed point reads better than one that appears out of nowhere.

    Its two hand-off buttons start from where you are, when the page knows — this is the
    one hop on the page rooted at the hotel rather than at another stop, and at four in
    the afternoon "how do I get from the hotel to stop one" is a question about a morning
    that already happened. The distance beside them is still the hop's own, because that
    is the day's shape and not a route: see hereOrigin() in lib/plan-core.js.

    The hops between stops are deliberately left alone. A row that measures stop 2 to
    stop 3 and then links stop 4 to stop 3 is a row disagreeing with itself, and those
    rows are the plan being read rather than a person walking. The card is where "take me
    there from here" lives, and it says so in a line the hop row has no room for. */
export function planStartHtml(stops){
  const home = hotelFor(plan.city, PLACES);
  if (!home) return "";
  const leg = startLeg(stops, plan.city, planOffFor, PLACES);
  const from = leg && dirOrigin(leg.a, leg.b);
  return planEndHtml(home, "Starts at", "start")
    + planHopHtml(leg && from !== leg.a ? Object.assign({}, leg, dirLinks(from, leg.b)) : leg, "start");
}

/** And its mirror: the hop back, then the hotel. */
export function planHomeHtml(stops){
  const home = hotelFor(plan.city, PLACES);
  if (!home) return "";
  return planHopHtml(homeLeg(stops, plan.city, planOffFor, PLACES), "home")
    + planEndHtml(home, "Ends back at");
}

/* The trip is fifteen days long and every one of them is a chip, which is the whole
   argument for having a date at all now: nobody is typing 2026-09-11 into a field, but
   tapping "Fri 11 Sep" costs nothing and buys the weekday-closure cautions and a
   calendar file. The day still computes no schedule — see closedDays() and planIcs(). */
export function planDaysHtml(){
  const today = isoDay();
  const chips = tripDays().map(d => {
    const leg = LEGS.find(l => l.id === d.leg);
    return `<button class="pday${d.day === plan.day ? " on" : ""}${d.day === today ? " today" : ""}"
      data-day="${d.day}" title="${d.day}${leg ? " · " + leg.label : " · travelling"}">
      <span class="pday-d">${d.label}</span>
      <span class="pday-l">${leg ? leg.label : "in transit"}</span></button>`;
  });
  return `<div class="pdays" id="planDays">${chips.join("")}
    <button class="pday clear${plan.day ? "" : " on"}" data-day="" title="No date on this day">
      <span class="pday-d">No date</span><span class="pday-l">no closures</span></button></div>`;
}

export function renderPlan(){
  // a re-render mid-drag would yank the row out from under the pointer
  if (planDragging){ setPlanRenderQueued(true); return; }
  const el = document.getElementById("planpane");
  if (!el) return;
  /* Everything below counts in stops, and the hotel at either end is not one. A link
     written before that was true still names it first; planLead() absorbs that id into
     the start row rather than rewriting somebody's link. */
  const stops = planBody();
  const st = planStats(stops, planOffFor);
  const cautions = orderCautions(stops, plan.city, plan.day);
  const cityLabel = (LEGS.find(l => l.id === plan.city) || {}).label || plan.city;
  const out = [];

  // both computed ends are walking you actually do, so they are in the day's numbers
  const ends = [startLeg(stops, plan.city, planOffFor, PLACES),
                homeLeg(stops, plan.city, planOffFor, PLACES)].filter(Boolean);
  const walkM = st.walkM + ends.filter(l => l.walkable).reduce((a, l) => a + l.walkM, 0);
  const rides = st.rides + ends.filter(l => !l.walkable).length;

  const bits = [`<b>${st.resolved}</b> stop${st.resolved === 1 ? "" : "s"}`];
  if (walkM) bits.push(`${fmtM(walkM)} on foot`);
  if (rides) bits.push(`${rides} hop${rides === 1 ? "" : "s"} to ride`);
  if (plan.day) bits.push(fmtDay(plan.day));
  out.push(`<div class="phead">
    <input class="ptitle" id="planTitle" placeholder="Name this day" maxlength="${PLAN_TITLE_MAX}" value="${esc(plan.title)}" />
    ${planDaysHtml()}
    <div class="pmeta">${cityLabel} · ${bits.join(" · ")}</div>
  </div>`);
  if (!storeOk) out.push(`<div class="pcaution">This browser will not let the page remember anything between visits, so this day lives in the link above and nowhere else. Copy it before you close the tab.</div>`);

  if (stops.length){
    out.push(`<div class="pacts">
      <button class="pact" id="planFit">Frame the day</button>
      <button class="pact" id="planLink">Copy link</button>
      <button class="pact" id="planText">Copy as a message</button>
      <button class="pact" id="planBrief">Copy briefing</button>
      <button class="pact${plan.day ? "" : " off"}" id="planIcs">${plan.day ? "Add to a calendar" : "Calendar: pick a day"}</button>
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
  }

  out.push(planStartHtml(stops));
  if (!stops.length){
    out.push(`<div class="pempty">Nothing planned yet.<br />Pick spots from the map or the Places tab and they land here, in order — between those two rows, which is where every day of this trip begins and ends.</div>`);
  } else {
    stops.forEach((s, i) => {
      out.push(planStopHtml(s, i));
      // the last stop's hop is the way home, and planHomeHtml draws that one
      if (i < stops.length - 1) out.push(planHopHtml(st.legs[i]));
    });
  }
  out.push(planHomeHtml(stops));

  const sug = nearbySuggestions(stops, { places: PLACES, city: plan.city, cats: active });
  if (sug.length){
    out.push(`<div class="psec"><div class="psec-h">Nearby what you have</div></div>`);
    sug.forEach(s => {
      const c = CATS[s.place.cat] || {};
      const anchor = stops[s.nearIdx] && stops[s.nearIdx].place;
      out.push(`<button class="psug" data-suggest="${s.place.id}" data-at="${s.insertAt}">
        <span class="pindot" style="background:${catVar(s.place.cat)}">${icon(c.icon)}</span>
        <span class="it-body">
          <span class="it-name">${s.place.name}</span>
          <span class="it-note">${s.place.note}</span>
          <span class="psug-d">${fmtM(s.d)} from ${anchor ? anchor.name : "your plan"}</span>
        </span></button>`);
    });
  }
  el.innerHTML = out.join("");
  wirePlanPane(el);
  /* Fifteen chips in a scroller: the one that is on has to be the one you can see. With
     no date chosen that is today if today is on this trip, never the "no date" chip at
     the far end — scrolling to that hides every day of the trip. */
  const on = el.querySelector(".pday.on:not(.clear)") || el.querySelector(".pday.today");
  if (on && on.parentElement) on.parentElement.scrollLeft =
    Math.max(0, on.offsetLeft - on.parentElement.clientWidth / 2 + on.offsetWidth / 2);
}

export function wirePlanPane(el){
  const on = (sel, ev, fn) => el.querySelectorAll(sel).forEach(n => n.addEventListener(ev, fn));
  on("[data-focus]", "click", e => { const id = e.currentTarget.dataset.focus; if (id) focus(id); });
  on("[data-drop]", "click", e => planRemove(e.currentTarget.dataset.drop));
  on("[data-swap]", "click", e => { const i = +e.currentTarget.dataset.swap; planMoveBody(i, i + 1); });
  on("[data-suggest]", "click", e => planAdd(e.currentTarget.dataset.suggest, +e.currentTarget.dataset.at + planLead()));
  on("[data-drag]", "pointerdown", planDragStart);

  const t = el.querySelector("#planTitle");
  if (t) t.oninput = () => { plan.title = t.value.slice(0, PLAN_TITLE_MAX); syncPlanUrl(); savePlan(); };
  const wire = (id, fn) => { const b = el.querySelector("#" + id); if (b) b.onclick = fn; };
  wire("planFit", fitPlan);
  wire("planWipe", () => { if (!plan.ids.length || confirm("Clear this day?")) planClear(); });
  wire("planReorder", () => planReorderBody(reorderByProximity(planBody()).order));
  wire("planGoCity", () => setTab(plan.city));
  wire("planBrief", e => copyOut(e, planBriefMarkdown(plan, planBody(), planHref(), planHotelLine, planOffFor), "Briefing copied"));
  wire("planText", e => copyOut(e, planShareText(plan, planBody(), planHref()), "Copied"));
  wire("planLink", e => copyOut(e, planHref(), "Link copied"));
  wire("planIcs", e => downloadIcs(e));
  on("[data-day]", "click", e => {
    const d = e.currentTarget.dataset.day;
    setPlanDay(d === plan.day ? "" : d);
  });
}

export function planHref(){
  return location.origin + location.pathname + encodePlanQuery(plan);
}

/** One all-day entry, carrying the order in its description. Without a date there is
    nothing to hang it on, so the button says so and takes you to the picker instead of
    quietly doing nothing. */
export function downloadIcs(e){
  const btn = e.currentTarget;
  if (!plan.day){
    const picker = document.getElementById("planDays");
    if (picker){
      picker.scrollIntoView({ block:"nearest", behavior:"smooth" });
      picker.classList.add("asking");
      setTimeout(() => picker.classList.remove("asking"), 1400);
    }
    return;
  }
  const text = planIcs(plan, planBody(), planHref());
  if (!text) return;
  const name = `${plan.day}-${(plan.title || plan.city).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "day"}.ics`;
  const url = URL.createObjectURL(new Blob([text], { type:"text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // revoked late: Safari has been known to hand the blob to the download after the click
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  const was = btn.textContent;
  btn.textContent = "Calendar file saved";
  btn.classList.add("done");
  setTimeout(() => { btn.textContent = was; btn.classList.remove("done"); }, 1800);
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

