# Technical backlog

This backlog captures the repository review findings from April 2026. Items are ordered by operational value and implementation risk.

## Completed

- [x] Protect the article generation panel and generation API with Cloudflare Access JWT validation in the Worker.
- [x] Configure Cloudflare Access applications and Worker secrets for the generation panel and generation API.
- [x] Force Worker-first routing for `/generuj`, `/generuj.html`, and `/api/*` so static assets cannot bypass Worker checks.
- [x] Hide stack traces from production 500 responses.
- [x] Improve blog metadata by using Polish document language, article Open Graph type, and per-article hero images.
- [x] Add a random suffix to automated GitHub publishing branches to avoid repeat-generation branch collisions.
- [x] Improve generation logging correlation while intentionally preserving prompts, responses, selected topics, and client payloads for later audit.
- [x] Cache D1 log table initialization per Worker isolate instead of running `CREATE TABLE IF NOT EXISTS` before every log insert.
- [x] Add a local operator script for querying generation logs by session, Access identity, topic, URL, event type, or payload contents.
- [x] Add an explicit D1 migration for the current logs table and a package script for applying future remote migrations.

## Next

- [x] Add lightweight anti-spam controls to the public contact form: size limits, per-session limits, and per-IP limits.
- [x] Split deployment checks into a PR CI workflow and a main-branch deploy workflow.
- [ ] Make views and likes atomic enough for production counts, likely through D1 or Durable Objects rather than read-modify-write KV.
- [ ] Harden likes against trivial repeat voting with better rate limits and key expiry.
- [ ] Replace regex-based RSS parsing with a proper XML/RSS parser or fixture-backed parser tests.
- [ ] Add focused tests for Cloudflare Access auth decisions and contact-form throttling.
