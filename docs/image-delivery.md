# Article image delivery

Production runs on private RKE2, built from the Flux GitRepository artifact.
Flux excludes PNG, JPEG and GIF by default. The root `.sourceignore` must
explicitly retain those files under `public/`.

On 2026-09-11, the active source revision `9aff4fe` contained article PNGs,
but the runtime image `6c3ca6a212b32786c674bb499c427a5f5f98efcb52b368d46a65215e1b64a4e1`
had only 94 WebP files in `dist/client/blog-images`. The August 31 image
returned 404 directly on port 3000 as well as through the public domain.

`npm run build:node` now checks every local frontmatter hero image before
building and again against `dist/client`. A missing source asset fails the
release even when Astro can render the article HTML successfully.

Release through the existing ApplicationRelease and Flux image automation.
Verify the source revision, image digest, runtime readiness and image HTTP
responses. Cloudflare may retain earlier 404 responses, so verify both the
canonical URL and a fresh query string after rollout.

The first repaired candidate passed validation but Trivy blocked promotion on
GHSA-rgj7-g3m4-5g8c: two transitive Cloudflare tool dependencies retained
`sharp@0.35.2`. The package override uses the existing patched `sharp@0.35.4`
for all consumers; the lockfile removes only duplicate vulnerable Sharp and
libvips packages. The release scan remains enforced.
