import { NUMBERS } from "../data/phrases.js";
import { CURRENCY, RATES_AS_OF, WON_PER_USD, WON_PRESETS } from "../data/rates.js";
import { sections } from "../lib/phrases.js";
import { fmtUsd, fmtWon, parseAmount, roughRule, usdToWon, wonToUsd } from "../lib/money.js";
import { wonReading } from "../lib/won.js";
import { closeNav, openNav, openTools } from "./nav.js";
import { hearHtml, rowHtml, sayHtml, wireHear } from "./phrase-row.js";
import { save, saved } from "./store.js";
import { bootTool, bootToolLate } from "./tool-boot.js";

/* The money tool: what a price is in dollars, how to say it out loud, and the two
   counting systems behind both.

   It was three things at the bottom of the cheat sheet — a price reader, a numbers table
   and six phrases — under everything else on that page, which is exactly where you do not
   want them: the moment you need this is the moment somebody has just said a number at
   you. It is its own tool now (src/data/tools.js), and the conversion nobody had written
   is the thing at the top of it.

   Two currencies, and one of them is won. There is no picker: this is a trip from the US
   with a US card in it, so the only question is what the tag says in dollars, and seven
   other currencies would have been furniture in front of the one conversion anybody here
   is doing.

   Nothing here fetches a rate. This page is built to work with a dead SIM in Jeju, so the
   rate ships as data (src/data/rates.js), says the month it is from, and is editable —
   the number you actually got at the ATM beats anything committed months earlier. The
   arithmetic is lib/money.js where a test can reach it; this file only paints.

   A separate entry from main.js, like the phrase page, and for the same reason: main.js
   needs window.L and a map to dereference. The shared page chrome is tool-boot.js. */

const boxEl = document.getElementById("mnbox");
const rateEl = document.getElementById("mnrate");
const listEl = document.getElementById("mnlist");

/* The rate in force: yours if you have set one, the shipped one otherwise. */
export let rate = Number(saved.wonRate) > 0 ? Number(saved.wonRate) : WON_PER_USD;
export const isSet = () => rate !== WON_PER_USD;

/* Which box was typed into last. The two fields are the same money in two currencies, so
   one of them is always derived — and it has to be the one you are not typing in, or a
   rounded conversion would rewrite the digits under your thumb. */
let side = "won";

/* ---------------- the converter ---------------- */

const boxHtml = () => `<div class="mnf">
    <label class="mnside">
      <span class="mnside-l">Won</span>
      <span class="mnside-f"><i>₩</i><input class="mnin" id="mnWon" type="text" inputmode="numeric"
        autocomplete="off" placeholder="15,000" aria-label="A price in won" /></span>
    </label>
    <div class="mneq" aria-hidden="true">=</div>
    <label class="mnside">
      <span class="mnside-l">${CURRENCY.label}</span>
      <span class="mnside-f"><i>${CURRENCY.symbol}</i><input class="mnin" id="mnUsd" type="text" inputmode="decimal"
        autocomplete="off" placeholder="11.11" aria-label="The same price in ${CURRENCY.label}" /></span>
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

/* The rule you actually use at a stall, where nobody opens a converter — printed only
   when it is honest to within a few percent, which is lib/money.js's call, not this
   file's. Under it, the rate itself, because a rule of thumb you cannot check is a
   rumour and this one ships months stale by design. */
function rateHtml(){
  const rule = roughRule(rate);
  return `<div class="mnrule" id="mnRule">${rule ? rule.text : ""}</div>
    <div class="mnset">
      <span class="mnset-l">1 ${CURRENCY.code} =</span>
      <input class="mnin small" id="mnRate" type="text" inputmode="decimal" autocomplete="off"
        value="${rate}" aria-label="How many won one dollar buys" />
      <span class="mnset-u">won</span>
      <button class="mnreset${isSet() ? "" : " off"}" type="button" id="mnReset">Back to ${RATES_AS_OF}'s ${WON_PER_USD}</button>
    </div>`;
}

/** Fill whichever field is not being typed into, and say the won amount out loud. */
export function sync(from){
  const wonEl = document.getElementById("mnWon"), usdEl = document.getElementById("mnUsd");
  const out = document.getElementById("mnOut");
  if (!wonEl || !usdEl || !out) return null;
  if (from) side = from;
  let w = null;
  if (side === "won"){
    w = parseAmount(wonEl.value);
    const d = wonToUsd(wonEl.value, rate);
    usdEl.value = d == null ? "" : fmtUsd(d).replace(/^\D+/, "");
  } else {
    w = usdToWon(usdEl.value, rate);
    wonEl.value = w == null ? "" : Math.round(w).toLocaleString("en-US");
  }
  /* Three states, not two. Nothing typed says nothing, because an empty field is not a
     mistake; a number it cannot read has to say so out loud, or the last good reading
     would sit there looking like the answer to what you just typed. */
  const raw = (side === "won" ? wonEl.value : usdEl.value).trim();
  const said = w == null ? null : wonReading(Math.round(w));
  out.classList.toggle("empty", !raw);
  out.classList.toggle("bad", !!raw && !said);
  document.getElementById("mnSay").innerHTML = said ? sayHtml(said.say) : "";
  document.getElementById("mnRom").textContent = said ? said.rom : "";
  return said;
}

export function setRate(n, typing){
  rate = n == null ? WON_PER_USD : n;
  save({ wonRate: isSet() ? rate : null });
  /* Typing a rate must not re-render the field it is being typed into — that is the same
     focus-under-the-thumb bug the map page's search box has a comment about. So while you
     are typing, only what the rate feeds is redrawn. */
  const rule = roughRule(rate);
  const el = document.getElementById("mnRule");
  if (el) el.textContent = rule ? rule.text : "";
  const reset = document.getElementById("mnReset");
  if (reset) reset.classList.toggle("off", !isSet());
  if (typing) sync();
  else render(true);
  return rate;
}

function wire(){
  const wonEl = document.getElementById("mnWon"), usdEl = document.getElementById("mnUsd");
  wonEl.oninput = () => sync("won");
  usdEl.oninput = () => sync("usd");
  boxEl.querySelectorAll("[data-won]").forEach(b => b.onclick = () => {
    wonEl.value = Number(b.dataset.won).toLocaleString("en-US");
    sync("won");
  });
  const el = document.getElementById("mnRate");
  if (el) el.oninput = () => { const n = parseAmount(el.value); if (n) setRate(n, true); };
  const reset = document.getElementById("mnReset");
  if (reset) reset.onclick = () => setRate(null);
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

/* The money tier of the cheat sheet, on the page it belongs to. There is no search box
   here: it is one short section, and a control that filters nine rows is furniture. */
const listHtml = () => sections("", "money").map(s => `<div class="phtier">
    <div class="phtier-h">${s.tier.label}</div>
    <div class="phtier-n">${s.tier.note}</div>
  </div>` + s.groups.map(g => `<div class="phgroup" id="ph-${g.group.id}">
    <div class="phgroup-h">${g.group.label}</div>
    ${g.say.map(rowHtml).join("")}
    ${hearHtml(g.hear, g.group.id)}
  </div>`).join("")).join("") + numsHtml();

function render(keep){
  const typed = keep ? (document.getElementById("mnWon") || {}).value : "";
  boxEl.innerHTML = boxHtml();
  rateEl.innerHTML = rateHtml();
  if (!keep){ listEl.innerHTML = listHtml(); wireHear(listEl); }
  if (typed) document.getElementById("mnWon").value = typed;
  wire();
  sync("won");
}

/* ---------------- go ---------------- */
bootTool();
render();
bootToolLate();

window.trip = {
  sync, setRate, wonToUsd, usdToWon, roughRule, wonReading,
  openNav, openTools, closeNav,
  NUMBERS, CURRENCY,
  setWon(v){ document.getElementById("mnWon").value = v == null ? "" : String(v); return sync("won"); },
  setUsd(v){ document.getElementById("mnUsd").value = v == null ? "" : String(v); return sync("usd"); },
  get rate(){ return rate; },
};
