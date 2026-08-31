import { PHRASES } from "../data/phrases.js";
import { countMatching, sections, tiersFor } from "../lib/phrases.js";
import { closeNav, openNav, openTools } from "./nav.js";
import { hearHtml, rowHtml, sayHtml, wireHear } from "./phrase-row.js";
import { save, saved } from "./store.js";
import { bootTool, bootToolLate } from "./tool-boot.js";

/* The whole of the cheat sheet page.

   It is a separate entry from main.js on purpose and must stay one: main.js imports
   map.js, which needs window.L, and four of its modules dereference the map page's own
   markup as they evaluate (view.js, tabs.js, list.js, plan-boot.js). Importing it here
   would take this page down before it painted. What both pages do share — the palette,
   night mode, the store, the nav and the worker — is client/tool-boot.js.

   One tier at a time, which is the whole layout argument. The first cut rendered every
   tier, every group and the money tool in one column: sixty-odd rows, three lines each,
   four thousand pixels of scrolling to reach "if it comes up". Nobody scrolls a phone to
   a chapter. So money left for its own page (src/data/tools.js), the rows lost a line,
   and the tiers became a segmented control — three taps' worth of sheet, one screen at a
   time. A search still crosses all of them, because when you are looking for a row you
   do not know which tier it is in. */

const pane = document.getElementById("phpage");
const listEl = document.getElementById("phlist");
const tiersEl = document.getElementById("phtiers");
const jumpEl = document.getElementById("phjump");
const barEl = document.querySelector(".phbar");
const searchEl = document.getElementById("phsearch");
const clearEl = document.getElementById("phsearchClear");
const countEl = document.getElementById("phcount");

const TIERS = tiersFor("phrases");

export let query = "";
/* Which tier is on. Remembered like night mode: on the second morning of the trip you
   are not in the same tier you were reading on the first. An id this browser remembered
   that no longer exists falls back rather than rendering nothing. */
export let tier = TIERS.some(t => t.id === saved.phTier) ? saved.phTier : TIERS[0].id;

const searching = () => !!query.trim();

/* ---------------- rendering ---------------- */

/* A word is not a sentence and does not get a sentence's row. Two columns of bare words
   is the densest honest shape for them, and density is the point: these are the ones you
   reach for mid-sentence — hot, cold, iced, without — and a column of them you can take
   in at a glance beats a scroll of rows that each say one word. */
const wordsHtml = (rows) => `<div class="phwords">${rows.map(p => `<div class="phword" data-id="${p.id}">
  <span class="ph-en">${p.en}</span>
  <span class="ph-say">${sayHtml(p.say)}</span>
  <span class="ph-rom">${p.rom}</span>
</div>`).join("")}</div>`;

const groupHtml = (g) => `<div class="phgroup" id="ph-${g.group.id}">
  <div class="phgroup-h">${g.group.label}</div>
  ${g.words.length ? wordsHtml(g.words) : ""}
  ${g.say.map(rowHtml).join("")}
  ${hearHtml(g.hear, g.group.id)}
</div>`;

/* The tiers, as a segmented control. Counts on them because the first question about a
   tier you are not in is how much is in it. */
function renderTiers(){
  tiersEl.innerHTML = TIERS.map(t => `<button class="phseg${!searching() && t.id === tier ? " on" : ""}"
    type="button" data-tier="${t.id}" aria-pressed="${!searching() && t.id === tier}">${t.label}</button>`).join("");
}

/* Rows the query finds on the other tool. Searching this page for "receipt" used to find
   nothing the day money moved to its own page, which is the one real cost of splitting
   them — so the sheet says where the rows went rather than saying there are none. */
function otherHtml(){
  if (!searching()) return "";
  const n = countMatching(query, "money");
  if (!n) return "";
  const base = document.documentElement.dataset.base || "./";
  return `<a class="phelse" href="${base}money.html">${n} more ${n === 1 ? "row" : "rows"} for
    <b>${query.trim()}</b> on the money page</a>`;
}

function render(){
  const all = sections(query, "phrases");
  const secs = searching() ? all : all.filter(s => s.tier.id === tier);
  renderTiers();
  if (!secs.length){
    listEl.innerHTML = otherHtml() + `<div class="phnone">Nothing on this page matches <b>${query}</b>.<br>Papago is the backup for anything this sheet does not carry.</div>`;
    jumpEl.innerHTML = "";
  } else {
    listEl.innerHTML = otherHtml() + secs.map(s => `<div class="phtier">
      <div class="phtier-h">${s.tier.label}</div>
      <div class="phtier-n">${s.tier.note}</div>
    </div>` + s.groups.map(groupHtml).join("")).join("");
    /* The jump bar empties in step with the list: a chip that scrolls to a section the
       search has removed is a control that lies. */
    jumpEl.innerHTML = secs.flatMap(s => s.groups)
      .map(g => `<button class="phchip" type="button" data-go="ph-${g.group.id}">${g.group.label}<span class="ct">${g.say.length + g.hear.length + g.words.length}</span></button>`).join("");
  }
  const n = countMatching(query, "phrases");
  countEl.hidden = !searching();
  countEl.innerHTML = `<b>${n}</b> of ${PHRASES.length} ${n === 1 ? "row" : "rows"}`;
  wireList();
  syncJump();
}

export function setTier(id){
  if (!TIERS.some(t => t.id === id)) return tier;
  tier = id;
  save({ phTier: tier });
  render();
  pane.scrollTop = 0;      // a new tier starts at its own top, not halfway down the last
  return tier;
}

/* ---------------- what the rendered rows do ---------------- */

const wireList = () => wireHear(listEl);

/* ---------------- the jump bar ---------------- */

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* How far below the top of the scrolling pane a section currently sits. Measured off
   rects rather than offsetTop, which is relative to whichever ancestor happens to be
   positioned — not to the thing doing the scrolling. */
const offsetIn = (el) => el.getBoundingClientRect().top - pane.getBoundingClientRect().top;

export function jumpTo(id){
  const el = document.getElementById(id);
  if (!el) return;
  /* Scroll the pane rather than the element into view: the bar is sticky, so
     scrollIntoView lands the heading underneath it. */
  const top = pane.scrollTop + offsetIn(el) - barEl.offsetHeight - 8;
  pane.scrollTo({ top: Math.max(0, top), behavior: reduced() ? "auto" : "smooth" });
}

/* Which section you are actually in, so the bar says where you are rather than only
   where you could go. */
function syncJump(){
  const chips = [...jumpEl.querySelectorAll("[data-go]")];
  if (!chips.length) return;
  const edge = barEl.offsetHeight + 12;
  let here = chips[0].dataset.go;
  for (const c of chips){
    const el = document.getElementById(c.dataset.go);
    if (el && offsetIn(el) <= edge) here = c.dataset.go;
  }
  chips.forEach(c => c.classList.toggle("on", c.dataset.go === here));
}

/* ---------------- go ---------------- */
bootTool();
render();

searchEl.oninput = () => {
  query = searchEl.value;
  clearEl.classList.toggle("on", !!query.trim());
  render();
};
searchEl.onkeydown = e => {
  if (e.key === "Escape" && searchEl.value){ e.stopPropagation(); searchEl.value = ""; searchEl.oninput(); }
};
clearEl.onclick = () => { searchEl.value = ""; searchEl.oninput(); searchEl.focus(); };

tiersEl.onclick = e => {
  const b = e.target.closest("[data-tier]");
  if (!b) return;
  /* A tier tapped mid-search is a request to leave the search: the segments are hidden
     under the result count otherwise, and a control that does nothing visible is worse
     than one that is not there. */
  if (searching()){ searchEl.value = ""; query = ""; clearEl.classList.remove("on"); }
  setTier(b.dataset.tier);
};

jumpEl.onclick = e => {
  const b = e.target.closest("[data-go]");
  if (!b) return;
  jumpTo(b.dataset.go);
  /* replaceState rather than assigning the hash: setting it would scroll a second time,
     under the sticky bar, undoing the offset jumpTo() just worked out. */
  history.replaceState(null, "", `#${b.dataset.go.replace(/^ph-/, "")}`);
};
pane.addEventListener("scroll", syncJump, { passive: true });

/* A link can name a section — that is what the hash in the address bar is for. It has to
   pick the tier that section is in first, or it would scroll to nothing. */
if (location.hash){
  const id = location.hash.slice(1);
  const home = sections("", "phrases").find(s => s.groups.some(g => g.group.id === id));
  if (home && home.tier.id !== tier) setTier(home.tier.id);
  jumpTo(`ph-${id}`);
}

bootToolLate();

/* The same handle main.js publishes, for the same reason: a bundled module exposes
   nothing, and CLAUDE.md's browser-driving recipe reaches for this. */
window.trip = {
  jumpTo, setTier, sections, countMatching, openNav, openTools, closeNav,
  PHRASES,
  setQuery(q){ searchEl.value = q == null ? "" : String(q); searchEl.oninput(); return query; },
  get query(){ return query; },
  get tier(){ return tier; },
};
