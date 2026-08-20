# tools

Maintenance scripts for the data vendored inside `index.html`. Plain Node
(18+), no dependencies, no `npm install` — a fresh clone can run them.

**These are not a build step.** The page ships with its data inside it and never
runs any of this. The scripts exist so the vendored data can be *regenerated*
instead of hand-patched, which is the only way it stays consistent as lines
extend and stations move.

| Script | Network | What it does |
| --- | --- | --- |
| `check-data.mjs` | no | Checks every table in `index.html` against every other. Exits non-zero on a problem. |
| `test-pipeline.mjs` | no | Exercises the geometry pipeline against the data already in the file. |
| `fetch-rail.mjs` | yes | Rebuilds `SUBWAY` / `SUBWAY_BUSAN` from OpenStreetMap. |
| `fetch-stations.mjs` | yes | Refreshes `STATION_COORDS` from OpenStreetMap. |
| `lib.mjs` | — | Shared: reading and writing the constants, geometry, Overpass. |

Both fetchers are **dry-run by default**. They print what they found and what
would change; nothing is written without `--write`.

## Day to day

```sh
node tools/check-data.mjs        # after editing PLACES, and before pushing
node tools/test-pipeline.mjs     # after touching anything in lib.mjs
```

`check-data.mjs` also prints ride coverage per leg, which is the quickest way to
see whether a change to the routing tables actually reached the map:

```
coverage
  Seoul   66/67  spots draw a ride  (1 hotel, where the ride starts)
  Jeju     0/32  spots draw a ride  (1 hotel, where the ride starts)  — no rail data for this leg
  Busan    0/22  spots draw a ride  (1 hotel, where the ride starts)
  16 of those picked a station automatically; longest walk 713m of 1100m allowed
```

## Refreshing the subway geometry

```sh
node tools/fetch-rail.mjs                 # look first
node tools/fetch-rail.mjs --write         # then commit the diff
node tools/fetch-rail.mjs --city busan --write
```

It asks Overpass for each line's `route_master` relation, keeps every child
relation as its own group, stitches each group's ways into continuous paths,
simplifies to 20m, clips to 40km around the city, and labels each end
`terminus`, `junction` or `clip` — the page fades out `clip` ends only, because
those are the only ones that are a lie about the network.

If a line comes back empty the script **stops** rather than writing a map with a
line missing. Fix that line's `osm` filter in `fetch-rail.mjs`: open the
relation on openstreetmap.org and copy the tags it actually carries. Colours and
labels in that file are ours, not OSM's, and are safe to edit.

Expect a diff even when nothing real changed — OSM is edited constantly. Check
the reported path and point counts look sane, then look at the map.

## Refreshing the stations

```sh
node tools/fetch-stations.mjs                 # report drift
node tools/fetch-stations.mjs --write         # update coordinates we already have
node tools/fetch-stations.mjs --add --write   # also add stations we don't have
```

This **merges, never replaces**. Station names are keys — `ROUTES` is keyed by
them, `PLACE_OFF` points at them — and OSM's English names drift ("Jongno 3-ga"
is "Jongno 3(sam)-ga" there). So it matches on a normalised name, updates
coordinates, reports anything it could not match, and leaves those rows exactly
as they were. It refuses to write if a station named in `ROUTES` would vanish.

`--add` is how you would bootstrap a new city's station list. Note that stations
alone are not enough to draw a ride: `ROUTES` entries and a `HOTEL_STATION` for
that city are also needed, and `HOTEL_STATION` is currently a single Seoul
constant.

## Adding a city to the fetchers

Add an entry to `CITIES` in both fetch scripts: a centre, a clip radius, and for
rail, the lines with their refs, labels, colours and Overpass filters. Then wire
the constant into `RAIL` in `index.html`.
