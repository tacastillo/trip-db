# Working on trip-db

A field map for one trip to Korea: Seoul, Jeju, Busan. It is an [Astro][] site with
no framework and no islands: `.astro` files carry the markup, plain CSS carries the
look, and the behaviour is a handful of ES modules under `src/client/`. GitHub
Actions builds it on every push to `main` and hands the output to GitHub Pages.

[Astro]: https://astro.build

## Mobile first. Not mobile too.

**This map is used on a phone, in a street, in Korea.** The desktop is where it gets
edited; the phone is where it gets used, and every call goes to the phone. That is the
first question about any change — what does this do at 390px, with a thumb, one-handed,
in sunlight — and it is asked before the change is designed, not after it is built.

What that means in practice:

- **Drive the phone viewport first.** `devices["Pixel 7"]` and a 390px context, before
  the 1280px one. Two defects shipped in the first cut of the offline/geolocation work
  because they were only ever looked at on a desktop: four labelled toggles pushed the
  title onto a second line, and the card's `max-height` sliced the Kakao and taxi buttons
  in half. Both were invisible at 1280px and obvious at 390px.
- **Every target is 44px.** The grab strip, the add button, the been-there tick, a day
  chip, a Naver button. If a new control cannot be 44px, it is the wrong control — that
  is what removed the up/down arrows from the plan rows.
- **Header room is the scarcest thing on the page.** Anything that lands in `.toolbtns`
  is an icon on a phone and a label on a desktop, through `client/toolbtn.js`. Four
  labelled buttons do not fit next to the title, and the title is what tells you what
  you are looking at.
- **The thing you tap gets the room.** The card can take 60% of the screen, because on a
  phone the card is the page; the map keeps the rest. A button sliced by the edge of its
  own container reads as broken, not as "scroll for more".
- **One media query, still.** 780px in `styles/mobile.css`, and the map and list swap
  rather than stack. The base sheet is desktop-shaped for historical reasons and that is
  not worth unpicking — but the phone block is where the argument is settled, so write
  the phone rule first and let the desktop keep the leftovers.

## The shape of it

```
.github/workflows/      the checks, the build and the Pages deploy
astro.config.mjs        base:'/trip-db/'; output goes to dist/, which is gitignored
public/                 copied verbatim: vendor/ (Leaflet, fonts), sw.js, the manifest, .nojekyll
src/
  pages/index.astro     the one page; there is no router and no second page
  layouts/FieldMap.astro  <head>, the @font-face block, leaflet's css and js
  components/           SiteHeader · Sidebar · MapPane · PlanUrlSpec · TripData
  styles/               plain global CSS, imported in cascade order by the layout
  data/                 the trip and the vendored OSM geometry
  lib/                  pure: no DOM, no Leaflet, no page state — node imports this
  client/               everything that touches the page
tools/                  maintenance scripts; not part of the build
```

**There is a build step, and it runs in CI.** No build output is committed — pushing to
`main` is the deploy, and `.github/workflows/deploy.yml` runs the three checks and the
build before it publishes anything. Still build locally before you push: CI tells you
it broke, which is slower than being told now. Two things follow from the bundler that
did not use to be true: the page no longer opens from `file://` (bundled ES modules
need a real origin — serve it), and nothing is a global any more (see *Driving the
page* below).

## src/client — who owns what

| Module | What lives there |
| --- | --- |
| `state.js` | `active`, `currentTab`, `night`, `railOn`, and Leaflet's `map` |
| `theme.js` | `cssVar`, the one door from `styles/tokens.css` to what Leaflet paints |
| `store.js` | the one localStorage key, and the only place that touches it |
| `visited.js` | been-there ticks and the filter that hides them |
| `geo-me.js` | the blue dot, live distances, "nearest first" |
| `offline.js` | registering the worker, downloading a leg's tile pack |
| `view.js` | the mobile map/list switch, `isMobile` |
| `legend.js` `list.js` `card.js` | the sidebar's three renderers |
| `map.js` | `initMap`, `drawRail`, `syncMarkers`, `fitCity`, the Leaflet layers |
| `route.js` | drawing and animating the ride, the station labels |
| `selection.js` | `select`, `deselect`, `focus`, `selectedId` |
| `plan-state.js` `plan-pane.js` `plan-drag.js` `plan-map.js` `plan-boot.js` | the day plan |
| `tabs.js` `rail-legend.js` | the leg tabs and the subway key |
| `main.js` | the boot sequence, the four toggle buttons, `window.trip` |

Shared mutable state is an `export let` read elsewhere as a live binding, which is
why almost every read is still a bare name. A value only gets a setter when a module
other than its owner writes it — `setCurrentTab`, `setNight`, `setPlan` and a few more.

**Nothing may run at import time that reaches into another module.** Module evaluation
order is not source order: a top-level call across a cycle lands in the temporal dead
zone and takes the whole page down. Boot code goes in `main.js`, at the bottom, in order.

## Which data is generated and which is yours

| Constant | File | Source | Edit by hand? |
| --- | --- | --- | --- |
| `PLACES`, `CLUSTERS`, `CATS`, `CAT_ORDER`, `LEGS`, `TRIP` | `data/places.js` | you | yes — this is the trip |
| `ko`, `hours`, `closed`, `signature` on a place | `data/places.js` | the trip's Notion database | yes, but it will drift from the source |
| `PLACE_OFF`, `ROUTES` | `data/routing.js` | you | yes — they are the routing overrides |
| `STATION_COORDS` | `data/routing.js` | OSM, via `tools/fetch-stations.mjs` | names yes, coordinates no |
| `SUBWAY`, `SUBWAY_BUSAN` | `data/subway*.js` | OSM, via `tools/fetch-rail.mjs` | no — regenerate instead |
| `ICONS` | `data/icons.js` | Streamline, via `tools/fetch-icons.mjs` | no — regenerate instead |

Station **names are keys**. `ROUTES` is keyed by them and `PLACE_OFF` points at them,
so renaming one silently breaks a route. `fetch-stations.mjs` never renames for that
reason; it reports what it could not match and leaves it alone.

## Icons, and why they are not emoji

Every mark on this page is a [Streamline][] icon in the regular weight, drawn inline from
`src/data/icons.js` by the one function in `src/lib/icons.js`. Emoji were the wrong
alphabet for a field map: the same category is a different drawing on Android, on iOS and
on a Samsung phone, half of them are pictures of American food, and none of them can take
the colour of the thing they sit in — a category pin had a beige croissant on it whatever
the pin was coloured.

[Streamline]: https://www.streamlinehq.com/icons/streamline-regular

Three rules hold the set together, and `tools/fetch-icons.mjs` enforces the first two:

- **The regular weight, on the 14x14 grid.** A `-solid` or `-remix` sibling is a
  different drawing at a different weight, and the older icons in the set sit on a
  different grid — either one puts a second stroke width on the page. The generator
  refuses both rather than trusting a name.
- **Only what is used.** The set has 3,900 icons; twenty-five are copied into
  `src/data/icons.js`, the same way Leaflet and the fonts are vendored. Nothing is
  fetched at runtime and there is no icon font to load.
- **`currentColor` and `1em`, always.** An icon takes the colour and the size of whatever
  it sits in, so a legend chip, a white-on-clay pin and a night-mode button all work with
  no rule of their own. `.ic` in `tokens.css` is the whole stylesheet for them.

To change one, edit the `STREAMLINE` table in `tools/fetch-icons.mjs` — page name on the
left, the set's own name on the right — and re-run it. `check-data.mjs` fails if a
category names an icon that run never wrote. The set is CC BY 4.0; the attribution is in
the generated file's header, which is why that header is not noise.

One emoji survives, on purpose: `CATS[cat].emoji`, which `planShareText()` uses when a
day is copied out as a message. A message pasted into KakaoTalk cannot carry an SVG.

## One place for the look

`src/styles/tokens.css` is the whole design system, in seven numbered blocks, and it is
the only file in `src/styles/` or `src/client/` allowed to write a colour, a shadow, an
icon size or a tap target. Everything else names a token. That is not a style preference:
it is what makes swapping the palette one edit instead of a hunt through eight
stylesheets and a dozen modules, and it is checked rather than hoped for.

**Four hexes, and everything else derived.** Block 1 holds the palette — `--bark`,
`--cocoa`, `--khaki`, `--cream` — and blocks 2 and 3 build the day and the night out of
them with `color-mix()`, using plain white and black only as tint agents. Change those
four lines and the page changes. Night is the same four with the roles swapped, which is
why it is one block and not an override scattered through six sheets.

Two colours are deliberately not derived. `--ok` (a walk saved, a spot ticked off) and
`--warn` (shut today, pick a date) have to read as a different *kind* of thing at a
glance, and a fifth tone of brown cannot do that. `--me` is a third: the dot that says
where you are is every other map app's blue on purpose.

**A category names its own colour.** `--cat-food` is the colour of the `food` category,
and `catVar()` in `src/lib/design.js` is the only thing that builds that name. `CATS` in
`data/places.js` holds no colour at all, so a renderer hands the browser a `var()` rather
than a hex it had to be told, and the nine hues sit in block 4 with everything else.
`check-data.mjs` fails if a category has no token to point at.

**What is a token and what is just a number.** Colours, shadows, icon sizes and the 44px
tap target, because each of those was an argument that should be settled once. Not every
measurement — a padding is a padding, and hoisting all of them would make one file that
means nothing rather than one file that means something. Type sizes are still literals in
the sheets; that is the obvious next thing to hoist, and it has not been done.

**Three ways out of the file.** The stylesheets read tokens by name. The map reads them
through `cssVar()` in `client/theme.js`, which *resolves* rather than reads — a custom
property's computed value is its text, so `--accent` comes back as a `color-mix(...)`
string, and handing that to a canvas is not the same as handing it a colour. And four
things cannot read CSS at all: the two `<meta name="theme-color">` tags, the manifest and
`public/icon.svg`. Those are pinned to `--paper` by `check-data.mjs`, because all four of
them had silently kept a palette the page stopped using two palettes ago.

## Adding a place

Append to `PLACES` in `src/data/places.js`:

```js
{ id:"shortid", city:"seoul", cluster:"Jongno · palaces & Ikseon-dong",
  cat:"food", lat:37.5745, lng:126.9885, name:"Name", note:"One line.",
  meta:"Optional red line under the note" },
```

Then `node tools/check-data.mjs`. Things it will catch that the page will not:

- `cluster` must already exist in `CLUSTERS[city]`. If it does not, the pin
  still lands on the map but the sidebar row never renders and the counts are
  wrong — no error anywhere.
- `cat` must be a key in `CATS`, and `city` a `LEGS` id.
- `id` must be unique; a duplicate quietly shadows the earlier one.

A new Seoul spot usually needs nothing else — see below.

## How a ride is worked out

When you pick a spot, the page builds the journey from the hotel:

1. **Which station you get off at** — `offStationFor()` in `lib/journey.js`.
   `PLACE_OFF[id]` wins if it is set. Otherwise it takes the nearest station that has
   a `ROUTES` entry, provided the walk is under `AUTO_WALK_MAX` (1100m, sized to the
   longest hand-set walk). Hotels get nothing; that is where the ride starts.
2. **Which lines to take** — `ROUTES[station]`, a list of `{line, to}`. The last
   `to` is where you get off, earlier ones are transfers.
3. **The shape of the track** — traced, never stored. `railGraph()` in `lib/rail.js`
   turns the line's polylines into a graph, `ride()` runs Dijkstra between the two
   stations, and the walk is a straight line to the door.

So adding a Seoul spot near an existing station needs no table edit. Add
`PLACE_OFF[id]` only when the nearest station is not the one you would really use.
Add to `ROUTES` and `STATION_COORDS` when a station is genuinely new.

Only Seoul draws rides. Busan has line geometry but no station table behind it;
Jeju has no metro. Both are handled, not broken: the card opens, no ride draws.

## How a day plan is carried

A plan is a list of place ids in the query string — no server, and nothing about it that
a link cannot carry:

```
index.html?city=seoul&day=2026-09-01&stops=novotel,gyeongbok,bukchon&title=Jongno
```

That grammar is a deliberate choice, not a shortcut. Someone can read the day off the
link, and so can an agent that fetches the deployed URL and cannot run the script.
`build.format` is `"file"` so `index.html` stays a real file at the root of the site
and every link ever shared keeps resolving.

Two JSON blocks in the page serve that reader: `#plan-url-spec` says how to decode the
query string, and `#trip-data` publishes `PLACES` and the category table so the ids can
be resolved without running anything. The second exists **because** the script is
bundled now — when the page was one file the data was simply there to read, and losing
that quietly would have broken shared links for everyone but a browser.
`check-data.mjs` fails if the spec drifts from `PLAN_PARAMS`.

Rotted links degrade rather than break. An id the map no longer has is **kept**, shown
as its own row and flagged — dropping it would quietly amputate a stop from a link
someone else shared. Unknown query params ride along untouched.

**A link beats the store, always.** The browser remembers the day you were last building
(see *What this browser remembers* below), but a URL that names `stops` is somebody
handing you their day: `restored()` in `plan-boot.js` takes the link whole and never
seeds, reorders or replaces it. A URL with no stops in it is not a shared day, it is just
the page, so the day you were building comes back rather than being thrown away — and is
written back into the address bar, or "Copy link" would hand over a link to an empty page.

**A day is bracketed by the hotel, and neither bracket is a stop.** Every morning of this
trip starts at the home base and every night comes back to it, so both ends are computed
and drawn as fixed rows — `startLeg()` and `homeLeg()` in `plan-core.js`, `planStartHtml()`
and `planHomeHtml()` in the pane. They are always on screen, including on an empty day,
and neither has a number, a handle or a remove: the day is what sits between them.

The end was always like this, because it had to be — `?stops=` collapses a repeated id, so
a hotel that both opened and closed a day could not survive a round trip through a link.
The start used to be an ordinary stop that `planSeedStart()` pushed in front of the first
spot you added, which made the two ends of one day two different kinds of thing. Computing
both instead also means they follow the day around as the order changes, and cost the URL
nothing.

**A link that still names the hotel first is absorbed, never rewritten.** Days built before
that change have `stops=novotel,…` in them, and quietly dropping an id from somebody's link
is the one thing this planner does not do. `planLead()` in `plan-state.js` returns 1 when
`ids[0]` is the leg's home base, `planBody()` is the day without it, and the pane, the map's
numbering, the drag, the reorder and the suggestions all count in body indices —
`planMoveBody()` and `planReorderBody()` are the only translation back. A hotel dragged into
the middle of a day is still an ordinary stop; only the first id is ever absorbed.

**In planning mode a click does not draw the ride from the hotel.** `body.planning` is the
page's one answer to "are we planning right now" (`planningMode()`), and while it is on,
`select()` skips `showRoute()` and the card carries `hopStripHtml()` instead: the hop from
the stop before this one — its distance, its line where the geometry proves one, its Naver
link — or, for a spot not in the day yet, the same measured from the last stop there is,
which is what you are weighing before you tap add. The hotel ride is the wrong answer
mid-plan, and its red streak buries the numbered pins the plan is being read off.

**The date is a row of chips, never a field.** There used to be no way to set `day` at all,
for a good reason: asking someone to type 2026-09-11 to build a list of stops is a worse
deal than losing the weekday cautions. A fortnight of dates is a different question —
`TRIP` and each leg's `spans` in `places.js` are the trip's own calendar, `tripDays()`
turns them into fifteen chips and `legForDate()` says which leg a date lands in, so
choosing a day costs one tap. A handover day sits in two spans at once and resolves to the
leg you are *arriving* in, because a day planned on the 4th is a day in Jeju.

It still schedules nothing. The date decides the `closedDays()` cautions and gives the
calendar file a day to sit on; no arrival time, dwell time or duration exists anywhere on
this page and none should be invented. On a morning of the trip an empty day opens on
today (in Korean time — `isoDay()` adds nine fixed hours rather than pulling in a timezone
library) and in the leg you are in. A day that arrives off a link keeps its own date,
always.

**Nothing is ever drawn between two stops on the map.** A planned stop takes its number
onto its own pin and everything else steps back — `body.planning` fades the other markers
and `railFade()` drops the rail — so the order reads on its own. There is no connector,
no overlay layer, and none should be added: a line from one stop to the next is a
straight streak across a city that says nothing you can act on. It is not a route, not a
walk and not a ride, because `ROUTES` is rooted at the hotel and there is no
station-to-station geometry to trace. What you can act on lives in the hop row instead —
the distance, the line where the geometry proves one, and the Naver link.

**Reordering is dragging, and only dragging.** A stop row is one four-column grid —
grab strip, number, stop, remove — sized off `--grab`/`--num`/`--ctrl`/`--gap` on
`.planpane`, which `mobile.css` widens to give every target a thumb. The up/down arrows
are gone: two 9px glyphs stacked in a column were the smallest targets on the page, and
their space went to the handle, which is now the full height of its row. The hop rows
hang off a dashed rail drawn down the centre of the number column and indent to the same
tokens, so numbers, rail and hop text line up in one column instead of each finding its
own left edge — that alignment is the reason those are tokens and not literals.

**The Naver button is the payload, not a footnote.** It is the one control on the page
that actually navigates a person somewhere, and on the ground it is what gets followed —
so `naverBtnHtml()` renders it filled and accent-coloured, right-aligned in a hop row on
desktop, full width at 44px on a phone, and full width in the card. Every hop, the walk
home, the planning card and the hotel-ride card go through that one function, so it looks
and behaves the same everywhere. `naverDirUrl()` is still the only thing to touch if a
link stops resolving.

**Kakao rides beside it, never in front of it.** Kakao Map is what half of Korea navigates
with, so every hop, both ends of the day and both cards carry it next to the Naver button —
one `dirBtnsHtml()` group, so the two move together and no button ever wraps onto a line by
itself. Naver stays the filled one because it is the link this repository builds, pins and
tests. Kakao's web link is destination-only on purpose: `map.kakao.com/link/to` takes one
place, not a pair, which on the ground is right anyway — it starts you where you are
standing. Like `naverDirUrl()`, neither could be reached from the environment they were
written in.

**The mode a Naver link opens in is one table, `NAVER_MODE_TOKEN`.** The last path segment
of a directions URL is the routing mode, and `naverMode()` decides which one a hop deserves
— walking under `HOP_WALKABLE_M`, driving in Jeju because there is no metro, transit
otherwise. What that mode is *called* in the URL is the one thing nothing here can
check: Naver is unreachable from this environment, publishes no grammar for these links,
and a token it does not recognise falls back to driving rather than erroring — a link that
looks like it works right up until you are standing on a platform. Transit is **`public`**,
not `transit`, which is the same word the app scheme uses and was found the only way it
could be, on a phone. The tokens live in one table with no other caller, and
`test-plan.mjs` pins that every mode goes through it; if one ever moves, that table is the
whole fix.

**There is no taxi button, and there should not be one until somebody can check it.** Kakao
T is what actually hails a taxi here, and a `kakaot://` scheme was briefly rendered on
touch devices — from memory, unverifiable from here, and an app scheme that is wrong fails
the worst way there is: silently, doing nothing at all, while you stand in a street at
midnight deciding whether to keep waiting. Kakao Map's car route is the honest version of
the same thing, and it is the screen you show the driver anyway.

**A day can leave the page three ways**, and none of them invents anything: "Copy link"
(the URL), "Copy as a message" (`planShareText()` — numbered stops and the links you would
actually follow, for texting someone), and "Add to a calendar" (`planIcs()`). The .ics is
deliberately **one all-day event** carrying the order in its description rather than a
timed schedule: no hop on this map has a time behind it, and an .ics full of invented
10:30s would look most authoritative exactly where it is least true. Without a date there
is nothing to hang an event on, so the button says so and takes you to the day chips.

`hopLine()` names the line for a hop, but only when both stations sit on one line and no
transfer has to be guessed. That restraint is the whole point: `STATION_COORDS` holds the
thirty-odd stops the routes happen to use, not the network, so routing through it sends
you Hongik Univ to Mangwon the long way round — 17km for a walk of one. `test-plan.mjs`
pins that case.

**There are no travel times between stops, on purpose.** `ROUTES` is keyed by
destination and rooted at `HOTEL_STATION`, so the page can work out a ride from the
hotel and genuinely cannot work out one between two spots. Rather than invent a number,
every hop carries a generated Naver Maps link, and walking distances — which really are
computable — come from `metres()` through the existing `WALK_BEND`/`WALK_KMH`. The one
function that builds those links is `naverDirUrl()`; it is the only thing to touch if a
link stops resolving.

Ordering advice is deterministic and computed here, never asked of anyone:
`backtracks()` flags an adjacent pair that is shorter the other way round,
`reorderByProximity()` offers a whole-day reorder and returns the identity order unless
it genuinely wins, and `nearbySuggestions()` ranks unplanned spots by distance to what
you already have.

`closedDaysFor()` in `plan-core.js` is the one authority on which days a place is shut, and
it reads three things in order. `closed` is the structured field synced from the trip's Notion
database and wins outright — an explicit `[]` means *open every day* and must not fall through,
or a place the database says opens daily would inherit a stale `Closed Mon` from a note. Then
the `hours` string, which carries its own closing days. Only then `closedDays()`, the old
anchored regex over the handful of `Closed Mon` shapes in `meta`, which is what keeps the ~40
places with no database row behaving exactly as they always did.

**`hours` is structured; `meta` is a sentence.** The distinction is the whole of
`src/lib/hours.js`, and confusing the two is the mistake this paragraph exists to prevent.
`hours` arrives already structured from the source database in one narrow 24h grammar
(`Daily 09:00-22:00`, `Mon-Fri 18:30-26:00; Sat,Sun 15:00-26:00`, a comma for a lunch break,
`; closed Tue`, `; LO 21:00`, and `26:00` meaning two in the morning), so parsing it is
reading a field, not guessing at prose — and anything the grammar does not cover returns
`null` and gets printed verbatim rather than guessed at. `meta` is still prose, still shown
verbatim, and still must never be parsed into a schedule beyond that one regex.

None of this schedules anything. There are no arrival times, no dwell times and no durations
anywhere on this page and none should be invented; `hours` says when a door is open, never
when you will be standing at it.

## What this browser remembers

One key, `trip-db/v1`, and `src/client/store.js` is the only module that touches
`localStorage` — everything else calls `save({...})` and reads `saved`. It holds the day
you were last building, the category chips, night mode, the rail toggle, which side tab
was open, which spots you have ticked off as been-to, and when each leg's tiles were
downloaded. Nothing else, and nothing anywhere near a server.

Two rules make that safe. A locked-down Safari **throws** rather than returning null, so
every touch is wrapped and `storeOk` goes false; the plan pane then says out loud that
this browser will not remember anything, because silently forgetting a day is worse than
not having offered. And the store is never the authority on a shared plan — see *A link
beats the store* above.

**Been-there is a tick, not a field.** `visited.js` keeps it, the row strikes its name
through, the pin desaturates, and a chip appears in the legend to hide them all — but only
once at least one exists, because a chip that says "0 been" on the first morning is a
control asking to be explained. Nothing that is in the day is ever hidden by it: its number
on the map has to point at a pin. It is not in the link either. What you have already eaten
is not part of the day you are handing somebody.

## Where you are

Opt-in, and it stays that way: a page that asks for a location on load gets refused once
and never asked again. The 📍 button starts a `watchPosition`; `geo-me.js` draws the dot
with its accuracy circle (Leaflet blue, not the trip's accent — this is the one place where
matching every other map app beats matching ourselves), fills every "N m away" in the list
**in place** rather than re-rendering it, and offers "nearest first", which drops the
neighbourhood headings for one list in walking order. The button then recentres, and stops
only once the map is already on you.

Distances go through the same `metres()` as everything else, so a row and a hop agree.
Refusal, a timeout and a browser with no geolocation at all each say something specific in
`#geobanner`, which is a separate banner from the tile one because they can both be true.

## Working with no signal

`public/sw.js` is a service worker, copied to the site verbatim — no build step behind it,
no imports, and it has to keep working on its own at `/trip-db/sw.js`. Everything the page
is made of already ships in this repository, so the shell (Leaflet, both fonts, the bundle,
the page) is precached on install and answered cache-first afterwards; navigations are
network-first so a deploy is picked up the moment there is a network.

Street tiles are the exception — they are CARTO's, and the only honest way to have them in
Jeju is to fetch them on hotel wifi and keep them. The ⤓ button downloads the current
leg's pack: `src/lib/tiles.js` works out which tiles that is (the whole city at zooms 11–13,
where it is cheap, and 450m around every spot at 14–16, where it is not — a bounding box of
Seoul at zoom 16 is a quarter of a million tiles, and nine-tenths of them are hillside), and
the worker fetches them four at a time and reports progress back. CARTO serves the same tile
from `a.`–`d.` and Leaflet picks the subdomain from the tile's coordinates, so both the
download and the lookup normalise to `a.` — cache it under four names and the pack you
downloaded is the pack you never hit.

`check-data.mjs` holds this together in the two places nothing else would notice: it fails
if `sw.js` precaches a file that is not in `public/` (rename a vendored font and the page
still builds, still works online, and quietly stops working offline) and if a leg's pack
grows past what anyone would download.

## The pure half

`src/lib/` is the fence. Nothing in it may touch `document`, `window`, `location`,
`history`, `localStorage` or `navigator`, and `tools/check-data.mjs` fails the build
if something does. That is what lets `tools/test-plan.mjs` import `plan-core.js`
straight into node and test it without a browser. Anything that touches the page goes
in `src/client/` instead.

One related rule survives from the single-file days: declare constants **one per
statement**. `tools/lib.mjs` finds a constant by searching for the literal text
`const NAME = `, so a name that only ever appears after a comma is invisible to
`fetch-rail.mjs` and `fetch-stations.mjs`.

## Before you push

```sh
npm run build                  # that it compiles at all
node tools/check-data.mjs      # data consistency, and the src/lib fence
node tools/test-plan.mjs       # the day planner's pure core, no browser needed
node tools/test-pipeline.mjs   # the geometry pipeline, no network needed
node tools/test-hours.mjs      # the opening-hours grammar, no clock needed
```

CI runs all five on every push and pull request, and nothing deploys unless they pass.
That is a backstop, not the plan: none of them see the page, so a green run says only
that the data agrees with itself and the bundle built.

For anything that changes behaviour or layout, **drive the real page — the phone first**
(see *Mobile first* below). This is a map, and unit checks do not see a route drawn under
a card, a label off the edge, or a button sliced in half by the card it is in. Serve it
and script a browser:

```sh
npm run dev                    # http://localhost:4321/trip-db/
```

### Driving the page

Bundled modules export nothing to the console, so `src/client/main.js` publishes a
handle deliberately:

```js
window.trip = { focus, select, deselect, setTab, setSideTab, setView,
                planAdd, planRemove, planToggle, planClear, planReorder, planHref,
                startLocating, stopLocating, savePack, packSize, setHideVisited,
                PLACES, CATS, RAIL,
                get map(), get railLayer(), get routeLayer(), get routeDraw(),
                get selectedId(), get currentTab(), get plan(), get planOver(),
                get here(), get locating(), get visited(), get hideVisited() }
```

With Playwright: load the page, call `trip.focus('<place id>')`, wait for the draw,
and assert on the DOM and on Leaflet's own state (`trip.map.getCenter()`,
`trip.routeDraw`, `.rs-tip` rects). Screenshot and look at it. Past regressions that
only a real browser caught: station labels colliding, the route drawing beneath the
card, a route framed off-screen, the map moving mid-draw, and plan rows whose lines
ran together because their spans were never made block.

Install Playwright outside the repo — a scratch directory, not here. Chromium is
usually already on the machine; point `executablePath` at it rather than downloading
another one.

Three of the newer things need the browser to be set up for them, and are worth driving
because nothing in `tools/` can see them: grant `permissions: ["geolocation"]` and set a
`geolocation` on the context to exercise the dot and the distances; use
`context.clock.setFixedTime()` to land inside the trip window and check that an empty day
opens on today in the right leg; and use a fresh context per case when testing what the
store remembers, since the whole point is that it survives a reload. The service worker
registers on `localhost` as well as https — talk to it over a `MessageChannel` the way
`offline.js` does, and read `caches.open("trip-db-shell-v1")` to see what it kept.

## Conventions worth keeping

- **The look lives in `styles/tokens.css`, all of it.** See *One place for the look*
  above. Nothing in `src/styles/` or `src/client/` may write a colour, a shadow, an icon
  size or a tap target — name a token instead, and `check-data.mjs` fails the build if a
  literal creeps back in.
- **Icons, not emoji**: see *Icons, and why they are not emoji* above. A new mark comes
  from the Streamline set through `tools/fetch-icons.mjs`, never from a character.
- **Global CSS, never scoped.** The sheet is built on cross-cutting state classes —
  `body.night`, `body.planning`, `body.routing`, `.side[data-sidetab]` — which Astro's
  scoping would rewrite out from under it. The stylesheets are imported in cascade
  order by the layout; keep them that way.
- **Mobile**: see *Mobile first* above. One media query at 780px, in
  `styles/mobile.css`; the map and list swap rather than stack.
- **Animation**: honour `prefers-reduced-motion` — the route draws complete and
  static instead of animating.
- **Failure**: degrade, do not break. Missing tiles, no route, an unknown
  station — the page keeps working and says what it can.
- **Vendoring**: Leaflet and both fonts live in `public/vendor/`, so the page pulls
  nothing from a CDN. The only thing fetched at runtime is street tiles from CARTO,
  and losing them degrades to pins-on-a-blank-canvas with a banner saying so — cached
  ones are served by the worker first, so that banner is now about the tiles you never
  downloaded rather than about having no signal. Leaflet stays a plain `<script>` setting
  `window.L`; that is what keeps `libFail()` honest.
- **Comments** explain why a thing is the way it is, not what the line does.
