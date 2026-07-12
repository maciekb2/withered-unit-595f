# Self-hosted runtime

This stack is the production target on `mbprod.s.sn`. Cloudflare remains the
public edge through a Tunnel; the application and PostgreSQL run locally.

The tunnel token and `.env` file are host-managed secrets and must never be
committed. Ollama is reached only over the DC network at `10.2.11.72:11434`.

The current Worker deployment remains the rollback target until the PostgreSQL
data migration and all API routes have been verified on the Node runtime.

This first scaffold deliberately does not switch production traffic: the Node
build currently exposes the public Astro pages and `/api/health`, while the
Worker remains the authoritative API for counters, contact, audit logging and
generation. The next cutover step is to port those routes to the PostgreSQL
repository before enabling the Tunnel for `pseudointelekt.pl`.
