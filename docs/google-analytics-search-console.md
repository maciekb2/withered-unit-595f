# Google Analytics 4 and Search Console operations

This site already has Google Consent Mode v2 in `src/components/BaseHead.astro`.
GA4 is loaded only when `GA4_MEASUREMENT_ID` in `src/consts.ts` is set and the visitor grants analytics consent.
Search Console HTML verification can be exposed by setting `GOOGLE_SITE_VERIFICATION` in `src/consts.ts`.

The operational API integration is intentionally local-only. Do not put Google credentials into Cloudflare Worker secrets, GitHub repository variables, or tracked files.

## Google Cloud setup

1. Create or choose a Google Cloud project for site operations.
2. Enable these APIs:
   - Google Analytics Admin API
   - Google Analytics Data API
   - Google Search Console API
3. Create a service account for read/automation tasks, or use OAuth user credentials for account creation and ownership flows that require an interactive owner.
4. Store service-account JSON outside git, for example `secrets/google-site-ops.json`. Files matching `secrets/google*.json` are ignored.
5. Grant the service account access:
   - In GA4, add the service account email to the Analytics account/property with the role needed for the operation.
   - In Search Console, add the service account as owner/full user after the property has been verified by a real owner.

Domain properties such as `sc-domain:pseudointelekt.pl` are better verified with DNS and then managed through API access. URL-prefix properties such as `https://pseudointelekt.pl/` can also use the existing HTML meta placeholder.

## Site map

Copy `config/google-sites.example.json` to `config/google-sites.local.json` when you want a local inventory for this and other sites.
The local file is ignored and can contain live GA4 property IDs, Search Console property names, and verification tokens.

## Commands

Set credentials for the current shell:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="$PWD/secrets/google-site-ops.json"
```

or:

```bash
export GOOGLE_SERVICE_ACCOUNT_JSON="$(cat secrets/google-site-ops.json)"
```

List Search Console properties:

```bash
npm run google:site-ops -- searchconsole:list-sites
```

Add a URL-prefix Search Console property to the authenticated account:

```bash
npm run google:site-ops -- searchconsole:add-site --site https://pseudointelekt.pl/
```

Submit the sitemap:

```bash
npm run google:site-ops -- searchconsole:submit-sitemap --site https://pseudointelekt.pl/ --sitemap https://pseudointelekt.pl/sitemap-index.xml
```

Inspect the home URL in Google's index:

```bash
npm run google:site-ops -- searchconsole:inspect --site https://pseudointelekt.pl/ --url https://pseudointelekt.pl/
```

List GA4 accounts, properties, and web streams:

```bash
npm run google:site-ops -- ga4:list-accounts
npm run google:site-ops -- ga4:list-properties --account accounts/123456
npm run google:site-ops -- ga4:list-streams --property properties/987654321
```

Create a GA4 property and web stream when the authenticated principal has enough rights:

```bash
npm run google:site-ops -- ga4:create-property --account accounts/123456 --display-name pseudointelekt.pl --time-zone Europe/Warsaw --currency PLN
npm run google:site-ops -- ga4:create-web-stream --property properties/987654321 --display-name pseudointelekt.pl --url https://pseudointelekt.pl/
```

After a web stream exists, put the returned `G-...` value into `GA4_MEASUREMENT_ID`, deploy, and test with consent granted.

Run a basic GA4 Data API report:

```bash
npm run google:site-ops -- ga4:report --property properties/987654321 --days 28
```

## Operational notes

- Keep Google credentials operator-side. The public site only needs the GA4 measurement ID and optional Search Console verification meta token.
- For multiple sites, use `config/google-sites.local.json` as the local inventory and run the same script with site-specific arguments.
- Prefer DNS verification for domain properties. It avoids redeploying the site just to prove Search Console ownership.
- GA4 creation and Search Console ownership may require a user who can accept Google terms or verify ownership interactively; service accounts are best once access has been granted.
