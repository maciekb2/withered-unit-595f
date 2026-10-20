# Article engagement measurement

Private brand Pseudointelekt, owner Maciej. Current runtime is private RKE2;
Cloudflare remains the edge. GA4 is `G-WTSC0BFN20`. This change alters frontend
measurement, not article generation, publishing content, the database schema,
first-party counter storage, credentials or backup producers.

`private_sites_v1` keeps existing event names, with explicit meaning:

- `article_read_start`: article content is visible in an active tab after
  analytics consent. Granting consent on an already-open page now starts it.
- `article_scroll_depth`:25/50/75/90 percent of article content reached by a
  new scroll after consent. Milestones reached before consent are not replayed.
- `article_read_complete`: at least30seconds of visible article content with
  consent plus reaching90percent of that content. A short article entirely
  visible in the viewport can qualify after30seconds. This is an engagement
  heuristic, not proof that the visitor read or understood the text.
- `article_like`: the user deliberately submits a like, the API returns a
  successful integer counter receipt, and analytics was allowed at intent and
  receipt. Failed/malformed replies and concurrent repeated clicks do not
  manufacture analytics successes or a locally saved like.
- `article_adjacent_click` / `article_related_click`: navigation intent;
  target page measurement remains a separate event.

Timers stop accruing when the content/tab is hidden or analytics is denied.
The existing whole-document90percent shortcut was not a reading guarantee.
Article parameters are public authored slug/year/age, not private text. Existing
search sends query length/result count/topic, not the search query itself.

The existing version2 consent record must have an actual boolean, a valid
nonfuture timestamp and age under180days. An unavailable localStorage write
does not break the in-memory choice. Storage changes from another tab update
the collector; withdrawal sets ga-disable, clears existing GA cookies and
signals the article observer. Ads/signals remain off; new cookies are host-only.
Locations exclude query/fragment; referrers are limited to origins of the small
authored search/social allowlist in BaseHead, with no search terms or full URL.
This means other referral domains are omitted from these fields. Key events,
Google ingestion and acquisition reports must be verified separately.

Validation:4article state tests,3consent/collector tests and3like-receipt tests;
`npm run typecheck` and `npm run build:node`. Fixtures use synthetic counters and
mocked fetch; no public likes, forms, posts, messages or accounts are created.
The source base equals live ApplicationRelease revision
`d6d942b6f15f4396c91114ad3e9f14b395ccf275`, image
`sha256:f4806f8edf76eede14fb395257f35a2453b6eb4e2bceca6955fddc20d754ac2b`.
The live release controller currently uses Automatic promotion from main;
older skill/runbook Shadow statements are historical. Feature-branch work does
not constitute deployment. Require candidate identity, DEV acceptance, source/
GitOps/native/public receipt before reporting this measurement as deployed.

## Sitemap coverage and acquisition audit,21 October

Google Search Console showed0clicks/23impressions,CTR0%,average position8 for
21September–18October. Its indexing snapshot dated12October reports100indexed
and66excluded URLs (2server errors,1not found,1redirect,31crawled not indexed,
17discovered not indexed,14canonical duplicates). These historical exclusions
are not all current application failures. The two5xx examples are topic pages
geopolityka/2 and/3,last crawled July/August; both now return200 with self canonical.

The Node build's sitemap contained26URLs and no blog articles,while201public
Markdown articles already existed. Astro warned that getStaticPaths was ignored
in the SSR blog route. The route now explicitly prerenders its committed content;
interactive counters remain client API requests. Article age is calculated in
the browser from the public publication date,not frozen at build time.

Node build now verifies every committed article rendered as static HTML with a
canonical in the sitemap and no noindex. It checks201articles/237total URLs;
the guard failed on the old build with0rendered articles against201sources.
This is build evidence,not deployed sitemap coverage or Google indexing proof.
Official integration limitation: https://docs.astro.build/en/guides/integrations-guide/sitemap/ .
Source changes and release acceptance must remain separate from crawl/index results.
