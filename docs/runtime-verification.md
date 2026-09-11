# Node runtime regression checks

Pseudointelekt runs in the private RKE2 namespace `pseudointelekt`. Its
ApplicationRelease in `release-system` validates source, builds and scans an
immutable image, then promotes through Flux. Do not use the retired Worker or
mbprod deployment commands for normal releases.

## Acceptance commands

```sh
npm ci
npm run check
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:25432/pseudointelekt_test npm run test:integration
npm run test:smoke -- http://127.0.0.1:3100
npm run test:smoke -- https://pseudointelekt.pl
```

Integration tests require an isolated disposable PostgreSQL database named
`pseudointelekt_test` on localhost. They refuse other hosts/database names and
disable Slack notifications. CI creates its own PostgreSQL service. Tests cover
concurrent session-idempotent likes, atomic views, and contact validation and
persistence. They must never target production.

The HTTP smoke walks every RSS article and its versioned hero image, plus
navigation, the five topic dossiers, sitemap, robots, 404, and health. It is
read-only and spaces public requests by 1.1 seconds to respect edge rate limits.
It does not claim to prove image decoding, JavaScript interactions, PostgreSQL
readiness or external provider readiness. Verify browser images/search/mobile
navigation separately and read production likes/views without generating test
engagement or sending messages.

## September 11 regression findings

- The prior image delivery repair restored all 153 source assets and non-root
  readability. Some browser subresources still showed broken images while
  canonical HTTP GETs returned valid PNGs. Content collection image URLs now
  include a SHA-256-derived version, invalidating older cached responses without
  disabling caching or requiring Cloudflare purge privileges.
- Likes previously selected the session before inserting it, allowing concurrent
  requests to increment twice. Only a successful unique session insert now
  increments the counter inside the transaction.
- Malformed contact requests now return 400, not a form-parser exception.
- Local publication now requires a real source URL, verified source context and
  a canonical topic. `PUBLICATION_DATE` supports explicit backfills. Invalid
  dates, empty images and file collisions fail without overwriting articles.
  Git commands pass arguments directly rather than interpolating generated text
  into a shell, and refuse a non-empty index.
- The local outline receives the verified context; final article quality is
  checked before paying for an image. Writing targets 1050+ words with factual
  summary separated from original analysis.

Local verification: 163 unit/regression tests, 3 real PostgreSQL integration
tests and the full 153-article/153-image HTTP smoke passed. Chrome decoded the
previously broken images in the local build; archive search returned seven
matching entries for Ormuz. A 390px viewport had no horizontal overflow and the
mobile menu navigated to the topic index.

## September content backfill

The requested interval is September 1–11, 2026, one article per date. The
configured generator credential returned HTTP 429 with `You have no credits
remaining` before the first outline. The owner explicitly declined a top-up
and requested direct local writing plus built-in image generation, followed
by a repository push and automatic delivery. No billing settings or provider
credentials were changed.

The resulting batch contains eleven Polish articles and eleven original
1536x1024 PNG heroes. Each article has a verified primary-source URL, an
explicit publication date, one canonical topic, three H2 sections, and more
than 1050 words. Illustrative scenarios are labeled as such, rather than
presented as reported events. Images follow the existing green/ivory/gold
editorial style, without text, logos or people. Private source notes and image
prompts remain outside Git and shared knowledge.

`scripts/september-backfill.test.mjs` adds twelve regression cases for date
continuity, unique titles/assets, metadata limits, canonical topics, editorial
quality, image paths and PNG dimensions. The normal content audit and image
build checks still cover the entire collection. PNG header tests do not prove
browser decoding; retain the separate visual acceptance step.

Batch acceptance on September 11: `npm run check` passed (175 tests,
TypeScript, content audit and Node build), all 3 disposable PostgreSQL tests
passed again, and the local HTTP smoke passed all 346 requests covering 164
articles and images. All eleven new PNGs decoded successfully with sharp.
Chrome also decoded the new versioned hero and found the September 7 article
through archive search. These are local results, not production release proof.

The scheduled API generator remains blocked by provider credits. Local
backfilling does not repair or bypass that external dependency. Any future
provider-capacity or billing change still requires an explicit owner decision.

CLI inputs: `BASE_TOPIC`, `LEAD_SOURCE_URL`, `SOURCE_CONTEXT` (at most 500
characters), `ARTICLE_TOPIC`, `PUBLICATION_DATE`, and a process-scoped
`OPENAI_API_KEY`. Run through the existing TypeScript loader:

```sh
node --experimental-loader ./scripts/ts-test-loader.mjs scripts/publish-article.ts
```

Generation logs contain source context and drafts: keep them private, outside
Git and shared operational knowledge. Social publishing and real contact
notifications require separate acceptance; public health alone cannot prove
those external dependencies.
