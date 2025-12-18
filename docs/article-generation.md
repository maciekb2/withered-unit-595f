# Generowanie artykułów – ścieżki ręczna, automatyczna i CLI

| Etap / element | Manual (SSE w przeglądarce) | Automatyczny (CRON) | Manual CLI |
| --- | --- | --- | --- |
| Start | `GET /api/generate-stream` z `src/worker.ts` | `src/cron-worker.ts` (wywołuje `generateAndPublish` wg crona w `wrangler.json`) | `scripts/publish-article.ts` |
| Pobranie ostatnich tytułów | `getRecentTitlesFromGitHub` | `getRecentTitlesFromGitHub` | `getRecentTitlesFS` |
| Gorące tematy (RSS) | `getHotTopics` | `getHotTopics` | (nie używa) |
| Sugestia tematu | `topicSuggester` (opcjonalnie; można wpisać własny) | `topicSuggester` (auto wybór) | (pomija; temat z `baseTopic` jeśli podany) |
| Konspekt (outline) | `generateOutline` (+ context JSON) | `generateOutline` (+ context JSON) | `generateOutline` |
| Generacja finalna (write) | `writeArticle` (one-shot JSON) | `writeArticle` (one-shot JSON) | `writeArticle` (one-shot JSON) |
| Walidacja | `validateAntiHallucination` | `validateAntiHallucination` | `validateAntiHallucination` |
| Naprawa (tylko przy błędzie) | `repairEdited` (max 2 próby) | `repairEdited` (max 2 próby) | `repairEdited` (max 2 próby) |
| Format końcowy | `formatFinal` | `formatFinal` | `formatFinal` |
| Obrazek hero | `generateHeroImage` | `generateHeroImage` | `generateHeroImage` |
| Publikacja | `publishArticleToGitHub` (branch + PR) | `publishArticleToGitHub` (branch + PR) | `assembleArticle` (zapis do `src/content/blog` + `public/blog-images`, lokalny `git add/commit`) |
| Powiadomienie | Slack webhook (`sendSlackMessage`) | Slack webhook (`sendSlackMessage`) | brak |
| Logowanie/telemetria | SSE strumień + `logEvent/logError` | `logEvent/logError` | `logEvent/logError` |

## Gdzie ścieżki się łączą
- Ręczna (SSE) i automatyczna (CRON) łączą się natychmiast w `generateAndPublish` – ten sam pipeline od konspektu po PR i Slack.
- CLI używa tego samego pipeline’u tekstu i obrazka (`generateArticleAssets` → outline/write/validate/repair/format/hero), rozchodzi się dopiero w publikacji: lokalny zapis (`assembleArticle`) zamiast PR (`publishArticleToGitHub`).

## Kluczowe pliki
- Orkiestracja: `src/modules/generateAndPublish.ts`, `src/worker.ts`, `src/cron-worker.ts`, `scripts/publish-article.ts`.
- Prompty: `src/prompt/article-write.txt`, `src/prompt/article-repair.txt`, `src/prompt/style-guide.txt`, `src/prompt/hero-image.txt`.
- Pipeline treści: `src/pipeline/{outline,write,repair,format}.ts`, `src/pipeline/validators/content.ts`, `src/pipeline/contextPack.ts`, `src/pipeline/openai.ts`.
- Publikacja/FS: `src/modules/{githubPublisher,articleAssembler}.ts`, `src/utils/{validators,slugify}.ts`.
- Kontekst: `src/utils/{hotTopics,recentTitlesGitHub,recentTitlesFs}.ts`, `src/utils/{logger,retryFetch,slack}.ts`.

## Kontekst (bez zwiększania tokenów “style samples”)
Kontekst jest podawany jako krótki JSON (tzw. context pack) i służy głównie do:
- podania wybranego tematu (`selectedTopic`) i jego krótkiego opisu z RSS (`description`);
- wskazania jedynego dozwolonego linku (`leadSourceUrl`) – URL do źródła tematu.

Context pack jest dołączany do:
- outline (`generateOutline`) jako dodatkowy blok “Kontekst (JSON)”;
- write/repair (`writeArticle` / `repairEdited`) jako “KONTEKST (JSON)”.

## Reguła linków i walidacja
Walidator `validateAntiHallucination` wymusza teraz:
- **dokładnie 1 URL w całym artykule** (ERROR gdy 0 lub >1),
- brak `[[TODO-CLAIM]]` (ERROR),
- obecność wszystkich sekcji z outline (ERROR),
- statystyki/raporty bez URL w tym samym zdaniu są raportowane jako WARN (nie blokują publikacji).

## CLI: sterowanie tematem i linkiem
`scripts/publish-article.ts` umożliwia ustawienie:
- `BASE_TOPIC` – temat bazowy dla outline,
- `LEAD_SOURCE_URL` – URL źródła tematu (jeśli nie podany, używany jest fallback i logowane jest ostrzeżenie).
