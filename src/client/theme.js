/* Reading a token back out of the page.

   Leaflet paints on a canvas, so a polyline cannot be styled by a stylesheet — the
   colour has to be handed to it as a string. Everything the map draws still comes from
   styles/tokens.css rather than from a literal in here, which is what keeps night mode
   one block of CSS: this is the door between the two.

   Its own module rather than a helper in route.js: map.js and route.js already import
   each other, and the rail is drawn on boot, well before any route exists. A token read
   through that cycle would be one more thing that has to survive module evaluation
   order — this has no imports at all and cannot. */
export function cssVar(v){
  return getComputedStyle(document.body).getPropertyValue(v).trim() || "#A56F63";
}
