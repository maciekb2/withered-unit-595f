# Geopolityczny Blog

Strona jest hostowana na Cloudflare Workers i rozwijana w Astro przy wsparciu Codexa. W planach jest mechanizm automatycznego generowania artykułów i hero zdjęć, tak aby maksymalnie zautomatyzować utrzymanie i zwiększyć zasięgi.

## Rozwój lokalny
- `npm install` – instalacja zależności
- `npm run dev` – uruchomienie serwera developerskiego
- `npm run build` – budowa wersji produkcyjnej
- `npm run deploy` – publikacja na Cloudflare

## Struktura projektu
- `src/pages/` – pliki `.astro` lub `.md` reprezentujące strony
- `src/components/` – komponenty Astro i frameworków UI
- `src/content/blog/` – artykuły w Markdown lub MDX
- `public/` – zasoby statyczne

### Dodawanie nowych artykułów
1. Skopiuj `src/content/blog/_template.md.sample` do nowego pliku, np. `twoj-tytul.md`.
2. Uzupełnij pola we front matter (`YYYY-MM-DD` i inne dane).
3. Dodaj treść w Markdown lub MDX i zacommituj – wpis pojawi się na stronie.

## Continuous deployment
Repozytorium zawiera workflow GitHub Actions (`.github/workflows/deploy.yml`) który buduje i deployuje witrynę po zmianach w gałęzi `main`.

### Secrets configuration
- `CF_API_TOKEN` – token API Cloudflare z uprawnieniami do Workers
- `CF_ACCOUNT_ID` – identyfikator konta Cloudflare

### Scheduled deployments
Workflow ma też trigger `schedule`:

```yaml
schedule:
  - cron: '0 3 * * *'
```

GitHub uruchamia automatyczny deploy codziennie o **03:00 UTC**, o ile włączone są scheduled workflows.

### Worker secrets
Przed deployem skonfiguruj sekrety dla `wrangler secret`:

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put GITHUB_TOKEN
wrangler secret put GITHUB_REPO
wrangler secret put SLACK_WEBHOOK_URL
```

### Konfiguracja bazy kontaktów
Utwórz przestrzeń Cloudflare KV do przechowywania wysłanych formularzy:

```bash
wrangler kv:namespace create pseudointelekt_contact_form
```
Następnie w pliku `wrangler.json` dodaj uzyskany `id` i `preview_id` w sekcji `kv_namespaces` pod nazwą `pseudointelekt_contact_form`.

Dodatkowo w sekcji `vars` umieść adres swojego webhooka Slack:

```json
  "vars": {
    "SLACK_WEBHOOK_URL": "<YOUR_SLACK_WEBHOOK_URL>"
  }
```

### Personalizacja promptu
Plik `src/prompt/blog-post.txt` definiuje prompt dla OpenAI. Edytuj go, aby dostosować generowane wpisy.
