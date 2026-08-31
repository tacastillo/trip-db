/* What sits under "Tools" in the nav menu — the pages of this site that are not the map.

   There are two of these now and the split is the point. The first cut had one "Korean
   cheat sheet" row, and one page behind it that was a phrase list, a price reader and a
   numbers table stacked in a single four-thousand-pixel scroll. That is not one tool. A
   thing you open at a counter to work out what ₩68,000 is in real money has nothing to
   do with a thing you open to find out how to ask for the bill, and putting them on one
   page meant scrolling past one to reach the other, every time, on a phone, in a queue.

   `page` is a file in src/pages/, because build.format is "file" and a page there is
   that .html at the root of the site. check-data.mjs checks that each one exists and is
   precached, so a tool cannot point at a page that is not there or that would not work
   offline — and that every phrase tier names one of these as its page.

   `id` doubles as the page key on TIERS in src/data/phrases.js. "map" is not in this
   table: it is the map, it is where the cities live, and nav.js draws its row itself. */
export const TOOLS = [
  { id:"phrases", page:"phrases.html", label:"Korean phrases", short:"Phrases",
    note:"what to say, and the words in between", icon:"phrase" },
  { id:"money",   page:"money.html",   label:"Money", short:"Money",
    note:"won in real money, and how to say it", icon:"shopping" },
];
