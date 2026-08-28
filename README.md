# trip-db

Seoul field map for our Korea trip — one page built with [Astro](https://astro.build)
and [Leaflet](https://leafletjs.com/), with a place list, filters, and a night mode.

Picking a spot draws the ride there from the hotel along the subway lines
themselves: every transfer station marked with the line you change onto, the
path animated from the platform to the front door under a slow pulse, and the
rest of the network dropped back so the route reads at a glance. The spot's
details open in a card pinned to the top of the map rather than hanging off its
pin, so the ride below it stays visible and the map still drags freely. The map
does not move when you pick a spot — the opening view already frames the city,
and a ride that draws while the view is still flying is two animations fighting.

A spot with no entry in `PLACE_OFF` gets off at the nearest station that has a
route, so adding a place to `src/data/places.js` is usually the whole job;
`PLACE_OFF` is the override for when the nearest station isn't the one you'd
actually use, and `ROUTES` is where the lines and transfers live. Both are
hand-editable, in `src/data/routing.js`. The geometry between two stations is
traced from the line data at load, not stored.

Seoul is the only leg with a station table, so it is the only leg that draws a
ride: Busan has its lines on the map but no stations behind them, and Jeju has
no metro to ride.

## Planning a day

The sidebar has a second tab. Add spots from the map card or from the list — there is a
search box now — and they stack up into an ordered day, draggable into a different
order. On the map a planned stop keeps its category colour but carries its number
instead of its emoji, and everything else fades back, so the day reads on its own.
Nothing is drawn between the stops — a straight line between two of them is not a route
you could follow, and the useful part is in the list.

The day lives in the address bar, so a link is the whole share mechanism — and this
browser keeps a copy, so closing the tab no longer loses it. A link that names stops
always wins over the copy: it is somebody handing you their day.

```
index.html?city=seoul&day=2026-09-01&stops=novotel,gyeongbok,bukchon&title=Jongno
```

Between every pair of stops it gives you the distance, a walking estimate when walking
is sensible, and a **Naver Maps** link for the actual directions. Where both stops sit
on one subway line it names it — "Line 5 · Dongdaemun History & Culture Park → Jongno
3-ga" — and where they do not, it says nothing rather than guessing a transfer. It does not tell you
how long a hop takes, and that is deliberate: the routing tables only know rides out
from the hotel, so a station-to-station time does not exist anywhere in this project and
guessing one would be worse than the link.

Every hop also carries a **Kakao Map** link beside the Naver one, and on a phone a
**Kakao T** button for the taxi.

What it *does* work out, from the data and without asking anyone: whether two stops are
the wrong way round, whether the whole day would be shorter walked in another order,
which unplanned spots sit near what you have already picked, and — the trip's fifteen
days are a row of chips at the top of the pane, one tap — whether anything on the list is
shut that weekday. On a morning of the trip an empty day opens on today, in the leg you
are in.

**Copy as a message** puts the day on the clipboard as something you can text someone,
and **Add to a calendar** saves it as an `.ics` — one all-day entry with the order in its
description, never a schedule, because no hop on this map has a time behind it.

**Copy briefing** puts the day on your clipboard as markdown: every stop with its notes,
coordinates, hours prose and hop links, plus a plain statement of what the map does not
know. Paste it into a chat, or just hand over the link — `#plan-url-spec` inside the page tells
an agent that fetches the URL how to decode the query string, and `#trip-data` next to it
publishes the places themselves, so it can read the day without running any JavaScript,
then add the things this map genuinely cannot: how busy somewhere gets, how long the
queue runs, what to order.

## On the ground

It is built for a phone first — the map and the list swap rather than stack, every
control is a thumb-sized target, and the header collapses to icons so the title keeps
its line. The desktop layout is the same page with more room.

Three things the map does that only matter when you are standing in a street:

- **Where you are.** The 📍 button puts a dot on the map, hangs a live distance off every
  row in the list, and will re-sort the whole list by how far away things are. It is
  opt-in and asks for nothing until you press it.
- **Been there.** Tick a spot off and it strikes through in the list and fades on the
  map; a chip in the legend hides them all. That is this browser's business — it is
  never in a shared link.
- **No signal.** The site installs as an app and keeps itself: after one visit the page,
  Leaflet, the fonts and the data are all served from the device. The ⤓ button downloads
  the current leg's street tiles too — roughly 7 MB for Seoul, 11 for Jeju, 4 for Busan —
  so the map still draws on a dead SIM or a plane.

## How it is put together

`src/pages/index.astro` composes four components — the header, the sidebar, the map
pane and the two JSON blocks — over a layout that carries the `<head>`. The look is
plain global CSS in `src/styles/`, imported in cascade order; nothing is scoped,
because the whole sheet hangs off state classes on `<body>`. The behaviour is ES
modules: `src/lib/` is pure and gets imported straight into node by the tests,
`src/client/` is everything that touches the page. `src/data/` holds the trip and the
vendored OpenStreetMap geometry. See [`CLAUDE.md`](CLAUDE.md) for the module map.

## Dependencies

Astro is the only dependency, and it only runs at build time. Leaflet and both fonts
are vendored into `public/vendor/`, so the page pulls nothing from a CDN at load time:

| Path | What | License |
| --- | --- | --- |
| `public/vendor/leaflet/` | Leaflet 1.9.4 (js, css, control images) | BSD-2-Clause |
| `public/vendor/fonts/inter-*.woff2` | Inter Variable (latin, latin-ext) | SIL OFL 1.1 |
| `public/vendor/fonts/bricolage-*.woff2` | Bricolage Grotesque Variable (latin, latin-ext) | SIL OFL 1.1 |

Updating one means replacing the file by hand — that is the trade for not
depending on someone else's uptime.

The one thing still fetched live is the street tiles, from CARTO. Without them
the map degrades to pins and subway lines on a blank canvas, and says so in a
banner; the list, filters, notes and popups are unaffected. Note that the page
itself is not offline-installable — with no connection at all, the browser has
to have the page in its HTTP cache to open it. A service worker would fix that.
It also cannot be opened straight off the disk any more: the scripts are ES
modules, which browsers refuse over `file://`. Serve it.

## Maintaining the data

The subway geometry and station coordinates under `src/data/` come from
OpenStreetMap, and `tools/` is how they get refreshed — plus a checker that
holds the hand-written tables and the generated ones to each other:

```sh
node tools/check-data.mjs      # every table against every other; non-zero on a problem
node tools/test-plan.mjs       # the day planner's pure core
node tools/fetch-rail.mjs      # rebuild the line geometry (add --write to apply)
```

None of it is part of the build; see [`tools/README.md`](tools/README.md) for the
rest, and [`CLAUDE.md`](CLAUDE.md) for how the pieces fit together.

## Local preview

```sh
npm install
npm run dev        # http://localhost:4321/trip-db/
```

## Deploying

Pushing to `main` publishes. `.github/workflows/deploy.yml` runs the data checks and
both test scripts, builds the site, and hands the output to GitHub Pages; nothing
deploys if a check fails. No build output lives in the repository — `dist/` is
gitignored. `public/.nojekyll` lands in the output and keeps Jekyll away from Astro's
`_astro/` directory.

The same workflow runs on pull requests, minus the deploy.

One setting has to be right for any of this to land: **Settings → Pages → Source →
GitHub Actions**. On *Deploy from a branch* the build still runs and the deploy step
fails.

Live site: https://tacastillo.github.io/trip-db/
