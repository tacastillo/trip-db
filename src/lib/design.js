/* The one function that turns a category into a colour.

   No module in this repository holds a colour. A category key names its own
   token — `food` is `--cat-food` — so the nine hues live in styles/tokens.css
   with everything else, and the renderers hand the browser a `var()` rather
   than a hex they had to be told. Swapping the palette is then one file, and
   `tools/check-data.mjs` fails if a category has no token to point at.

   Pure, and it has to stay that way: `catVar` is a string, not a colour. What
   the map paints goes through `cssVar()` in client/theme.js, which is the only
   thing on the page that resolves one. */
export const catToken = (cat) => `--cat-${cat}`;
export const catVar = (cat) => `var(${catToken(cat)})`;

/* HTML-escaping, here rather than in a renderer because three of them need it and the
   fence around src/lib is what keeps it testable: it is string arithmetic, not DOM. */
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g,
  c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
