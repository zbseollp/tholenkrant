// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { rehypeRepairMediaUrls } from "./src/lib/rehype-repair-media-urls.mjs";
import mdx from "@astrojs/mdx";
import compress from "astro-compress";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://tholenkrant.nl",
  output: "static",
  trailingSlash: "always",
  build: {
    format: "directory",
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },
  markdown: {
    rehypePlugins: [rehypeRepairMediaUrls],
  },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) =>
        !page.includes("/contact/thanks/") && !page.includes("/404"),
    }),
    compress({
      CSS: true,
      HTML: true,
      Image: false, // we use astro:assets for images
      JavaScript: true,
      SVG: true,
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    envPrefix: ["PUBLIC_", "R2_", "TENANT", "PAYLOAD_"],
    resolve: {
      alias: {
        "@data": "/src/data",
      },
    },
  },
});
