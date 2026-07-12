# Self-hosted runtime

This stack is the production target on `mbprod.s.sn`. Cloudflare remains the
public edge through a Tunnel; the application and PostgreSQL run locally.

The tunnel token and `.env` file are host-managed secrets and must never be
committed. Ollama is reached through the authenticated Helpdesk Model Gateway
at `10.2.11.58:8110`, which is the approved network path to Jetson1
(`10.2.11.72:11434`).

The current Worker deployment remains the rollback target until the PostgreSQL
data migration and all API routes have been verified on the Node runtime.

The Node build now exposes the public Astro pages, PostgreSQL-backed engagement
and contact endpoints, and a private `/api/generate-stream` route. Set
`GENERATOR_PRIVATE_TOKEN` through Vault for the interim private route; the
production Tunnel should only expose that route after its VPN/private ingress
policy is configured. The Worker remains the rollback target until data parity
and the live Jetson benchmark are complete.

`deploy.sh` is the host-side deploy entrypoint used by GitHub Actions after a
merge to `main`. It downloads the repository tarball, preserves the
host-managed `.env` and secrets, rebuilds the app image, and recreates the app
and scheduler containers.

`cloudflared-ingress.example.yml` documents the required public and private
hostnames. The generator hostname must be protected by Cloudflare Access or a
private WARP/VPN route before it is published.

The GitHub workflow requires repository secrets `MBPROD_HOST`, `MBPROD_USER`,
`MBPROD_SSH_KEY`, and `MBPROD_GITHUB_TOKEN`. The SSH key is intentionally not
generated or committed by this repository; install its public half in the
`macie` account on `mbprod` and store only the private half in GitHub Actions.
