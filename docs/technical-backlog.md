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
- [x] Move views and likes to D1-backed atomic counters while preserving existing KV counts as first-use baselines.
- [x] Harden likes against trivial repeat voting with same-session idempotency plus hashed session/IP/IP+slug rate limits with KV expiry.
- [x] Replace regex-based RSS parsing with `fast-xml-parser` and fixture-backed RSS/Atom parser tests.

## Next

- [x] Add lightweight anti-spam controls to the public contact form: size limits, per-session limits, and per-IP limits.
- [x] Split deployment checks into a PR CI workflow and a main-branch deploy workflow.
- [x] Add focused tests for Cloudflare Access auth decisions and contact-form throttling.

## Generation provider migration

- [x] Document the target generation-provider contract: text through the token-authenticated home Jetson gateway, images through a newer configurable image model with a consistent house style.
- [x] Add a safe text-generation provider abstraction so OpenAI remains the fallback while the Jetson gateway can be enabled with secrets and timeouts.
- [x] Add a configurable image model setting and update the hero-image prompt/style defaults for consistent newer-model output.
- [x] Verify the full generation flow through Cloudflare Access with audit logs still preserving prompts, client payloads, and Access identity/method.

## Self-hosted runtime migration

- [x] Add a separate Astro Node build target and production Docker Compose scaffold for `mbprod`.
- [x] Add the PostgreSQL schema foundation for counters, likes, contacts and audit logs.
- [x] Port public counters, likes, contact and client-log API handlers and D1/KV repositories to PostgreSQL.
- [x] Add a private Node `/api/generate-stream` route that reuses the validated generation pipeline and can call Jetson directly.
- [ ] Export/import D1/KV data and verify parity with the self-hosted database.
- [ ] Configure the production Tunnel and private/VPN-only generator ingress.

## UI and SEO polish

- [x] Rebuild the public homepage as a responsive Situation Room experience with a scroll-driven procedural globe, progressive fallbacks, and live editorial data.
- [x] Rebuild the blog index into a richer editorial archive with a featured article, descriptions, responsive cards, and local search.
- [x] Improve the article page reading chrome: metadata bar, like/view controls, spacing, and article JSON-LD/BreadcrumbList details.
- [x] Normalize legacy article bodies and block repeated titles, leads, source preambles, and duplicate paragraphs in future publications.
- [ ] Upgrade the generation dashboard quality panel so it visualizes `quality-check` warnings and errors as a checklist.
