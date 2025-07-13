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
Plik `src/prompt/article-content.txt` definiuje prompt dla OpenAI. Edytuj go, aby dostosować generowane wpisy.
Szablon wykorzystuje placeholder `{recent_titles}`, który zostaje zastąpiony listą
pięciu ostatnich tytułów w celu uniknięcia powtarzania tematów.

### Automatyczne generowanie nowych wpisów
Moduły w katalogu `src/modules` pozwalają na wygenerowanie treści artykułu oraz hero obrazka z wykorzystaniem API OpenAI. Przykładowe prompty znajdują się w `src/prompt/article-content.txt` oraz `src/prompt/hero-image.txt`.

Hero obrazy są generowane przez model DALL·E 3. Funkcja `generateHeroImage()` przyjmuje opcjonalne parametry `style` i `quality`, które domyślnie ustawiono na `vivid` i `hd`, aby uzyskać wyraźny efekt zbliżony do tego w ChatGPT.

Do złożenia i zacommitowania wpisu służy skrypt `scripts/publish-article.ts` uruchamiany przez `tsx`:

```bash
npx tsx scripts/publish-article.ts
```

Skrypt pobiera klucz `OPENAI_API_KEY` z zmiennych środowiskowych, zapisuje pliki w odpowiednich katalogach, a następnie wykonuje commit do repozytorium.
Wygenerowane wpisy są automatycznie publikowane na gałęzi `main` w repozytorium określonym przez `GITHUB_REPO`.

Możliwe jest też wygenerowanie wpisu poprzez endpoint Workers:


```
GET /api/generate-article
```

Po każdej publikacji Worker wysyła powiadomienie na Slacka zawierające
początek artykułu oraz link do utworzonego pull requesta na GitHubie.
Pozwala to szybko zaakceptować zmiany.

Domyślnie w przeglądarce pojawi się strona z komunikatem „Trwa generowanie artykułu” wraz z logami postępu. Po zakończeniu nastąpi przekierowanie na nowo utworzony wpis. Jeśli potrzebny jest surowy JSON z wynikiem, należy wysłać zapytanie z nagłówkiem `Accept: application/json`.

## Logowanie zdarzeń

Logi są teraz zapisywane w bazie **D1** o nazwie `pseudointelekt_logs`. Tabela `logs` posiada kolumny:

- `id` – automatyczny identyfikator,
- `time` – czas zdarzenia,
- `worker_id` – identyfikator workera,
- `data` – pełny zapis zdarzenia w formacie JSON.

Aby utworzyć bazę wykonaj:

```bash
wrangler d1 create pseudointelekt_logs
```

Otrzymany `database_id` wpisz w pliku `wrangler.json` w sekcji `d1_databases` (w tym repo to `c290edf1-394f-4c8b-940c-da62db2774b1`).
W sekcji `vars` ustaw `WORKER_ID` na `pseudointelekt2137-blog`, który będzie wstawiany do kolumny `worker_id`.

Przykładowe zapytanie HTTP zostanie zapisane w kolumnie `data` jako JSON podobny do poniższego:

```json
{
  "time": "2024-05-06T12:34:56.000Z",
  "method": "GET",
  "path": "/about",
  "ip": "203.0.113.42",
  "country": "PL",
  "referer": "https://google.com"
}
```
