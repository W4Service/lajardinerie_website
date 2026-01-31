import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

// Configuration pour GitHub Pages
const GITHUB_ORG = "Wuilhome";
const REPO_NAME = "lajardinerie_website";

export default defineConfig({
  site: `https://${GITHUB_ORG}.github.io`,
  base: `/${REPO_NAME}`,
  integrations: [tailwind(), sitemap()],
  build: {
    assets: "assets"
  },
  vite: {
    build: {
      cssMinify: true
    }
  }
});
