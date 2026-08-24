// @ts-check
import { defineConfig } from "astro/config";

/* The built site is committed to docs/ and served by GitHub Pages straight off
   `main` (Settings → Pages → Deploy from a branch → main / /docs). Pages only
   offers the repository root or /docs for a branch deploy, and the root is where
   the source lives, so docs/ is the output directory rather than dist/.

   `base` has to match the repository name: this is a project page, so everything
   is served under /trip-db/. Asset URLs in the components go through
   import.meta.env.BASE_URL so they stay correct in dev, where the base is
   applied too. */
export default defineConfig({
  site: "https://tacastillo.github.io",
  base: "/trip-db/",
  outDir: "./docs",
  build: {
    // index.html has to stay a real file at the root of the site: every day plan
    // ever shared is a link of the form index.html?city=…&stops=…
    format: "file",
  },
});
