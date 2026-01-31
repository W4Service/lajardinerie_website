import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
// Configuration pour GitHub Pages
const GITHUB_ORG = "Wuilhome";
const REPO_NAME = "lajardinerie_website";

export default defineConfig({
  site: `https://${GITHUB_ORG}.github.io/${REPO_NAME}`,
  base: `/${REPO_NAME}`,
  integrations: [tailwind()],
  build: {
    assets: "assets"
  },
  vite: {
    build: {
      cssMinify: true
    }
  }
});
