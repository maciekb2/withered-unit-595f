# Pseudointelekt: Status link and WatchMyApp monitoring plan

Prepared 2026-09-17. Owner: Maciej; application repository:
`maciekb2/withered-unit-595f`. Private infrastructure: `maciekb2/mb-private-rke2`,
context `home-mb-dev`, namespace `pseudointelekt`. This is a proposal, not evidence
that WatchMyApp monitors, alert routes or heartbeat integrations are configured.

## Footer destination and active baseline

The shared footer has a conditional **Status** link configured by
`STATUS_PAGE_URL` in `src/consts.ts`. It opens in the same tab and loads no widget,
tracking script or external request until the visitor follows the link.

After the owner explicitly requested creation with slug `pseudointelekt`, a
dedicated workspace was created under `admin@watchmyapp.io`. Its published page
is `https://app.watchmyapp.io/s/pseudointelekt`, titled
**Pseudointelekt — status serwisu**. Public API readback verifies the page,
homepage backlink and green/gold appearance. History starts with real data only.

One baseline HTTP monitor, **Strona główna**, checks `https://pseudointelekt.pl/`
from Kraków every 900 seconds (Free plan), with a 10-second timeout, expected
HTTP 200 and body marker `Pseudointelekt`, three failures to open an incident
and two successes to recover. No notification channels were created or tests sent.
All other monitors below remain proposals. The footer constant now points to this
verified published page. A source change or merged PR alone does not prove the
footer is deployed; production rollout is verified separately.

## Proposed first monitors

Intervals below are proposals, subject to the selected WatchMyApp plan. Use
HTTP GET, verified TLS, a 10-second timeout, three consecutive failures to open
an incident, and two successes to recover where supported. Start with a
5-minute interval (use 15 minutes if required by the plan).

| Monitor | Target / assertion | Public component? | Meaning and limit |
| --- | --- | --- | --- |
| Website | `https://pseudointelekt.pl/`, HTTP 200 and `Pseudointelekt` in body | Website | Public edge and HTML reachable; does not prove the database or generator works. |
| Article archive | `https://pseudointelekt.pl/blog`, HTTP 200 and expected archive content | Articles | Archive route reachable; select a stable exact body marker after checking the rendered page. |
| Article and illustration | One confirmed published article URL and its actual hero image URL | Articles, optionally separate Media | Use stable fixtures; do not invent a slug. Image must return an image content type, not an HTML error with status 200. |
| RSS | `https://pseudointelekt.pl/rss.xml`, HTTP 200 and `<rss` | RSS feed | Feed availability, not publication freshness. XML parsing/item validation needs an external script if the monitor only supports body matching. |
| Runtime | `https://pseudointelekt.pl/api/health`, HTTP 200 and `"ok":true` | Prefer internal | Existing handler reports process health only. It does not query PostgreSQL, OpenAI, or scheduler progress. |
| Sitemap | `https://pseudointelekt.pl/sitemap-index.xml`, HTTP 200 and `<sitemapindex` | Internal | Search-discovery plumbing; 15–60 minutes is sufficient. Also validate the child sitemap separately before claiming full coverage. |
| Engagement read API | `GET /api/views/<confirmed-article-slug>`, HTTP 200 and valid nonnegative `views` | Internal | Existing read-only PostgreSQL-backed path. Never use POST: that would inflate engagement counters. JSON validation may need a script/private probe. |

Only the homepage, health, RSS and sitemap-index endpoints were fetched in this
review: all returned HTTP 200 with expected content types. Other assertions and
fixtures require verification before monitor activation. Do not expose internal
target names, diagnostic payloads, tokens or billing details on the status page.

## Article generation and OpenAI — separate signals

The application uses OpenAI API, not the ChatGPT website. Current source uses
`POST https://api.openai.com/v1/chat/completions` for text and
`POST https://api.openai.com/v1/images/generations` for illustrations. Preserve
the configured provider/model; this plan is not a provider migration.

1. **Generator process:** private reachability/readiness check from an authorized
   private probe. The current Kubernetes probe checks TCP port 3001; that only
   proves a listener. Do not expose the generator or its credentials publicly.
2. **Text generation / OpenAI:** emit a sanitized event from an actual generation
   attempt, recording success/failure, duration, provider and error class only.
   No prompts, article drafts, raw error bodies, API keys or private URLs.
3. **Illustration generation / OpenAI:** record its outcome separately; successful
   text generation must not hide a failed image stage.
4. **Completed editorial run:** send a WatchMyApp heartbeat only after validated
   content and required media are saved and the intended review artifact exists.
   Creating a PR is not the same as publishing the article. Use a durable
   completion marker/run ID and an idempotent dispatch job.
5. **Publication:** independently verify the approved article and asset on the
   public site after release. A fresh RSS item can supplement this; it must not
   replace checking the actual article and image.

Do NOT point a periodic HTTP monitor at `/api/generate-stream`: even a GET can
start paid generation and repository writes. Do not send paid OpenAI canaries
without a separately approved schedule, model and spend limit. A generic HTTP
check of `api.openai.com` does not prove account quota or generation capability.

Existing `generation_runs` and scheduler state/metrics offer a starting point,
but `summarizeGenerationEvents()` currently treats absence of an explicit failure
as success. Before wiring heartbeat success, require positive terminal evidence
(not merely EOF, an empty SSE response or an HTTP 200). Test empty/truncated
streams, missing PR/media, retries and process restarts.

Proposed error classes follow existing `src/utils/openaiErrors.ts`:

- `OPENAI_BILLING_QUOTA_EXCEEDED`: private operator alert, no blind retry loop.
- `OPENAI_AUTH_ERROR`: private credential/permission issue; do not auto-rotate.
- `OPENAI_RATE_LIMIT`: bounded backoff; distinguish it from exhausted quota.
- Timeout/provider 5xx: bounded retry, then alert if the run cannot finish.
- Content validation/media/storage/review failures: separate from provider health.

Official reference: [OpenAI API error codes](https://developers.openai.com/api/docs/guides/error-codes).

## Intentional pause and alert timing

Live deployment inspection confirmed `SCHEDULER_ENABLED=false` on 2026-09-17.
Keep it disabled. Do not create an active missing-heartbeat alarm or mark the
public website down just because automated publication is intentionally paused.
Any generation component should be omitted from the public page or clearly
labelled paused, never presented as a measured healthy service without evidence.

After explicit approval to resume scheduling, derive deadlines from the actual
local schedule and timezone, bounded runtime and retry window. For a daily job,
the grace window must cover planned retries and daylight-saving transitions;
do not blindly choose exactly 24 hours. Test the first run before arming alerts.

## Suggested public status page

Start with **Website**, **Articles**, and **RSS feed**. Public status describes
reader-visible functions, not every infrastructure dependency. Keep database,
quota and credential diagnostics private. If generation is later displayed, use
**Article preparation** with a clear distinction from already-published content.

Use a separate demo page/monitor for Arcade and failure exercises. Do not take
the real publication or homepage offline to manufacture an outage, or send test
incidents to real subscribers without explicit approval. Never falsify history.

## Activation checklist

- Confirm exact workspace, status-page URL and available monitor allowances.
- Verify all targets and content assertions without state-changing requests.
- Create monitors only after the proposed selection is accepted; avoid duplicates.
- Verify a dedicated alert recipient/channel before sending any test.
- Implement and test heartbeat/event dispatch independently of generation success;
  monitoring failure must not trigger a second paid article generation.
- Keep heartbeat/event credentials in private encrypted runtime secrets. Any new
  secret, persistent queue or DB change requires the existing backup/restore gates.
- Before a footer deployment, preserve the previous image digest, validate/scan
  the candidate and verify the actual public footer and destination after rollout.

The initial plan did not mutate the services. The subsequently authorized
workspace, baseline monitor and public page were created as described above.
No generation, notification, subscription or secret changes were made.

## Local verification

`npm run typecheck`, `npm run test:ci` and `npm run build:node` passed on the
dedicated branch. The Node build verified all 164 article image references in
the built output. Tests cover the optional destination contract and conditional
footer link. After setting the destination, re-run validation and verify the
public footer after the private RKE2 release; local success is not rollout proof.
