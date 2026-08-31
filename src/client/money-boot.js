import { NUMBERS } from "../data/phrases.js";
import { HOME, RATES, RATES_AS_OF, WON_PRESETS } from "../data/rates.js";
import { sayParts, sections } from "../lib/phrases.js";
import { fmtHome, fmtWon, homeToWon, parseAmount, rateFor, roughRule, wonToHome } from "../lib/money.js";
import { wonReading } from "../lib/won.js";
import { closeNav, openNav, openTools } from "./nav.js";
import { save, saved } from "./store.js";
import { bootTool, bootToolLate } from "./tool-boot.js";

/* The money tool: what a price is in money you already think in, how to say it out loud,
   and the two counting systems behind both.

   It was three things at the bottom of the cheat sheet — a price reader, a numbers table
   and six phrases — under everything else on that page, which is exactly where you do
   not want them: the moment you need this is the moment somebody has just said a number
   at you. It is its own tool now (src/data/tools.js), and the conversion nobody had
   written is the thing at the top of it.

   Nothing here fetches a rate. This page is built to work with a dead SIM in Jeju, so a
   rate ships as data (src/data/rates.js), says the month it is from, and is editable —
   the number you actually got at the ATM beats anything committed months earlier. The
   arithmetic is in lib/money.js where a test can reach it; this file only paints.

   A separate entry from main.js, like the phrase page, and for the same reason: main.js
   needs window.L and a map to dereference. The shared page chrome is tool-boot.js. */

const boxEl = document.getElementById("mnbox");
const rateEl = document.getElementById("mnrate");
const listEl = document.getElementById("mnlist");

/* Which currency, and what it is worth. The code is remembered like night mode; a rate
   you have overridden is remembered beside it, per currency, so setting the dollar does
   not quietly reset the yen. */
export let cur = RATES.some(r => r.code === saved.cur) ? saved.cur : HOME;
export let rates = Object.assign({}, saved.rates);

/** The rate in force: yours if you set one, the shipped one otherwise. */
export const wonPer = () => Number(rates[cur]) > 0 ? Number(rates[cur]) : rateFor(cur).won;
export const isSet = () => Number(rates[cur]) > 0 && Number(rates[cur]) !== rateFor(cur).won;

/* Which box was typed into last. The two fields are the same number in two currencies,
   so one of them is always derived — and it has to be the one you are not typing in, or
   a rounded conversion would rewrite the digits under your thumb. */
let side = "won";

const sayHtml = (say) => sayParts(say)
  .map(p => p.stress ? `<span class="ph-st">${p.text}</span>` : p.text).join("");

/* ---------------- the converter ---------------- */

function boxHtml(){
  const r = rateFor(cur);
  return `<div class="mncur" role="group" aria-label="Your currency">${RATES
    .map(x => `<button class="phchip${x.code === cur ? " on" : ""}" type="button" data-cur="${x.code}"
      aria-pressed="${x.code === cur}">${x.symbol}<span class="ct">${x.code}</span></button>`).join("")}</div>
  <div class="mnf">
    <label class="mnside">
      <span class="mnside-l">Won</span>
      <span class="mnside-f"><i>₩</i><input class="mnin" id="mnWon" type="text" inputmode="numeric"
        autocomplete="off" placeholder="15,000" aria-label="A price in won" /></span>
    </label>
    <div class="mneq" aria-hidden="true">=</div>
    <label class="mnside">
      <span class="mnside-l">${r.label}</span>
      <span class="mnside-f"><i>${r.symbol}</i><input class="mnin" id="mnHome" type="text" inputmode="decimal"
        autocomplete="off" placeholder="16.85" aria-label="The same price in ${r.label}" /></span>
    </label>
  </div>
  <div class="mnpre">${WON_PRESETS
    .map(n => `<button class="phchip" type="button" data-won="${n}">${fmtWon(n)}</button>`).join("")}</div>
  <div class="mnout empty" id="mnOut">
    <div class="mnbad">Not a price — whole won only.</div>
    <div class="mnsay-l">Say it</div>
    <div class="ph-say" id="mnSay"></div>
    <div class="ph-rom" id="mnRom"></div>
  </div>`;
}

/* The rule you actually use at a stall, where nobody opens a converter — printed only
   when it is honest to within a few percent, which is lib/money.js's call, not this
   file's. Under it, the rate itself, because a rule of thumb you cannot check is a
   rumour. */
function rateHtml(){
  const won = wonPer(), r = rateFor(cur), rule = roughRule(won, cur);
  return `<div class="mnrule" id="mnRule">${rule ? rule.text : ""}</div>
    <div class="mnset">
      <span class="mnset-l">1 ${r.code} =</span>
      <input class="mnin small" id="mnRate" type="text" inputmode="decimal" autocomplete="off"
        value="${won}" aria-label="How many won one ${r.label} buys" />
      <span class="mnset-u">won</span>
      <button class="mnreset${isSet() ? "" : " off"}" type="button" id="mnReset">Use ${RATES_AS_OF}'s ${rateFor(cur).won}</button>
    </div>`;
}

/** Fill whichever field is not being typed into, and say the won amount out loud. */
export function sync(from){
  const wonEl = document.getElementById("mnWon"), homeEl = document.getElementById("mnHome");
  const out = document.getElementById("mnOut");
  if (!wonEl || !homeEl || !out) return null;
  if (from) side = from;
  const won = wonPer();
  let w = null;
  if (side === "won"){
    w = parseAmount(wonEl.value);
    const h = wonToHome(wonEl.value, won);
    homeEl.value = h == null ? "" : fmtHome(h, cur).replace(/^[^\d.]+/, "");
  } else {
    w = homeToWon(homeEl.value, won);
    wonEl.value = w == null ? "" : Math.round(w).toLocaleString("en-US");
  }
  /* Three states, not two. Nothing typed says nothing, because an empty field is not a
     mistake; a number it cannot read has to say so out loud, or the last good reading
     would sit there looking like the answer to what you just typed. */
  const raw = (side === "won" ? wonEl.value : homeEl.value).trim();
  const said = w == null ? null : wonReading(Math.round(w));
  out.classList.toggle("empty", !raw);
  out.classList.toggle("bad", !!raw && !said);
  document.getElementById("mnSay").innerHTML = said ? sayHtml(said.say) : "";
  document.getElementById("mnRom").textContent = said ? said.rom : "";
  return said;
}

function wireBox(){
  const wonEl = document.getElementById("mnWon"), homeEl = document.getElementById("mnHome");
  wonEl.oninput = () => sync("won");
  homeEl.oninput = () => sync("home");
  boxEl.querySelectorAll("[data-cur]").forEach(b => b.onclick = () => setCur(b.dataset.cur));
  boxEl.querySelectorAll("[data-won]").forEach(b => b.onclick = () => {
    wonEl.value = Number(b.dataset.won).toLocaleString("en-US");
    sync("won");
  });
}

function wireRate(){
  const el = document.getElementById("mnRate");
  /* Typing a rate must not re-render the field it is being typed into — that is the
     same focus-under-the-thumb bug the map page's search box has a comment about. So
     this updates what the rate feeds and nothing else. */
  if (el) el.oninput = () => {
    const n = parseAmount(el.value);
    if (n) setRate(n, true);
  };
  const reset = document.getElementById("mnReset");
  if (reset) reset.onclick = () => setRate(null);
}

/** What a changed rate changes, short of redrawing the control you are typing into. */
function applyRate(){
  const rule = roughRule(wonPer(), cur);
  const el = document.getElementById("mnRule");
  if (el) el.textContent = rule ? rule.text : "";
  const reset = document.getElementById("mnReset");
  if (reset) reset.classList.toggle("off", !isSet());
  sync();
}

export function setCur(code){
  if (!RATES.some(r => r.code === code)) return cur;
  cur = code;
  save({ cur });
  /* The won side is the one you were reading off a tag, so it is the one that survives
     a change of currency; the other half is recomputed. */
  render(true);
  return cur;
}

export function setRate(n, typing){
  if (n == null) delete rates[cur];
  else rates[cur] = n;
  save({ rates });
  if (typing) applyRate();
  else render(true);
  return wonPer();
}

/* ---------------- the rest of the page ---------------- */

const numsHtml = () => `<div class="phgroup" id="ph-numbers">
  <div class="phgroup-h">Numbers</div>
  <div class="phnums">
    <div class="phnum h"><span></span><span>Sino — money, time</span><span>Native — people, things</span></div>
    ${NUMBERS.map(x => `<div class="phnum">
      <span class="phnum-n">${x.n.toLocaleString("en-US")}</span>
      <span class="phnum-s">${x.sino}<em>${sayHtml(x.sinoSay)}</em></span>
      <span class="phnum-e">${x.nat ? `${x.nat}<em>${sayHtml(x.natSay)}</em>` : "—"}</span>
    </div>`).join("")}
  </div>
</div>`;

const rowHtml = (p) => `<div class="phrow" data-id="${p.id}">
  <div class="ph-h"><span class="ph-en">${p.en}</span><span class="ph-rom">${p.rom}</span></div>
  <div class="ph-say">${sayHtml(p.say)}</div>
</div>`;

const hearHtml = (rows, gid) => !rows.length ? "" : `<div class="phhear" data-hear="${gid}">
  <button class="phhear-t" type="button" aria-expanded="false">What they'll say back<span class="ct">${rows.length}</span></button>
  <div class="phhear-b">${rows.map(rowHtml).join("")}</div>
</div>`;

/* The money tier of the cheat sheet, on the page it belongs to. There is no search box
   here: it is one short section, and a control that filters nine rows is furniture. */
function listHtml(){
  return sections("", "money").map(s => `<div class="phtier">
    <div class="phtier-h">${s.tier.label}</div>
    <div class="phtier-n">${s.tier.note}</div>
  </div>` + s.groups.map(g => `<div class="phgroup" id="ph-${g.group.id}">
    <div class="phgroup-h">${g.group.label}</div>
    ${g.say.map(rowHtml).join("")}
    ${hearHtml(g.hear, g.group.id)}
  </div>`).join("")).join("") + numsHtml();
}

function render(keep){
  const won = keep ? document.getElementById("mnWon") : null;
  const typed = won ? won.value : "";
  boxEl.innerHTML = boxHtml();
  rateEl.innerHTML = rateHtml();
  if (!keep) listEl.innerHTML = listHtml();
  if (typed) document.getElementById("mnWon").value = typed;
  wireBox();
  wireRate();
  listEl.querySelectorAll(".phhear-t").forEach(b => b.onclick = () => {
    const box = b.closest(".phhear");
    b.setAttribute("aria-expanded", String(box.classList.toggle("on")));
  });
  sync("won");
}

/* ---------------- go ---------------- */
bootTool();
render();
bootToolLate();

window.trip = {
  sync, setCur, setRate, wonPer, wonToHome, homeToWon, roughRule, wonReading,
  openNav, openTools, closeNav,
  RATES, NUMBERS,
  setWon(v){ document.getElementById("mnWon").value = v == null ? "" : String(v); return sync("won"); },
  setHome(v){ document.getElementById("mnHome").value = v == null ? "" : String(v); return sync("home"); },
  get cur(){ return cur; },
  get rate(){ return wonPer(); },
};
