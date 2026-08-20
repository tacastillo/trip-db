# trip-db

Seoul field map for our Korea trip — a single self-contained page (`index.html`)
built on [Leaflet](https://leafletjs.com/), with a place list, filters, and a night mode.

## Deploying

Every push to the site branch runs `.github/workflows/deploy-pages.yml`, which
publishes the repository root to GitHub Pages. The workflow enables Pages on
first run, so no manual setup is needed beyond allowing GitHub Actions as the
Pages source.

Live site: https://tacastillo.github.io/trip-db/

## Local preview

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```
