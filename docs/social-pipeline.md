# Social media pipeline

The article pipeline optionally posts a compact `SocialSource` to the internal
`/api/social/enqueue` endpoint after the GitHub PR is created. Failure here is
non-fatal for article publication.

New articles are stored as `candidate` records only. Once a week the global
`pseudointelekt-social-weekly` Codex skill reads `/api/social/context`, selects
two current articles and one evergreen article, creates the final copy and
editorial master images, and submits an explicit weekly run. Candidates never
trigger generation or publication by themselves.

FFmpeg template `situation-room-v2` creates a 1080x1920 H.264/AAC short and an
optional 1080x1350 Instagram image without aggressively cropping the master
illustration. Files live on the
`social-media` volume. The app mounts that volume read-only and exposes only
opaque, expiring media URLs required by Buffer.

## Safe rollout

1. Keep automatic article-to-social processing disabled; only explicit weekly
   runs may reach the renderer.
2. Store Buffer credentials and channel IDs in Vault/runtime secrets and keep
   media in the approved host directory.
3. Use the global skill once per week and inspect its selected master images.
4. Confirm all Buffer entries are drafts. Human approval remains in Buffer.
5. The metrics service snapshots Buffer results after 24h, 72h, 7d and 28d.

When all drafts in a weekly run are ready, one Slack digest links the operator
to Buffer. A second digest is sent only after every publication in the run has
a seven-day Buffer snapshot; it remains descriptive until 12 comparable posts
exist.

`POST /api/social/jobs` accepts `{ "id": "uuid", "action": "retry|regenerate|skip" }`
and is protected by the same private generator authentication. No Buffer secret
or raw local-model authentication data is written to PostgreSQL.

Prometheus can scrape `/api/social/metrics` with `Authorization: Bearer
${SOCIAL_METRICS_TOKEN}`. Alert when `pseudointelekt_social_oldest_pending_seconds`
exceeds 86400 or when failed jobs remain non-zero for two consecutive scrapes.

## Weekly private API

- `GET /api/social/context` returns candidates, recent usage and metric snapshots.
- `POST /api/social/runs` validates the 2 current + 1 evergreen manifest.
- `POST /api/social/upload` stores one inspected master image per selected job.
- `POST /api/social/finalize` moves exactly three complete jobs to `ready`.
- `GET /api/social/runs?id=<uuid>` reports rendering and Buffer draft state.

The repository client `scripts/social-weekly-client.mjs` is executed inside the
app container by the global skill wrapper, so no private runtime secret is
copied into the skill or repository.
