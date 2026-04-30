# Streamowanie generowania artykułu

Nowy mechanizm pozwala śledzić postęp tworzenia wpisu w czasie rzeczywistym za pomocą Server-Sent Events.

## Endpoint

```
GET /api/generate-stream
```

Odpowiedzią jest strumień `text/event-stream`. Każda wiadomość to obiekt JSON zawierający przynajmniej pole `log`. Dodatkowe pola mogą przekazywać:

- `stage` – aktualny etap pipeline, obecny w zdarzeniach streamu;
- `generationConfig` – bezpieczną konfigurację uruchomienia: tryb ręczny/auto, dostawcę tekstu, pipeline `sectioned`/`one-shot`, modele tekstu i obrazu, parametry sekcji oraz jakość obrazu;
- `recentTitles` – listę pobranych tytułów;
- `prompt` / `response` – pełny prompt i odpowiedź z każdego etapu;
- w razie problemów: `outline-error`, `write-error` lub `repair-error` z polami `error`, `prompt`, `response`;
- `failed`, `errorCode`, `errorTitle`, `errorMessage`, `stage` – ustrukturyzowany błąd kończący generowanie;
- `awaitingTopic` – jeśli `true`, skrypt czeka na wybór tematu;
- `articleTitle` – tytuł wygenerowanego artykułu;
- `heroPrompt` – prompt użyty do stworzenia obrazka.

Po zakończeniu wysyłany jest obiekt `{ done: true, url: '<link do PR>' }`.

Gdy OpenAI zwróci błąd wskazujący na brak środków, limit billingowy albo wyczerpany kredyt, strumień zwraca `errorCode: "OPENAI_BILLING_QUOTA_EXCEEDED"`. Ten przypadek wysyła też osobny alert na Slacka z etapem, kodem błędu i kontekstem Access użytkownika, bez ujawniania sekretów.

Jeśli pojawi się pole `awaitingTopic`, proces czeka na wysłanie wybranego tematu pod
endpoint `POST /api/update-prompt` w formacie `{ "topic": "wybrany temat" }`.

## Podstrona `generuj.html`

W katalogu `public/` dodano dashboard, który łączy się z powyższym strumieniem, pokazuje konfigurację uruchomienia, oś etapów, log streamu, wybór tematu, konspekt/walidację oraz prompt/odpowiedź modelu. Użytkownik wybiera temat spośród propozycji lub wpisuje własny i potwierdza przyciskiem.

Dashboard przed uruchomieniem `EventSource` robi preflight przez `GET /api/get-prompt?preflight=1`, czyli endpoint objęty tą samą aplikacją Cloudflare Access co generowanie. Jeśli Cloudflare Access wymaga osobnej sesji dla `/api/*`, panel pokazuje przycisk autoryzacji API zamiast zgłaszać ogólny błąd połączenia SSE.

```
const es = new EventSource('/api/generate-stream');
es.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  // msg.log zawiera aktualny etap
};
```

## Zmiany w kodzie

- `src/worker.ts` obsługuje teraz nowy endpoint i zwraca `TransformStream` z danymi.
- `generateAndPublish()` przyjmuje opcjonalny kontroler i korzysta z funkcji `controller.enqueue()` do przesyłania logów.
- Stary endpoint `/api/generate-article` został usunięty.

## Jak korzystać

1. Uruchom lokalnie `npm run dev`.
2. Otwórz `http://localhost:8787/generuj.html` (port zależy od konfiguracji wranglera).
3. Obserwuj logi i poczekaj na link do pull requesta.

Podstrona `generuj.html` przesyła teraz własne zdarzenia pod endpoint `POST /api/client-log`,
dzięki czemu wszystkie akcje z przeglądarki trafiają do bazy D1.

## Etapy (log)
Najczęściej zobaczysz kolejno:
- `suggest-topic-*` (opcjonalnie) – propozycje tematów,
- `outline-*` – konspekt (outline),
- `write-*` – one-shot generacja finalnej treści (JSON `{ markdown, title, description }`),
- `sectioned-write-*` – sekcyjne generowanie artykułu, używane automatycznie dla Jetsona albo po wymuszeniu `TEXT_ARTICLE_PIPELINE=sectioned`,
- `repair-*` – pojawia się tylko, gdy walidacja wykryje błąd (max 2 próby),
- publikacja na GitHub + link do PR.
