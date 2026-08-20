# trip-db

Seoul field map for our Korea trip — a single self-contained page (`index.html`)
built on [Leaflet](https://leafletjs.com/), with a place list, filters, and a night mode.

Picking a spot draws the ride there from the hotel along the subway lines
themselves: every transfer station marked with the line you change onto, the
path animated from the platform to the front door under a slow pulse, and the
rest of the network dropped back so the route reads at a glance. The spot's
details open in a card pinned to the top of the map rather than hanging off its
pin, so the ride below it stays visible and the map still drags freely. The map
does not move when you pick a spot — the opening view already frames the city,
and a ride that draws while the view is still flying is two animations fighting.

A spot with no entry in `PLACE_OFF` gets off at the nearest station that has a
route, so adding a place to `PLACES` is usually the whole job; `PLACE_OFF` is
the override for when the nearest station isn't the one you'd actually use, and
`ROUTES` is where the lines and transfers live. Both are hand-editable — see the
block above them in `index.html`. The geometry between two stations is traced
from the line data at load, not stored.

Seoul is the only leg with a station table, so it is the only leg that draws a
ride: Busan has its lines on the map but no stations behind them, and Jeju has
no metro to ride.

## Dependencies

Leaflet and both fonts are vendored into `vendor/`, so the page pulls nothing
from a CDN at load time:

| Path | What | License |
| --- | --- | --- |
| `vendor/leaflet/` | Leaflet 1.9.4 (js, css, control images) | BSD-2-Clause |
| `vendor/fonts/inter-*.woff2` | Inter Variable (latin, latin-ext) | SIL OFL 1.1 |
| `vendor/fonts/bricolage-*.woff2` | Bricolage Grotesque Variable (latin, latin-ext) | SIL OFL 1.1 |

Updating one means replacing the file by hand — that is the trade for not
depending on someone else's uptime.

The one thing still fetched live is the street tiles, from CARTO. Without them
the map degrades to pins and subway lines on a blank canvas, and says so in a
banner; the list, filters, notes and popups are unaffected. Note that the page
itself is not offline-installable — with no connection at all, the browser has
to have `index.html` in its HTTP cache to open it. A service worker would fix
that.

## Deploying

GitHub Pages serves the `main` branch from the repository root (Settings →
Pages → *Deploy from a branch*). Pushing to `main` publishes; there is no build
step, and `.nojekyll` keeps Jekyll from touching the files.

Live site: https://tacastillo.github.io/trip-db/

## Local preview

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```
