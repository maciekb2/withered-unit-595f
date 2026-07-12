// Node adapter configuration for the self-hosted production runtime.
// The default astro.config.mjs remains the Cloudflare Worker build target.
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import node from "@astrojs/node";

export default defineConfig({
  site: "https://pseudointelekt.pl",
  output: "server",
  integrations: [mdx(), sitemap()],
  adapter: node({ mode: "standalone" }),
});
