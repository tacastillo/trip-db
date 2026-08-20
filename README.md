# trip-db

Seoul field map for our Korea trip — a single self-contained page (`index.html`)
built on [Leaflet](https://leafletjs.com/), with a place list, filters, and a night mode.

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
