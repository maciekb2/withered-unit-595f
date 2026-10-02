# Security fixes for the September content release

The private release pipeline rejected source `889c0041f814de322d00da19b68641b81e4ec952`
after validation and build passed. Its HIGH/CRITICAL Trivy gate found fixed
vulnerabilities in libexpat1, devalue and undici. The rejected candidate was not
promoted; production retained its previous immutable digest.

## Narrow fixes

- Override devalue to 5.9.3, the scan's fixed version.
- Override only undici 7.29.0 to 7.29.1; retain the already patched 8.10.2 branch.
- Explicitly upgrade runtime libexpat1 and fail the build unless its version is
  at least Debian bookworm 2.5.0-1+deb12u4. This also invalidates the previous apt
  cache layer. Keep the pinned base image, HTTPS apt, non-root runtime and scan.

Upstream evidence: [undici release notes](https://github.com/nodejs/undici/releases),
[devalue advisory](https://github.com/advisories/GHSA-mcm9-63f2-9j32),
[Debian security package acceptance](https://tracker.debian.org/news/1805277/accepted-expat-250-1deb12u4-source-into-oldstable-security/).

## Verification and delivery

Run `npm ci`, `npm run ci:pr` and the exact-head PR CI. Merge the tested source,
then let the private ApplicationRelease validate, build and scan it. Require
successful scan and immutable GitOps promotion before production acceptance.
Record the actual source, digest, Flux revision, runtime imageIDs, database
readiness and public content/image verification in the owning infrastructure
release note. Generation stays disabled. No database, storage or secret changes
are part of this patch.
