# trip-db

Seoul field map for our Korea trip — a single self-contained page (`index.html`)
built on [Leaflet](https://leafletjs.com/), with a place list, filters, and a night mode.

Picking a spot draws the ride there from the hotel along the subway lines
themselves: every transfer station marked with the line you change onto, the
path animated from the platform to the front door, and the rest of the network
dropped back so the route reads at a glance. Which line a spot is reached on is
editable by hand — see the `PLACE_OFF` / `ROUTES` block in `index.html`; the
geometry between two stations is traced from the line data, not stored.

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
