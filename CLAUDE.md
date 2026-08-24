# Working on trip-db

A field map for one trip to Korea: Seoul, Jeju, Busan. `index.html` is the whole
site — markup, styles, data and logic in one file, served straight off the
`main` branch by GitHub Pages.

## The one rule

**There is no build step, and there must not be one.** `index.html` is what the
browser gets, byte for byte. Leaflet and the fonts are vendored under `vendor/`
so the page pulls nothing from a CDN. The only thing fetched at runtime is
street tiles from CARTO, and losing them degrades to pins-on-a-blank-canvas with
a banner saying so.

The scripts in `tools/` are maintenance, not a build: they rewrite constants
inside `index.html` and are then out of the picture. Never introduce a step that
has to run before the page works.

## Layout of index.html

Roughly in file order:

| Section | What lives there |
| --- | --- |
| `<style>` | Everything. Theme tokens on `:root`, dark overrides under `body.night`, mobile under one media query at 780px |
| `#plan-url-spec` | A JSON block describing the plan URL, for agents that fetch the page but cannot run it |
| Data | `CATS`, `CAT_ORDER`, `CLUSTERS`, `PLACES`, `LEGS`, `SUBWAY`, `SUBWAY_BUSAN` |
| Routing tables | `HOTEL_STATION`, `PLACE_OFF`, `ROUTES`, `STATION_COORDS` |
| State + list | `active`, `selectedId`, `renderLegend`, `renderList` |
| Map | `drawRail`, `initMap`, `syncMarkers`, `fitCity` |
| Journey | `railGraph`, `ride`, `buildJourney`, `offStationFor` |
| Drawing | `showRoute`, `animateRoute`, `revealTo`, `stationDots`, `spaceLabels` |
| Selection | `select`, `deselect`, `showCard`, `focus` |
| Day plan | `PLAN_*` constants and the pure core, then the pane, the drag and the overlay |

## Which data is generated and which is yours

| Constant | Source | Edit by hand? |
| --- | --- | --- |
| `PLACES`, `CLUSTERS`, `CATS`, `LEGS` | you | yes — this is the trip |
| `PLACE_OFF`, `ROUTES` | you | yes — they are the routing overrides |
| `STATION_COORDS` | OpenStreetMap, via `tools/fetch-stations.mjs` | names yes, coordinates no |
| `SUBWAY`, `SUBWAY_BUSAN` | OpenStreetMap, via `tools/fetch-rail.mjs` | no — regenerate instead |

Station **names are keys**. `ROUTES` is keyed by them and `PLACE_OFF` points at
them, so renaming one silently breaks a route. `fetch-stations.mjs` never
renames for that reason; it reports what it could not match and leaves it alone.

## Adding a place

Append to `PLACES`:

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

1. **Which station you get off at** — `offStationFor()`. `PLACE_OFF[id]` wins if
   it is set. Otherwise it takes the nearest station that has a `ROUTES` entry,
   provided the walk is under `AUTO_WALK_MAX` (1100m, sized to the longest
   hand-set walk). Hotels get nothing; that is where the ride starts.
2. **Which lines to take** — `ROUTES[station]`, a list of `{line, to}`. The last
   `to` is where you get off, earlier ones are transfers.
3. **The shape of the track** — traced, never stored. `railGraph()` turns the
   line's polylines into a graph, `ride()` runs Dijkstra between the two
   stations, and the walk is a straight line to the door.

So adding a Seoul spot near an existing station needs no table edit. Add
`PLACE_OFF[id]` only when the nearest station is not the one you would really
use. Add to `ROUTES` and `STATION_COORDS` when a station is genuinely new.

Only Seoul draws rides. Busan has line geometry but no station table behind it;
Jeju has no metro. Both are handled, not broken: the card opens, no ride draws.

## How a day plan is carried

A plan is a list of place ids in the query string and nothing else — no server, no
`localStorage`:

```
index.html?city=seoul&day=2026-09-01&stops=novotel,gyeongbok,bukchon&title=Jongno
```

That grammar is a deliberate choice, not a shortcut. Someone can read the day off the
link, and so can an agent that fetches the deployed URL and cannot run the script: it
takes the ids out of `stops`, looks each one up in `PLACES` in the same file, and has
the whole day with every note attached. `#plan-url-spec` says so in machine-readable
form, and `check-data.mjs` fails if that block drifts from `PLAN_PARAMS`.

Rotted links degrade rather than break. An id the map no longer has is **kept**, shown
as its own row and flagged — dropping it would quietly amputate a stop from a link
someone else shared. Unknown query params ride along untouched.

**Nothing is ever drawn between two stops on the map.** A planned stop takes its number
onto its own pin and everything else steps back — `body.planning` fades the other markers
and `railFade()` drops the rail — so the order reads on its own. There is no connector,
no overlay layer, and none should be added: a line from one stop to the next is a
straight streak across a city that says nothing you can act on. It is not a route, not a
walk and not a ride, because `ROUTES` is rooted at the hotel and there is no
station-to-station geometry to trace. What you can act on lives in the hop row instead —
the distance, the line where the geometry proves one, and the Naver link.

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
you already have. `closedDays()` reads the handful of `Closed Mon` shapes that actually
occur in `meta` — it is not an hours parser and must not become one. Everything else in
`meta` is shown verbatim and never interpreted.

### The two sentinels

The planner's pure half is fenced:

```js
/* ==== plan-core:start ==== */   … no DOM, no map, no page state …   /* ==== plan-core:end ==== */
```

`tools/test-plan.mjs` slices that block straight out of the file and runs it in Node,
which works only while it stays pure — a `document` or a `currentTab` inside the fence
fails the test that checks for exactly that. Anything that touches the page goes below
`plan-core:end`. `geo-core` fences `metres()` for the same reason: the tests measure
with the page's own arithmetic rather than a near-copy.

One related rule: declare constants **one per statement**. `tools/lib.mjs` finds a
constant by searching for the literal text `const NAME = `, so a name that only ever
appears after a comma is invisible to every checker.

## Before you push

```sh
node tools/check-data.mjs      # data consistency; exits non-zero on a problem
node tools/test-plan.mjs       # the day planner's pure core, no browser needed
node tools/test-pipeline.mjs   # the geometry pipeline, no network needed
```

For anything that changes behaviour or layout, **drive the real page** — this is
a map, and unit checks do not see a route drawn under a card or a label off the
edge. Serve it and script a browser:

```sh
python3 -m http.server 8000
```

Then with Playwright: load the page, call `focus('<place id>')`, wait for the
draw, and assert on the DOM and on Leaflet's own state (`map.getCenter()`,
`routeDraw`, `planLayer.getLayers()`, `.rs-tip` rects). Screenshot and look at it. Past
regressions that only a real browser caught: station labels colliding, the route drawing
beneath the card, a route framed off-screen, the map moving mid-draw, and plan rows
whose lines ran together because their spans were never made block.

Install Playwright outside the repo — a scratch directory, not here. This project has no
`package.json` and no `node_modules`, and that is worth keeping.

## Conventions worth keeping

- **Themes**: every colour goes through a token on `:root`, overridden under
  `body.night`. Never hard-code a hex in a rule that both themes use.
- **Mobile**: one media query at 780px. The map and list swap rather than stack.
- **Animation**: honour `prefers-reduced-motion` — the route draws complete and
  static instead of animating.
- **Failure**: degrade, do not break. Missing tiles, no route, an unknown
  station — the page keeps working and says what it can.
- **Comments** explain why a thing is the way it is, not what the line does.
