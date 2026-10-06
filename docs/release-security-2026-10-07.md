# Release security repair — 2026-10-07

The reviewed October 3–6 content is merged in PR290 (04d4ce861a02e0cb9602b5262b3f298c976442a2). Its first delivery encountered node pod capacity, then failed the mandatory Trivy scan. The owner reports capacity increased; live home-mb-dev allocatable is 160. This repair does not alter node configuration or article content.

The scan reported HIGH/CRITICAL findings in runtime libpcre2-8-0, perl-base and source-map-js. Install current Debian security packages during image construction, require libpcre2-8-0 >= 10.42-1+deb12u2 and perl-base >= 5.36.0-7+deb12u4, and lock source-map-js at 1.2.2 throughout the dependency tree. Existing libexpat minimum, TLS verification, immutable base and mandatory image scan remain enforced.

Sources: Debian security tracker https://security-tracker.debian.org/tracker/source-package/pcre2 and https://security-tracker.debian.org/tracker/source-package/perl; package release https://www.npmjs.com/package/source-map-js?activeTab=versions.

Acceptance requires npm run check, PR CI, a successful native image scan, Flux digest reconciliation and exact public acceptance for the four articles. The npm advisory audit is informational in existing CI; its unrelated findings are not evidence of a clean image. Only the mandatory Trivy gate can accept this runtime candidate.

Rollback: sha256:c585d2661acdace419471cd1a7c25c6e75b6fec42aab49e0d52f78c6636557ae (prior accepted release 73e59f5). No data migration, persistent storage, secret or scheduler changes.
