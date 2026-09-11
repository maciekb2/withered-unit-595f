# Private application telemetry

The Node runtime exports Prometheus text on a separate opt-in listener,
`METRICS_PORT=9092`. There is deliberately no public `/api/metrics` route.
Deploy a ClusterIP service and restrictive ingress policy before enabling it.
For local acceptance use `METRICS_HOST=127.0.0.1`.

## Measurements

- SSR request counts and cumulative latency histograms grouped by a fixed route
  class, method class, status class and request/probe classification.
- RSS/heap memory, cumulative process CPU, uptime and event-loop p99 delay.
- Database connectivity/query latency; independent aggregate collector health.
- Stored engagement totals, accepted contact counts for 24h/7d and expired
  contact-record count. No names, addresses, messages or session IDs.
- Social job counts by an allowlisted state and oldest active state/scheduled
  eligibility timestamp; generation attempt counts/latest timestamps within 7d.
- Number of published articles, publications within 7d, last publication time.
- Semantic GET checks of home/archive/topics/contact/health/RSS/latest article
  and HEAD checks of its image. A rotating older article/image sample visits
  the complete archive over N minutes. A remembered failure timestamp prevents a
  later healthy sample from hiding a broken article. No form submission,
  engagement POST, generation job or provider call is part of probing.

Middleware latency ends when the response is created, not after body transfer.
Static assets and prerendered pages bypass it. SSR and engagement totals are
not unique visitors, verified humans or advertising conversions. Counts can be
affected by bots or client retries; no RUM/browser-error collector is added.
Probe classification uses a fixed user agent and is informational, not a
security/billing boundary. Test telemetry can be distinguished on dashboards.

## Isolation and performance

The collector runs at most once per minute, independently of HTTP scrapes.
Queries use a separate one-connection PostgreSQL pool with read-only sessions,
2-second statement/connection deadlines and a 500ms lock deadline. Missing
optional tables emit collector_up=0, not fabricated zero business activity.
Queries return aggregates only. The collector does not change data or schemas.

Probe concurrency is two, each request has a three-second deadline and a
512-KiB body ceiling; redirects are not followed. Image checks use HEAD and
verify image content type and nonzero length, not decoded pixel correctness.
`PROBE_BASE_URL` defaults to local HTTP/PORT and can target the private app
Service. Optional `PROBE_GATEWAY_URL` tests the local gateway with the public
Host header. Both are trusted deployment configuration, never request input.
Local checks do not prove public DNS, Internet TLS, Cloudflare or browser JS.

Metrics labels never contain raw URL/query, title, IP, email, error message,
session or database IDs. Runtime request series have bounded label cardinality.
Counter resets on application restart are handled with rate/increase, while
business snapshots and collection timestamps are gauges. A failed collection
keeps its prior snapshot; alerts must check its age as well as values.

## Persistence and release

VictoriaMetrics periodically scrapes the listener and stores history on its
persistent volume; the app does not hold historical charts in memory. Dashboards,
rules and the selected retention live in the owning infrastructure repository.
This instrumentation is independent of the UX/contact migration PR: it uses
existing tables, tolerates a missing generation_runs table, and introduces no
new migration. Enable infrastructure only after a verified image containing
this middleware is promoted by the existing release pipeline.

## Verification

Run `npm run check`, the disposable PostgreSQL integration suite and
`node scripts/site-smoke.mjs http://127.0.0.1:4313`.
With the Node app on 4313 and metrics on 9432, first GET / initializes the
listener; allow the first bounded collection to complete, then GET
`http://127.0.0.1:9432/metrics`. The application port's /api/metrics and the
metrics listener's non-metrics paths must return 404. No credentials should be
required or emitted by the separate local listener.
