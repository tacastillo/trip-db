/* Reading a token back out of the page.

   Leaflet paints on a canvas, so a polyline cannot be styled by a stylesheet — the
   colour has to be handed to it as a string. Everything the map draws still comes from
   styles/tokens.css rather than a literal in here, which is what keeps a palette swap
   to one file: this is the door between the two, and the only thing on the page that
   resolves a token.

   It resolves rather than reads, and that matters. A custom property's computed value
   is its text, not a colour: --accent comes back as "color-mix(in srgb, ...)" now that
   the palette derives its tints, and a canvas handed that string may or may not take
   it. Assigning it to a real element's `color` makes the browser do the arithmetic and
   hands back an rgb() every canvas understands. An unparseable value leaves `color`
   untouched, which is how a bad token name is caught rather than silently painted.

   Its own module rather than a helper in route.js: map.js and route.js already import
   each other, and the rail is drawn on boot, well before any route exists. A token read
   through that cycle would be one more thing that has to survive module evaluation
   order — this has no imports at all and cannot. */

/* A token that does not exist falls back to the page's own text colour rather than to a
   hex written down here — there is no colour in this file, or in any file but
   tokens.css, and a missing name should still draw something visible on the map. */
const fallback = () => getComputedStyle(document.body).color;

let probe = null;
export function cssVar(name){
  const raw = getComputedStyle(document.body).getPropertyValue(name).trim();
  if (!raw) return fallback();
  if (!probe){
    probe = document.createElement("span");
    probe.setAttribute("aria-hidden", "true");
    probe.style.display = "none";
  }
  /* on the body, so the mix resolves against whatever theme is on right now */
  document.body.appendChild(probe);
  probe.style.color = "";
  probe.style.color = raw;
  const resolved = probe.style.color ? getComputedStyle(probe).color : "";
  probe.remove();
  return resolved || fallback();
}
