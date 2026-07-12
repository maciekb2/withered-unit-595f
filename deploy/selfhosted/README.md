# Self-hosted runtime

This stack is the production target on `mbprod.s.sn`. Cloudflare remains the
public edge through a Tunnel; the application and PostgreSQL run locally.

The tunnel token and `.env` file are host-managed secrets and must never be
committed. Ollama is reached only over the DC network at `10.2.11.72:11434`.

The current Worker deployment remains the rollback target until the PostgreSQL
data migration and all API routes have been verified on the Node runtime.

The Node build now exposes the public Astro pages, PostgreSQL-backed engagement
and contact endpoints, and a private `/api/generate-stream` route. Set
`GENERATOR_PRIVATE_TOKEN` through Vault for the interim private route; the
production Tunnel should only expose that route after its VPN/private ingress
policy is configured. The Worker remains the rollback target until data parity
and the live Jetson benchmark are complete.
