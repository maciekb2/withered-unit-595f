# Editorial pages and contact protection

## Changes (2026-09-11)

Contact, the topic directory, topic article lists and the archive share the
homepage's green/ivory/gold palette, Archivo headings, consistent page widths
and simple editorial rules. Removed ornamental contact pills, looping rings,
the duplicate featured-article label, the unsupported “updated” badge and
layered global card overrides. Homepage memo remains unchanged.

The archive uses a full-width search/select toolbar and the same five topic
definitions as the directory. It folds Polish diacritics in search, repairs
invalid topic parameters, clears the URL when filters are reset, announces
result counts, and restores focus after reset/result pagination. Default
server-rendered pagination remains usable without JavaScript.

Contact has shared client/server limits (120/254/4000 characters), labelled
fields, per-field errors, a message counter, a busy guard and a 15-second
client deadline. Drafts remain in the form on failure (not localStorage).
Uncertain retries reuse a submission UUID; changed drafts receive a new UUID.
JavaScript is required for form feedback; a direct mail link remains available.
No new animation runs continuously. Reduced-motion disables page transitions.

## Server contract

- POST requires exact matching Origin and rejects cross-site Fetch Metadata.
  Astro's built-in origin protection stays enabled.
- Only URL-encoded/multipart forms; duplicate values/files are rejected.
  Actual streamed body limit: 64 KiB, including multipart overhead; five-second
  read deadline. Error responses use no-store and do not expose SQL or secrets.
- Hidden honeypot submissions are acknowledged without storage/notification.
  This is an auxiliary signal, not the main abuse protection.
- PostgreSQL transaction/advisory lock and unique submission UUID make retries
  idempotent across processes/restarts. Reuse with different content is 409.
- Durable quotas: 3 messages/email/10 minutes, 10/source IP/hour, 30 globally/
  minute. Atomic upserts, rollback on rejection, 429 with Retry-After. Email
  quota is case-insensitive; it is not proof of mailbox ownership.
- IP/email rate keys use SHA-256, not raw values. These are pseudonymous, not
  anonymous. Expired quota rows are removed on a subsequent valid submission.
- Notifications occur after commit, use Slack plain_text blocks (not executable
  user mentions/markup), and have a five-second deadline. Notification failure
  does not discard the stored message. Delivery is best effort, not an outbox;
  retries do not resend notifications. No external service is required to save.
- Existing contact-message retention timestamps remain 365 days. This change
  does not introduce a retention scheduler or prove production purge execution;
  independently verify that operational retention matches the privacy policy.

## Migration and deployment gate

Apply the reviewed, additive
`deploy/selfhosted/migrations/006_contact_protection.sql` before promoting this
runtime. It adds a nullable UUID/index and a separate quota table. Existing
messages and the prior application remain compatible. Reapplying is safe.
Do not auto-approve gated migration paths or apply this directly to production.
An application rollback may retain the additive schema; do not drop message data.

`CONTACT_TRUST_CF_IP=true` is opt-in. Enable only after verifying that the origin
is reachable exclusively through the controlled edge, that CF-Connecting-IP is
overwritten by that edge, and that alternate ingress cannot supply it. Never
trust arbitrary X-Forwarded-For. Without this option, rate limiting uses the
adapter peer address (or a conservative shared unknown bucket): behind a proxy
that can group visitors into one 10/hour quota. Review this setting before
promotion; do not silently weaken the limit to accommodate a proxy.

Verify forwarded public protocol/host against the allowedDomains configuration
and exercise an approved synthetic form submission after release. A healthy
GET or CI success is not evidence for the production POST/proxy chain.

## Verification

`npm run check` covers types, 164-article content audit, unit/regression tests
and the Node build/image gate. `scripts/archive-ui.test.mjs` exercises the
actual inline archive controller, including the final-filter reset regression.

Use a disposable localhost database named `pseudointelekt_test`:

```sh
TEST_DATABASE_URL=postgresql://contact_test@127.0.0.1:25432/pseudointelekt_test npm run test:integration
node scripts/site-smoke.mjs http://127.0.0.1:4312
```

Integration tests apply migrations 001/006 (006 twice), simulate a missing table,
exercise parallel retries/quotas, reject malformed/file/foreign-origin requests,
and test Slack serialization with a mocked transport. They also retain the
concurrent likes and views checks. Never point them at real data.

Chrome acceptance, desktop and 390 px: field-error focus, successful database
save, empty form after success, 503 draft preservation, retry after recovery,
topic selection, accent-folded search, filter/URL reset, topic navigation and
no horizontal overflow. Local smoke: all 164 article/image pairs, navigation,
topics, SEO endpoints, 404 and health (346 requests). No production form was
submitted and no Slack message was sent during acceptance.

Security references:
[OWASP origin checks](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html),
[Cloudflare request headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/),
[Slack text objects](https://docs.slack.dev/reference/block-kit/composition-objects/text-object/).
