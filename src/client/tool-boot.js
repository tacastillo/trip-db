import { bootBasemap } from "./basemap.js";
import { applyNight, wireNightToggle } from "./chrome.js";
import { bootNav } from "./nav.js";
import { registerSW } from "./offline.js";
import { armPaletteEgg, bootPalette } from "./palette.js";

/* Everything a tool page does that is about the site rather than about the tool.

   There are two of these pages now — the phrase sheet and the money page — and this is
   the half they share: the palette, night mode, the store, the nav triggers and the
   worker. It was a copy in phrases-boot.js when there was one page to copy it into; a
   second page is where a copy becomes a place for the two to quietly disagree.

   What it deliberately is NOT is main.js. That imports map.js, which needs window.L, and
   four of its modules dereference the map page's own markup as they evaluate — importing
   it on a page with no map takes that page down before it paints. This file imports
   nothing that touches the map.

   Nothing here runs at import time; a page calls bootTool() from its own boot block. */

/** The page chrome, in the order the map page boots it: palette before anything paints,
    so nothing paints in the wrong one. */
export function bootTool(){
  bootPalette();
  bootBasemap();     // no tiles here, but the choice is the site's and the panel shows it
  applyNight();
  /* No city handler is set: a tool page has no map to switch, so nav.js turns a city
     into a link to index.html?city=<id> — which is also the way back to the map. */
  bootNav();
  wireNightToggle();
}

/** And the two things that are deliberately last, after the page is up. */
export function bootToolLate(){
  armPaletteEgg(document.querySelector(".title"));
  registerSW();
}
