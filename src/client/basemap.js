import { night } from "./state.js";
import { save, saved } from "./store.js";

/* Which CARTO base the street tiles come from.

   `light_all` and `dark_all` are Positron and Dark Matter: data-viz backdrops, flattened
   and desaturated on purpose so that something else can be drawn on top of them. That is
   the right basemap for a chart and the wrong one for finding a restaurant, which is why
   the map read as too dim to use in both themes. Voyager is CARTO's general-purpose base
   — parks, water, a real road hierarchy, labels meant to be read.

   Which of them is better here is a question about a street in Seoul at night, not one
   that can be answered from a stylesheet, so it is a choice. It lives in the same panel
   as the palette and behind the same five taps, and it is remembered.

   Changing it changes the tile URL, which is the whole reason the offline pack records
   the style it was downloaded in — see packState() in offline.js. */

export const BASEMAPS = [
  { id:"auto",    label:"Follow the theme", note:"dark at night, light in the sun" },
  { id:"voyager", label:"Voyager",          note:"colour, and roads you can rank" },
  { id:"light",   label:"Light always",     note:"the most legible in sunlight" },
];
export const BASEMAP_IDS = BASEMAPS.map(b => b.id);
export const DEFAULT_BASEMAP = BASEMAP_IDS[0];

export let basemap = DEFAULT_BASEMAP;

/** The CARTO path segment this choice means right now. `auto` is the only one that has
    to ask what theme is on; the other two are answers on their own. */
export function tileStyle(){
  if (basemap === "voyager") return "rastertiles/voyager";
  if (basemap === "light") return "light_all";
  return night ? "dark_all" : "light_all";
}

export function wantedBasemap(search){
  const asked = new URLSearchParams(String(search || "").replace(/^\?/, "")).get("map");
  if (asked && BASEMAP_IDS.includes(asked)) return asked;
  if (BASEMAP_IDS.includes(saved.basemap)) return saved.basemap;
  return DEFAULT_BASEMAP;
}

/* On <html> beside data-palette, so a stylesheet can tune the tile filter per base —
   voyager arrives with its own contrast and wants almost none of the lift the flat
   bases need. */
export function applyBasemap(name){
  basemap = BASEMAP_IDS.includes(name) ? name : DEFAULT_BASEMAP;
  document.documentElement.dataset.map = basemap;
  return basemap;
}

export function bootBasemap(){
  const want = wantedBasemap(location.search);
  applyBasemap(want);
  if (saved.basemap !== want) save({ basemap: want });
  return want;
}
