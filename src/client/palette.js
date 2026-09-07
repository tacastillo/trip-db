import { BASEMAPS, applyBasemap, basemap } from "./basemap.js";
import { openSheet, syncSheet } from "./sheet.js";
import { optionSetting } from "./setting.js";

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

/* applyPalette also re-ticks the panel, if one is open: the whole point of picking off
   that list is watching the page change underneath it. */
const setting = optionSetting({ ids: PALETTE_IDS, param:"palette", attr:"palette", key:"palette",
                                onApply: (v) => { palette = v; syncPaletteEgg(); } });
export const wantedPalette = setting.wanted;
export const applyPalette = setting.apply;
export const bootPalette = setting.boot;

/* ---------------- the easter egg ---------------- */

const TAPS_TO_OPEN = 5;
const TAP_WINDOW_MS = 1200;   // long enough for a thumb, short enough to be deliberate

let taps = 0, lastTap = 0, eggEl = null;

/** Five taps on the title, each within a second or so of the last. A slow fifth tap
    starts the count over rather than opening something nobody asked for. */
export function armPaletteEgg(el){
  if (!el) return;
  eggEl = el;
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
const SWATCH = `<span class="pal-sw" aria-hidden="true">`
  + `<i style="background:var(--pal-ground)"></i><i style="background:var(--pal-accent)"></i>`
  + `<i style="background:var(--pal-ok)"></i><i style="background:var(--pal-warn)"></i></span>`;

/** The look panel: a side sheet rather than a modal over the middle, because the whole
    point is judging a palette against the map, the pins and an open card. */
export function openPalettePanel(){
  openSheet({
    key: "look", label: "Palette", className: "pal-panel",
    /* not for placement — so that the sixth tap on the title closes the panel once
       rather than closing and reopening it */
    anchor: eggEl, place: "side",
    head: { title:"The look", hint:"tap the title five times to get back here", close:true },
    sections: [
      { title:"Palette", label:"Palette", key:"pal", closeOnPick:false,
        rows: PALETTES.map(p => ({ value:p.id, label:p.label, note:p.note,
                                   lead:SWATCH, attrs:{ "data-palette":p.id } })),
        selected: () => palette,
        /* applied on tap rather than on an OK button: the whole point is seeing it on
           the page you are actually looking at */
        onPick: (id) => onPick(id) },
      /* The second half of the same question. CARTO's flat bases are data-viz backdrops
         and read as too dim to navigate by; whether colour fixes that is a question
         about a street at night, so it is asked here rather than settled in CSS. */
      { title:"Street map", label:"Street map", key:"map-pick", closeOnPick:false,
        rows: BASEMAPS.map(m => ({ value:m.id, label:m.label, note:m.note })),
        selected: () => basemap,
        onPick: (id) => onPickMap(id) },
    ],
  });
}

/** Which row is on. Called after every apply, so the panel cannot disagree with the page
    it is sitting on — and a no-op when there is no panel, which is every load. */
export const syncPaletteEgg = () => syncSheet();

/* Set by main.js, which owns the redraw: the map paints from tokens through cssVar(),
   so what is already drawn has to be drawn again. This module cannot reach for map.js
   without a cycle, and boot order is not something to gamble on — see CLAUDE.md. */
let onPick = applyPalette;
export const setPaletteHandler = (fn) => { onPick = fn; };

/* Same again for the base. Changing it rebuilds the tile layer, and the offline button
   has to be asked again — a pack downloaded in another style cannot be served. */
let onPickMap = applyBasemap;
export const setBasemapHandler = (fn) => { onPickMap = fn; };
