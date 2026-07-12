# Social media pipeline

The article pipeline optionally posts a compact `SocialSource` to the internal
`/api/social/enqueue` endpoint after the GitHub PR is created. Failure here is
non-fatal for article publication.

`social-worker` waits until the public article URL responds successfully, asks
the configured Jetson model to score the source, and processes at most three
eligible packages per calendar week. A second constrained request generates
channel copy and 5–6 scenes. Local validation rejects generic filler, malformed
copy and numbers absent from the source.

FFmpeg creates a 1080x1920 H.264/AAC short and a 1080x1350 Instagram image from
the article hero and the approved music directory. Files live on the
`social-media` volume. The app mounts that volume read-only and exposes only
opaque, expiring media URLs required by Buffer.

## Safe rollout

1. Keep `SOCIAL_BUFFER_DRY_RUN=true` and add at least one licensed audio file to
   the host directory configured by `SOCIAL_MUSIC_DIR_HOST`.
2. Confirm `/api/social/jobs` through the protected generator origin and inspect
   the rendered assets.
3. Store `BUFFER_API_KEY`, `BUFFER_INSTAGRAM_CHANNEL_ID` and
   `BUFFER_YOUTUBE_CHANNEL_ID` in Vault/runtime secrets.
4. Run one controlled job and confirm all three Buffer entries are drafts.
5. Set `SOCIAL_BUFFER_DRY_RUN=false`. Human approval remains in Buffer.

`POST /api/social/jobs` accepts `{ "id": "uuid", "action": "retry|regenerate|skip" }`
and is protected by the same private generator authentication. No Buffer secret
or raw local-model authentication data is written to PostgreSQL.

Prometheus can scrape `/api/social/metrics` with `Authorization: Bearer
${SOCIAL_METRICS_TOKEN}`. Alert when `pseudointelekt_social_oldest_pending_seconds`
exceeds 86400 or when failed jobs remain non-zero for two consecutive scrapes.
