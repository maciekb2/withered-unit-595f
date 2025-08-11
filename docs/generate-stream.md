# Streamowanie generowania artykułu

Nowy mechanizm pozwala śledzić postęp tworzenia wpisu w czasie rzeczywistym za pomocą Server-Sent Events.

## Endpoint

```
GET /api/generate-stream
```

Odpowiedzią jest strumień `text/event-stream`. Każda wiadomość to obiekt JSON zawierający przynajmniej pole `log`. Dodatkowe pola mogą przekazywać:

- `recentTitles` – listę pobranych tytułów;
- `prompt` / `response` – pełny prompt i odpowiedź z każdego etapu;
- w razie problemów: `outline-error`, `draft-error`, `edit-error` lub `proofread-error` z polami `error`, `prompt`, `response`;
- `awaitingTopic` – jeśli `true`, skrypt czeka na wybór tematu;
 - `articleTitle` – tytuł wygenerowanego artykułu;
 - `heroPrompt` – prompt użyty do stworzenia obrazka.

Po zakończeniu wysyłany jest obiekt `{ done: true, url: '<link do PR>' }`.

Jeśli pojawi się pole `awaitingTopic`, proces czeka na wysłanie wybranego tematu pod
endpoint `POST /api/update-prompt` w formacie `{ "topic": "wybrany temat" }`.

## Podstrona `generuj.html`

W katalogu `public/` dodano prostą stronę, która łączy się z powyższym strumieniem i wypisuje wszystkie logi. Użytkownik wybiera temat spośród propozycji lub wpisuje własny i potwierdza przyciskiem.

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
