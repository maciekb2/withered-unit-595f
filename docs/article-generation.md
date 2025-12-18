# Generowanie artykułów – ścieżki ręczna, automatyczna i CLI

| Etap / element | Manual (SSE w przeglądarce) | Automatyczny (CRON) | Manual CLI |
| --- | --- | --- | --- |
| Start | `GET /api/generate-stream` z `src/worker.ts` | `src/cron-worker.ts` (wywołuje `generateAndPublish` wg crona w `wrangler.json`) | `scripts/publish-article.ts` |
| Pobranie ostatnich tytułów | `getRecentTitlesFromGitHub` | `getRecentTitlesFromGitHub` | `getRecentTitlesFS` |
| Gorące tematy (RSS) | `getHotTopics` | `getHotTopics` | (nie używa) |
| Sugestia tematu | `topicSuggester` (opcjonalnie; można wpisać własny) | `topicSuggester` (auto wybór) | (pomija; temat z `baseTopic` jeśli podany) |
| Konspekt (outline) | `generateOutline` | `generateOutline` | `generateOutline` |
| Szkic (draft) | `generateDraft` | `generateDraft` | `generateDraft` |
| Edycja | `editDraft` | `editDraft` | `editDraft` |
| Korekta | `proofread` | `proofread` | `proofread` |
| Walidacja anty-halucynacyjna | `validateAntiHallucination` | `validateAntiHallucination` | (pomija; rely on upstream steps) |
| Format końcowy | `formatFinal` | `formatFinal` | `formatFinal` |
| Obrazek hero | `generateHeroImage` | `generateHeroImage` | `generateHeroImage` |
| Publikacja | `publishArticleToGitHub` (branch + PR) | `publishArticleToGitHub` (branch + PR) | `assembleArticle` (zapis do `src/content/blog` + `public/blog-images`, lokalny `git add/commit`) |
| Powiadomienie | Slack webhook (`sendSlackMessage`) | Slack webhook (`sendSlackMessage`) | brak |
| Logowanie/telemetria | SSE strumień + `logEvent/logError` | `logEvent/logError` | `logEvent/logError` |

## Gdzie ścieżki się łączą
- Ręczna (SSE) i automatyczna (CRON) łączą się natychmiast w `generateAndPublish` – ten sam pipeline od konspektu po PR i Slack.
- CLI używa tego samego pipeline’u tekstu i obrazka (`generateArticleAssets` → outline/draft/edit/proofread/format/hero), rozchodzi się dopiero w publikacji: lokalny zapis (`assembleArticle`) zamiast PR (`publishArticleToGitHub`).

## Kluczowe pliki
- Orkiestracja: `src/modules/generateAndPublish.ts`, `src/worker.ts`, `src/cron-worker.ts`, `scripts/publish-article.ts`.
- Prompty: `src/prompt/article-content.txt`, `src/prompt/hero-image.txt`.
- Pipeline treści: `src/pipeline/{outline,draft,edit,proofread,format}.ts`, `src/pipeline/validators/content.ts`, `src/pipeline/prompts.ts`, `src/pipeline/openai.ts`.
- Publikacja/FS: `src/modules/{githubPublisher,articleAssembler}.ts`, `src/utils/{validators,slugify}.ts`.
- Kontekst: `src/utils/{hotTopics,recentTitlesGitHub,recentTitlesFs}.ts`, `src/utils/{logger,retryFetch,slack}.ts`.
