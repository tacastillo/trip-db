import { save, saved } from "./store.js";

/* Which palette the page is wearing.

   This is scaffolding, not a feature. Four palettes are declared in
   styles/tokens.css and picking between them from a swatch site kept failing, because
   colours on colorhunt.co are not colours on a map at 390px at night. So they are
   switched here instead, tried on the real page, and when one wins the losers get
   deleted and so does this module.

   Deliberately not a button. Header room is the scarcest thing on the page — see
   "Mobile first" in CLAUDE.md — and four toggles already live there. `?palette=ember`
   is enough for something only ever used while deciding.

   The link wins over the store, which is the rule the day plan already follows, and
   the choice is then remembered so a palette can be lived with for a day rather than
   glanced at. An unknown name falls back rather than leaving the page unstyled. */

export const PALETTES = ["charcoal", "ember", "ice", "origin"];
export const DEFAULT_PALETTE = PALETTES[0];

export let palette = DEFAULT_PALETTE;

/** What the URL asks for, then what this browser remembers, then the default. */
export function wantedPalette(search){
  const asked = new URLSearchParams(String(search || "").replace(/^\?/, "")).get("palette");
  if (asked && PALETTES.includes(asked)) return asked;
  if (PALETTES.includes(saved.palette)) return saved.palette;
  return DEFAULT_PALETTE;
}

/* On <html> rather than <body> so the tokens are in scope for everything, including
   the two rules that hang off body.night. */
export function applyPalette(name){
  palette = PALETTES.includes(name) ? name : DEFAULT_PALETTE;
  document.documentElement.dataset.palette = palette;
  return palette;
}

export function bootPalette(){
  const want = wantedPalette(location.search);
  applyPalette(want);
  /* Only written when it is not already what is stored: this runs on every load, and
     the store is debounced but not free. */
  if (saved.palette !== want) save({ palette: want });
  return want;
}
