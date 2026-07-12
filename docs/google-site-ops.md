# Google Search Console i GA4

## Uwierzytelnianie

Dla Pseudointelektu używamy lokalnego OAuth użytkownika, nie service account.
Poświadczenia pozostają poza repozytorium:

```bash
export GOOGLE_OAUTH_CLIENT_JSON=/home/macie/skysysnet-growth-os/.secrets/google-oauth-client.json
export GOOGLE_OAUTH_TOKEN_JSON=/home/macie/skysysnet-growth-os/.secrets/google-token.json
```

Token użytkownika ma zakresy:

- `https://www.googleapis.com/auth/webmasters.readonly`
- `https://www.googleapis.com/auth/analytics.readonly`
- `https://www.googleapis.com/auth/webmasters`
- `https://www.googleapis.com/auth/analytics.edit`

## Audyt Pseudointelektu

```bash
node ~/.codex/skills/google-site-ops/scripts/google-site-ops.mjs \
  searchconsole:list-sites

node ~/.codex/skills/google-site-ops/scripts/google-site-ops.mjs \
  searchconsole:inspect \
  --site sc-domain:pseudointelekt.pl \
  --url https://pseudointelekt.pl/

node ~/.codex/skills/google-site-ops/scripts/google-site-ops.mjs \
  searchconsole:query \
  --site sc-domain:pseudointelekt.pl \
  --days 28

node ~/.codex/skills/google-site-ops/scripts/google-site-ops.mjs \
  ga4:list-streams --property properties/536130452

node ~/.codex/skills/google-site-ops/scripts/google-site-ops.mjs \
  ga4:report --property properties/536130452 --days 28
```

Aktualna właściwość GA4 Pseudointelektu to `properties/536130452`, a strumień
webowy używa `G-WTSC0BFN20`.

## Zgłoszenie sitemap

Sitemapę zgłaszamy pod adresem:

`https://pseudointelekt.pl/sitemap-index.xml`

Operacja wymaga zakresu zapisu `https://www.googleapis.com/auth/webmasters`.
Jeśli token zwróci `ACCESS_TOKEN_SCOPE_INSUFFICIENT`, uruchom:

```bash
node ~/.codex/skills/google-site-ops/scripts/google-site-ops.mjs auth:url
```

Otwórz URL w przeglądarce, zaakceptuj zakresy, skopiuj kod z przekierowania i
wymień token:

```bash
node ~/.codex/skills/google-site-ops/scripts/google-site-ops.mjs \
  auth:exchange --code '<code-z-przekierowania>'

node ~/.codex/skills/google-site-ops/scripts/google-site-ops.mjs \
  searchconsole:submit-sitemap \
  --site sc-domain:pseudointelekt.pl \
  --sitemap https://pseudointelekt.pl/sitemap-index.xml
```

Nie przenosimy tokenów, kluczy OAuth ani danych logowania do repozytorium,
Workera ani zmiennych publicznego frontendu.
