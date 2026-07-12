// Node adapter configuration for the self-hosted production runtime.
// The default astro.config.mjs remains the Cloudflare Worker build target.
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import node from "@astrojs/node";

export default defineConfig({
  site: "https://pseudointelekt.pl",
  output: "server",
  security: {
    // Trust the public hosts forwarded by Cloudflare Tunnel so Astro can
    // compare the browser Origin with the canonical request URL. Other
    // forwarded hosts remain ignored and the built-in CSRF check stays on.
    allowedDomains: [
      { protocol: "https", hostname: "pseudointelekt.pl" },
      { protocol: "https", hostname: "www.pseudointelekt.pl" },
    ],
  },
  integrations: [mdx(), sitemap()],
  adapter: node({ mode: "standalone" }),
});
