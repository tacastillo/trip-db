import { BASEMAPS, applyBasemap, basemap } from "./basemap.js";
import { icon } from "../lib/icons.js";
import { save, saved } from "./store.js";

/* Which palette the page is wearing, and the way in to changing it.

   Five palettes are declared in styles/tokens.css. Picking between them off a swatch
   site kept failing — colours on colorhunt.co are not colours on a map at 390px at
   night — so they stayed, and the choice is made on the real page instead.

   There is no button. Header room is the scarcest thing here (see "Mobile first" in
   CLAUDE.md), and a control for something you touch twice a fortnight does not deserve
   a permanent 44px of it. So it is hidden where only the person whose trip this is
   would think to press: tap the title five times. `?palette=<name>` still works, and is
   the way a script or a link gets at it.

   The choice is remembered — the whole point is living with one for a day rather than
   glancing at it. A link beats the store, the rule the day plan already follows. */

export const PALETTES = [
  { id:"glacier",  label:"Glacier",    note:"warm olive ink, soft cold accent" },
  { id:"charcoal", label:"Chartreuse", note:"neutral charcoal, acid yellow-green" },
  { id:"ember",    label:"Ember",      note:"neutral charcoal, hot vermilion" },
  { id:"ice",      label:"Ice",        note:"neutral charcoal, cyan at full chroma" },
  { id:"origin",   label:"Origin",     note:"the palette this map started with" },
];
export const PALETTE_IDS = PALETTES.map(p => p.id);
export const DEFAULT_PALETTE = PALETTE_IDS[0];

export let palette = DEFAULT_PALETTE;

/** What the URL asks for, then what this browser remembers, then the default. */
export function wantedPalette(search){
  const asked = new URLSearchParams(String(search || "").replace(/^\?/, "")).get("palette");
  if (asked && PALETTE_IDS.includes(asked)) return asked;
  if (PALETTE_IDS.includes(saved.palette)) return saved.palette;
  return DEFAULT_PALETTE;
}

/* On <html> rather than <body> so the tokens are in scope for everything, including the
   rules that hang off body.night. */
export function applyPalette(name){
  palette = PALETTE_IDS.includes(name) ? name : DEFAULT_PALETTE;
  document.documentElement.dataset.palette = palette;
  syncPaletteEgg();
  return palette;
}

export function bootPalette(){
  const want = wantedPalette(location.search);
  applyPalette(want);
  /* only written when it is not already what is stored: this runs on every load */
  if (saved.palette !== want) save({ palette: want });
  return want;
}

/* ---------------- the easter egg ---------------- */

const TAPS_TO_OPEN = 5;
const TAP_WINDOW_MS = 1200;   // long enough for a thumb, short enough to be deliberate

let taps = 0, lastTap = 0, panel = null;

/** Five taps on the title, each within a second or so of the last. A slow fifth tap
    starts the count over rather than opening something nobody asked for. */
export function armPaletteEgg(el){
  if (!el) return;
  el.addEventListener("click", () => {
    const now = Date.now();
    taps = now - lastTap > TAP_WINDOW_MS ? 1 : taps + 1;
    lastTap = now;
    if (taps >= TAPS_TO_OPEN){ taps = 0; openPalettePanel(); }
  });
}

/* Each row carries its own `data-palette`, which is what makes the swatches honest:
   `[data-palette="ember"]` sets --pal-* on any element, not just <html>, so a swatch
   painted in var(--pal-accent) inside that row is that palette's actual accent. No
   colour is named in here, which is the rule everywhere else too. */
function panelHtml(){
  const rows = PALETTES.map(p => `
    <button class="pal-row" data-pal="${p.id}" data-palette="${p.id}" role="option" aria-selected="false">
      <span class="pal-sw" aria-hidden="true">
        <i style="background:var(--pal-ground)"></i><i style="background:var(--pal-accent)"></i><i style="background:var(--pal-ok)"></i><i style="background:var(--pal-warn)"></i>
      </span>
      <span class="pal-txt"><b>${p.label}</b><em>${p.note}</em></span>
      <span class="pal-tick">${icon("check")}</span>
    </button>`).join("");
  /* The second half of the same question. CARTO's flat bases are data-viz backdrops and
     read as too dim to navigate by; whether colour fixes that is a question about a
     street at night, so it is asked here rather than settled in a stylesheet. */
  const maps = BASEMAPS.map(m => `
    <button class="pal-row" data-map-pick="${m.id}" role="option" aria-selected="false">
      <span class="pal-txt"><b>${m.label}</b><em>${m.note}</em></span>
      <span class="pal-tick">${icon("check")}</span>
    </button>`).join("");
  return `<div class="pal-head">
      <div><b>The look</b><span>tap the title five times to get back here</span></div>
      <button class="pal-x" id="palClose" title="Close" aria-label="Close">${icon("close")}</button>
    </div>
    <div class="pal-sec">Palette</div>
    <div class="pal-list" role="listbox" aria-label="Palette">${rows}</div>
    <div class="pal-sec">Street map</div>
    <div class="pal-list" role="listbox" aria-label="Street map">${maps}</div>`;
}

export function openPalettePanel(){
  if (panel) { closePalettePanel(); return; }
  panel = document.createElement("div");
  panel.className = "pal-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Palette");
  panel.innerHTML = panelHtml();
  document.body.appendChild(panel);
  /* applied on tap rather than on an OK button: the whole point is seeing it on the
     page you are actually looking at */
  panel.querySelectorAll("[data-pal]").forEach(b => b.addEventListener("click", () => {
    setPaletteFromPanel(b.dataset.pal);
  }));
  panel.querySelectorAll("[data-map-pick]").forEach(b => b.addEventListener("click", () => {
    setBasemapFromPanel(b.dataset.mapPick);
  }));
  panel.querySelector("#palClose").onclick = closePalettePanel;
  document.addEventListener("keydown", onEggKey);
  requestAnimationFrame(() => panel && panel.classList.add("on"));
  syncPaletteEgg();
}

export function closePalettePanel(){
  if (!panel) return;
  document.removeEventListener("keydown", onEggKey);
  panel.remove();
  panel = null;
}

function onEggKey(e){ if (e.key === "Escape"){ e.stopPropagation(); closePalettePanel(); } }

/* Which row is on. Called after every apply, and on open, so the panel cannot disagree
   with the page it is sitting on. */
export function syncPaletteEgg(){
  if (!panel) return;
  const mark = (nodes, is) => nodes.forEach(b => {
    const on = is(b);
    b.classList.toggle("on", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  mark(panel.querySelectorAll("[data-pal]"), b => b.dataset.pal === palette);
  mark(panel.querySelectorAll("[data-map-pick]"), b => b.dataset.mapPick === basemap);
}

/* Set by main.js, which owns the redraw: the map paints from tokens through cssVar(),
   so what is already drawn has to be drawn again. This module cannot reach for map.js
   without a cycle, and boot order is not something to gamble on — see CLAUDE.md. */
let onPick = applyPalette;
export const setPaletteHandler = (fn) => { onPick = fn; };
function setPaletteFromPanel(id){ onPick(id); }

/* Same again for the base. Changing it rebuilds the tile layer, and the offline button
   has to be asked again — a pack downloaded in another style cannot be served. */
let onPickMap = applyBasemap;
export const setBasemapHandler = (fn) => { onPickMap = fn; };
function setBasemapFromPanel(id){ onPickMap(id); }
