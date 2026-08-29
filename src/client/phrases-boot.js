import { NUMBERS, PHRASES, PRICE_PRESETS } from "../data/phrases.js";
import { countMatching, sayParts, sections } from "../lib/phrases.js";
import { wonReading } from "../lib/won.js";
import { bootBasemap } from "./basemap.js";
import { registerSW } from "./offline.js";
import { armPaletteEgg, bootPalette } from "./palette.js";
import { night, setNight } from "./state.js";
import { save } from "./store.js";
import { setToolBtn } from "./toolbtn.js";

/* The whole of the cheat sheet page.

   It is a separate entry from main.js on purpose and must stay one: main.js imports
   map.js, which needs window.L, and four of its modules dereference the map page's own
   markup as they evaluate (view.js, tabs.js, list.js, plan-boot.js). Importing it here
   would take this page down before it painted.

   What it does share is everything that is about the site rather than about the map —
   the palette, night mode, the store and the worker — so the two pages agree about what
   they look like and this one works offline for free. */

const pane = document.getElementById("phpage");
const listEl = document.getElementById("phlist");
const jumpEl = document.getElementById("phjump");
const barEl = document.querySelector(".phbar");
const searchEl = document.getElementById("phsearch");
const clearEl = document.getElementById("phsearchClear");
const countEl = document.getElementById("phcount");

export let query = "";

/* ---------------- night ---------------- */

/* A four-line copy of applyNight() rather than an import: main.js owns that one and
   importing it would drag Leaflet and the whole map onto a page with neither. The body
   ships class="night" so the first paint is never a white flash; if this browser
   remembered otherwise, that is undone here rather than in the markup. */
const nightBtn = document.getElementById("nightToggle");
function applyNight(){
  document.body.classList.toggle("night", night);
  setToolBtn(nightBtn, night ? "day" : "night", night ? "Day" : "Night");
}

/* ---------------- rendering ---------------- */

/* The stress marks become spans here and nowhere else. lib/phrases.js does the parsing
   so a test can see it; this only paints, and the colour is the stylesheet's. */
const sayHtml = (say) => sayParts(say)
  .map(p => p.stress ? `<span class="ph-st">${p.text}</span>` : p.text).join("");

const rowHtml = (p) => `<div class="phrow" data-id="${p.id}">
  <div class="ph-en">${p.en}</div>
  <div class="ph-say">${sayHtml(p.say)}</div>
  <div class="ph-rom">${p.rom}</div>
</div>`;

/* What a counter says back, behind one control. Rendered only where a group has any —
   an empty "0 replies" toggle is a control asking to be explained, the same argument
   that keeps the been-there chip off the map page's first morning. */
const hearHtml = (rows, gid) => !rows.length ? "" : `<div class="phhear" data-hear="${gid}">
  <button class="phhear-t" type="button" aria-expanded="false">What they'll say back<span class="ct">${rows.length}</span></button>
  <div class="phhear-b">${rows.map(rowHtml).join("")}</div>
</div>`;

/* The two things in the Money group that are not phrases. The reader is the point: a
   price is regrouped into 만 before it is said, and that arithmetic is what stalls you
   at a counter — see lib/won.js. The table under it is what the reader is made of. */
const wonHtml = () => `<div class="phwon">
  <div class="phwon-l">Say a price</div>
  <div class="phwon-f">
    <input class="phwon-in" id="phwon" type="text" inputmode="numeric" autocomplete="off"
      placeholder="8900" aria-label="A price in won" />
    <span class="phwon-u">won</span>
  </div>
  <div class="phwon-p">${PRICE_PRESETS
    .map(n => `<button class="phchip" type="button" data-won="${n}">${n.toLocaleString("en-US")}</button>`).join("")}</div>
  <div class="phwon-out empty" id="phwonOut">
    <div class="phwon-bad">Not a price — whole won only.</div>
    <div class="ph-say" id="phwonSay"></div>
    <div class="ph-rom" id="phwonRom"></div>
  </div>
</div>`;

const numsHtml = () => `<div class="phnums">
  <div class="phnum h"><span></span><span>Sino — money, time</span><span>Native — people</span></div>
  ${NUMBERS.map(x => `<div class="phnum">
    <span class="phnum-n">${x.n.toLocaleString("en-US")}</span>
    <span class="phnum-s">${x.sino}<em>${sayHtml(x.sinoSay)}</em></span>
    <span class="phnum-e">${x.nat ? `${x.nat}<em>${sayHtml(x.natSay)}</em>` : "—"}</span>
  </div>`).join("")}
</div>`;

function render(){
  const secs = sections(query);
  if (!secs.length){
    listEl.innerHTML = `<div class="phnone">Nothing matches <b>${query}</b>.<br>Papago is the backup for anything this sheet does not carry.</div>`;
    jumpEl.innerHTML = "";
  } else {
    listEl.innerHTML = secs.map(s => `<div class="phtier">
      <div class="phtier-h">${s.tier.label}</div>
      <div class="phtier-n">${s.tier.note}</div>
    </div>` + s.groups.map(g => `<div class="phgroup" id="ph-${g.group.id}">
      <div class="phgroup-h">${g.group.label}</div>
      ${g.group.id === "money" && !query ? wonHtml() : ""}
      ${g.say.map(rowHtml).join("")}
      ${hearHtml(g.hear, g.group.id)}
      ${g.group.id === "money" && !query ? numsHtml() : ""}
    </div>`).join("")).join("");
    /* The jump bar empties in step with the list: a chip that scrolls to a section the
       search has removed is a control that lies. */
    jumpEl.innerHTML = secs.flatMap(s => s.groups)
      .map(g => `<button class="phchip" type="button" data-go="ph-${g.group.id}">${g.group.label}<span class="ct">${g.say.length + g.hear.length}</span></button>`).join("");
  }
  const n = countMatching(query);
  countEl.hidden = !query;
  countEl.innerHTML = `<b>${n}</b> of ${PHRASES.length} ${n === 1 ? "phrase" : "phrases"}`;
  wireList();
  syncJump();
}

/* ---------------- what the rendered rows do ---------------- */

function wireList(){
  listEl.querySelectorAll(".phhear-t").forEach(b => {
    b.onclick = () => {
      const box = b.closest(".phhear");
      const on = box.classList.toggle("on");
      b.setAttribute("aria-expanded", String(on));
    };
  });
  const input = document.getElementById("phwon");
  if (input){
    input.oninput = () => showPrice(input.value);
    listEl.querySelectorAll("[data-won]").forEach(b => {
      b.onclick = () => { input.value = b.dataset.won; showPrice(input.value); };
    });
  }
}

export function showPrice(v){
  const out = document.getElementById("phwonOut");
  if (!out) return null;
  const raw = String(v || "").trim();
  const said = raw ? wonReading(raw) : null;
  /* Three states, not two. Nothing typed says nothing, because an empty field is not a
     mistake; a number it cannot read has to say so out loud, or the last good reading
     would sit there looking like the answer to what you just typed. */
  out.classList.toggle("empty", !raw);
  out.classList.toggle("bad", !!raw && !said);
  document.getElementById("phwonSay").innerHTML = said ? sayHtml(said.say) : "";
  document.getElementById("phwonRom").textContent = said ? said.rom : "";
  return said;
}

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
bootPalette();       // before anything paints, so nothing paints in the wrong palette
bootBasemap();       // no tiles here, but the choice is the site's and the panel shows it
applyNight();
render();

if (nightBtn) nightBtn.onclick = () => {
  setNight(!night);
  save({ night });
  applyNight();
};

searchEl.oninput = () => {
  query = searchEl.value;
  clearEl.classList.toggle("on", !!query.trim());
  render();
};
searchEl.onkeydown = e => {
  if (e.key === "Escape" && searchEl.value){ e.stopPropagation(); searchEl.value = ""; searchEl.oninput(); }
};
clearEl.onclick = () => { searchEl.value = ""; searchEl.oninput(); searchEl.focus(); };

jumpEl.onclick = e => {
  const b = e.target.closest("[data-go]");
  if (!b) return;
  jumpTo(b.dataset.go);
  /* replaceState rather than assigning the hash: setting it would scroll a second time,
     under the sticky bar, undoing the offset jumpTo() just worked out. */
  history.replaceState(null, "", `#${b.dataset.go.replace(/^ph-/, "")}`);
};
pane.addEventListener("scroll", syncJump, { passive: true });

/* A link can name a section — that is what the hash in the address bar is for. */
if (location.hash) jumpTo(`ph-${location.hash.slice(1)}`);

/* Last, and deliberately after the page is up. */
armPaletteEgg(document.querySelector(".title"));
registerSW();

/* The same handle main.js publishes, for the same reason: a bundled module exposes
   nothing, and CLAUDE.md's browser-driving recipe reaches for this. */
window.trip = {
  jumpTo, showPrice, wonReading, sections, countMatching,
  PHRASES, NUMBERS,
  setQuery(q){ searchEl.value = q == null ? "" : String(q); searchEl.oninput(); return query; },
  get query(){ return query; },
};
