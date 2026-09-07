# Self-hosted image build for private RKE2

> The `mbprod` deployment was retired on 2026-09-04. Production now runs on
> the private RKE2 cluster defined in `maciekb2/mb-private-rke2`. Do not run
> the historical host deployment scripts from this directory.

Cloudflare remains the public edge through a Tunnel. The application,
PostgreSQL-backed services, scheduler and generators run in the private RKE2
cluster managed from `maciekb2/mb-private-rke2`.

Runtime secrets are rendered from Vault and must never be committed. Ollama is
reached through the authenticated Helpdesk Model Gateway; do not bypass that
approved path or copy its credentials into this repository.

The Node runtime is the production origin behind Cloudflare Tunnel. The
Cloudflare Worker remains a rollback artifact with automatic builds disabled;
restore it only through a controlled route change after verifying the cluster
origin.

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

Merges to GitHub `main` reach the cluster through the signed Flux Receiver
webhook. The reusable release controller validates the source, builds the image
with rootless BuildKit, scans it with Trivy and promotes it through the GitOps
repository. GitHub Actions does not hold a cluster SSH key.

## Retired mbprod backup and restore reference

Do not install these units on the retired host. They are retained only as
recovery evidence for the former Compose deployment.
The daily 02:30 timer creates a compressed PostgreSQL dump and a social-media
archive. When `/etc/pseudointelekt/backup.env` defines `RESTIC_REPOSITORY` and
`RESTIC_PASSWORD_FILE`, both artifacts are encrypted and copied off host with
14 daily, 8 weekly and 12 monthly snapshots. The weekly timer validates the
latest PostgreSQL dump, social archive and Restic repository without touching
production. Backup and scheduler freshness are exported to node_exporter textfile
metrics. A full restore is done
into an empty maintenance database with `pg_restore --clean --if-exists`; stop
the app before replacing the production database and take one final backup
first. The first go-live backup must be followed by a temporary-container
restore test.

`cloudflared-ingress.example.yml` documents the required public and private
hostnames. The generator hostname must be protected by Cloudflare Access or a
private WARP/VPN route before it is published.

The former `MBPROD_*` GitHub deployment secrets are not part of the active RKE2
release path and must not be reintroduced.
