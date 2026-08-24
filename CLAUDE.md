# Working on trip-db

A field map for one trip to Korea: Seoul, Jeju, Busan. It is an [Astro][] site with
no framework and no islands: `.astro` files carry the markup, plain CSS carries the
look, and the behaviour is a handful of ES modules under `src/client/`. GitHub
Actions builds it on every push to `main` and hands the output to GitHub Pages.

[Astro]: https://astro.build

## The shape of it

```
.github/workflows/      the checks, the build and the Pages deploy
astro.config.mjs        base:'/trip-db/'; output goes to dist/, which is gitignored
public/                 copied verbatim: vendor/ (Leaflet, fonts) and .nojekyll
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
| `view.js` | the mobile map/list switch, `isMobile` |
| `legend.js` `list.js` `card.js` | the sidebar's three renderers |
| `map.js` | `initMap`, `drawRail`, `syncMarkers`, `fitCity`, the Leaflet layers |
| `route.js` | drawing and animating the ride, the station labels |
| `selection.js` | `select`, `deselect`, `focus`, `selectedId` |
| `plan-state.js` `plan-pane.js` `plan-drag.js` `plan-map.js` `plan-boot.js` | the day plan |
| `tabs.js` `rail-legend.js` | the leg tabs and the subway key |
| `main.js` | the boot sequence, the two toggle buttons, `window.trip` |

Shared mutable state is an `export let` read elsewhere as a live binding, which is
why almost every read is still a bare name. A value only gets a setter when a module
other than its owner writes it — `setCurrentTab`, `setNight`, `setPlan` and a few more.

**Nothing may run at import time that reaches into another module.** Module evaluation
order is not source order: a top-level call across a cycle lands in the temporal dead
zone and takes the whole page down. Boot code goes in `main.js`, at the bottom, in order.

## Which data is generated and which is yours

| Constant | File | Source | Edit by hand? |
| --- | --- | --- | --- |
| `PLACES`, `CLUSTERS`, `CATS`, `CAT_ORDER`, `LEGS` | `data/places.js` | you | yes — this is the trip |
| `PLACE_OFF`, `ROUTES` | `data/routing.js` | you | yes — they are the routing overrides |
| `STATION_COORDS` | `data/routing.js` | OSM, via `tools/fetch-stations.mjs` | names yes, coordinates no |
| `SUBWAY`, `SUBWAY_BUSAN` | `data/subway*.js` | OSM, via `tools/fetch-rail.mjs` | no — regenerate instead |

Station **names are keys**. `ROUTES` is keyed by them and `PLACE_OFF` points at them,
so renaming one silently breaks a route. `fetch-stations.mjs` never renames for that
reason; it reports what it could not match and leaves it alone.

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

A plan is a list of place ids in the query string and nothing else — no server, no
`localStorage`:

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
```

CI runs all four on every push and pull request, and nothing deploys unless they pass.
That is a backstop, not the plan: none of them see the page, so a green run says only
that the data agrees with itself and the bundle built.

For anything that changes behaviour or layout, **drive the real page** — this is
a map, and unit checks do not see a route drawn under a card or a label off the
edge. Serve it and script a browser:

```sh
npm run dev                    # http://localhost:4321/trip-db/
```

### Driving the page

Bundled modules export nothing to the console, so `src/client/main.js` publishes a
handle deliberately:

```js
window.trip = { focus, select, deselect, setTab, setSideTab, setView,
                planAdd, planRemove, planToggle, planClear, planReorder, planHref,
                PLACES, CATS, RAIL,
                get map(), get railLayer(), get routeLayer(), get routeDraw(),
                get selectedId(), get currentTab(), get plan(), get planOver() }
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

## Conventions worth keeping

- **Themes**: every colour goes through a token on `:root` in `styles/tokens.css`,
  overridden under `body.night`. Never hard-code a hex in a rule that both themes use.
- **Global CSS, never scoped.** The sheet is built on cross-cutting state classes —
  `body.night`, `body.planning`, `body.routing`, `.side[data-sidetab]` — which Astro's
  scoping would rewrite out from under it. The stylesheets are imported in cascade
  order by the layout; keep them that way.
- **Mobile**: one media query at 780px, in `styles/mobile.css`. The map and list swap
  rather than stack.
- **Animation**: honour `prefers-reduced-motion` — the route draws complete and
  static instead of animating.
- **Failure**: degrade, do not break. Missing tiles, no route, an unknown
  station — the page keeps working and says what it can.
- **Vendoring**: Leaflet and both fonts live in `public/vendor/`, so the page pulls
  nothing from a CDN. The only thing fetched at runtime is street tiles from CARTO,
  and losing them degrades to pins-on-a-blank-canvas with a banner saying so. Leaflet
  stays a plain `<script>` setting `window.L`; that is what keeps `libFail()` honest.
- **Comments** explain why a thing is the way it is, not what the line does.
