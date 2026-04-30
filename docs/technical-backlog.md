# Technical backlog

This backlog captures the repository review findings from April 2026. Items are ordered by operational value and implementation risk.

## Completed

- [x] Protect the article generation panel and generation API with Cloudflare Access JWT validation in the Worker.
- [x] Configure Cloudflare Access applications and Worker secrets for the generation panel and generation API.
- [x] Force Worker-first routing for `/generuj`, `/generuj.html`, and `/api/*` so static assets cannot bypass Worker checks.
- [x] Hide stack traces from production 500 responses.
- [x] Improve blog metadata by using Polish document language, article Open Graph type, and per-article hero images.
- [x] Add a random suffix to automated GitHub publishing branches to avoid repeat-generation branch collisions.

## Next

- [x] Add lightweight anti-spam controls to the public contact form: size limits, per-session limits, and per-IP limits.
- [x] Split deployment checks into a PR CI workflow and a main-branch deploy workflow.
- [ ] Reduce logging sensitivity and volume, especially full prompt/response payloads and request metadata.
- [ ] Move D1 log table creation into an explicit migration instead of running `CREATE TABLE IF NOT EXISTS` during request logging.
- [ ] Make views and likes atomic enough for production counts, likely through D1 or Durable Objects rather than read-modify-write KV.
- [ ] Harden likes against trivial repeat voting with better rate limits and key expiry.
- [ ] Replace regex-based RSS parsing with a proper XML/RSS parser or fixture-backed parser tests.
- [ ] Add focused tests for Cloudflare Access auth decisions and contact-form throttling.
