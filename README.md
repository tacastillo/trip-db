# trip-db

Seoul field map for our Korea trip — a single self-contained page (`index.html`)
built on [Leaflet](https://leafletjs.com/), with a place list, filters, and a night mode.

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

## Where the places come from

The pins are synced from the Notion database **📍 Places, Food & Things to Do**. Edit Notion;
the site follows. `index.html` between the `PLACES:START` / `PLACES:END` markers is generated —
edits there are overwritten on the next sync.

| File | Owner | What it is |
| --- | --- | --- |
| `data/places.notion.json` | generated | snapshot of the Notion rows; the diff is the changelog |
| `data/places.extra.json` | you | hotels, extra branches, drops, overrides, booked flags |
| `data/mapping.json` | you | Notion `Type` → category, `Neighborhood` → cluster, cluster order |

`scripts/sync-notion.mjs` fetches; `scripts/build-page.mjs` merges the three files into the page.
The build runs offline from the committed snapshot, so you can rebuild and test without a key:

```sh
node scripts/build-page.mjs          # rebuild index.html from data/
node scripts/build-page.mjs --check  # fail if the page is stale
NOTION_KEY=secret_... node scripts/sync-notion.mjs   # refresh the snapshot
```

### Automatic sync

`.github/workflows/sync-notion.yml` runs every 6 hours and commits if anything changed,
which republishes the site. To run it now: **Actions → Sync from Notion → Run workflow**
(leave *dry run* ticked to see the diff without publishing).

Setup, once: the integration behind `NOTION_KEY` needs access to the database — open it in
Notion, ••• → **Connections**, add the integration. Without it the API returns 404. The key
itself lives in Settings → Secrets and variables → Actions.

Two guard rails: rows without coordinates are skipped and named in the run summary, and a
sync that would drop more than 20% of the pins aborts rather than gutting the live map
(re-run with *force* if the rows really were deleted).

### Things Notion can't express

- **One row, several branches.** Notion has one `Nudake`; the map wants a pin per location.
  The extra branches live in `places.extra.json`.
- **`Neighborhood` sometimes lists a chain's branches** rather than where the row's
  coordinates are, which files the pin in the wrong group. `mapping.json` →
  `clusterByPlace` overrides it by name, and wins over `Neighborhood`.
- **Duplicates and scratch rows.** `Han Jung Sun`/`Han Jung Sung` are the same shop; rows
  like `O'sulloc — Busan (SKIP …)` aren't going on the map. Dropped by Notion page id in
  `places.extra.json`, so Notion stays as you like it.

## Local preview

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```
