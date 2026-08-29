/* What sits under "Tools" in the one menu, beside the three cities.

   The cheat sheet is not a fourth leg, and the first cut of it pretended to be one — a
   pill at the end of Seoul · Jeju · Busan, reading as a place you might go. It is a
   different kind of thing, so it gets its own heading and the row gets its own list.

   `page` is a file in src/pages/, because build.format is "file" and a page there is
   that .html at the root of the site. check-data.mjs checks that each one exists and is
   precached, so a tool cannot point at a page that is not there or that would not work
   offline. */
export const TOOLS = [
  { id:"phrases", page:"phrases.html", label:"Korean cheat sheet",
    note:"say it like it's spelled", icon:"phrase" },
];
