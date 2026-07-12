# Self-hosted runtime

This stack is the production target on `mbprod.s.sn`. Cloudflare remains the
public edge through a Tunnel; the application and PostgreSQL run locally.

The tunnel token and `.env` file are host-managed secrets and must never be
committed. Ollama is reached through the authenticated Helpdesk Model Gateway
at `10.2.11.58:8110`, which is the approved network path to Jetson1
(`10.2.11.72:11434`).

The current Worker deployment remains the rollback target until the PostgreSQL
data migration and all API routes have been verified on the Node runtime.

The Node build exposes the public Astro pages and PostgreSQL-backed engagement
and contact endpoints. Article generation runs in the internal `generator`
service on port 3001; it has no host-published port and is reached only by the
internal scheduler or the `generator.pseudointelekt.pl` Tunnel hostname. That
hostname is protected by Cloudflare Access (`pseudointelekt_generator_private`)
with an operator allow policy. The app-level JWT check remains enabled as a
second, origin-side barrier. `/api/generate-stream`, `/api/update-prompt`,
`/api/get-prompt`, `/api/client-log`, `/api/sentry-test`, `/generuj` and
`/generuj.html` are private routes; public engagement, contact and health
routes are deliberately not behind Access.

`GENERATOR_PRIVATE_TOKEN` is retained only for scheduler-to-service calls and
break-glass operations. It is never placed in browser code. In production set
`CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` (comma-separated audiences for the
private Access apps) and `CF_ACCESS_ALLOWED_EMAILS` in the host-managed env.

`deploy.sh` is the host-side deploy entrypoint used by GitHub Actions after a
merge to `main`. It downloads the repository tarball, preserves the
host-managed `.env` and secrets, rebuilds the app image, and recreates the app
and scheduler containers.

## PostgreSQL backup and restore

Run `deploy/selfhosted/backup-postgres.sh` on `mbprod` (daily from the host
timer/cron) to create a compressed custom-format dump under
`/opt/apps/production/pseudointelekt/backups/postgres`. The script keeps 14 days
by default and never prints credentials. Validate a backup without touching
production by starting a temporary PostgreSQL 16 container, creating the
database, and running `pg_restore --list` against the dump. A restore is done
into an empty maintenance database with `pg_restore --clean --if-exists`; stop
the app before replacing the production database and take one final backup
first. The first go-live backup must be followed by a temporary-container
restore test.

`cloudflared-ingress.example.yml` documents the required public and private
hostnames. The generator hostname must be protected by Cloudflare Access or a
private WARP/VPN route before it is published.

The GitHub workflow requires repository secrets `MBPROD_HOST`, `MBPROD_USER`,
`MBPROD_SSH_KEY`, and `MBPROD_GITHUB_TOKEN`. The SSH key is intentionally not
generated or committed by this repository; install its public half in the
`macie` account on `mbprod` and store only the private half in GitHub Actions.
