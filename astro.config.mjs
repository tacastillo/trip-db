// @ts-check
import { defineConfig } from "astro/config";

/* `base` has to match the repository name: this is a project page, so everything is
   served under /trip-db/. Asset URLs in the components go through
   import.meta.env.BASE_URL so they stay correct in dev, where the base applies too.

   The build output goes to the default ./dist and is gitignored — .github/workflows
   builds it and hands it to Pages, so no artifact is ever committed. */
export default defineConfig({
  site: "https://tacastillo.github.io",
  base: "/trip-db/",
  build: {
    // index.html has to stay a real file at the root of the site: every day plan
    // ever shared is a link of the form index.html?city=…&stops=…
    format: "file",
  },
});
