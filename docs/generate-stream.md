# Streamowanie generowania artykułu

Nowy mechanizm pozwala śledzić postęp tworzenia wpisu w czasie rzeczywistym za pomocą Server-Sent Events.

## Endpoint

```
GET /api/generate-stream
```

Odpowiedzią jest strumień `text/event-stream`. Każda wiadomość to obiekt JSON zawierający przynajmniej pole `log`. Dodatkowe pola mogą przekazywać:

- `recentTitles` – listę pobranych tytułów;
- `articlePrompt` – domyślny prompt wysłany do przeglądarki;
- `awaitingPrompt` – jeśli `true`, skrypt czeka na edycję prompta;

- `articlePrompt` – finalny prompt wysłany do ChatGPT;

- `articleTitle` – tytuł wygenerowanego artykułu;
- `heroPrompt` – prompt użyty do stworzenia obrazka.

Po zakończeniu wysyłany jest obiekt `{ done: true, url: '<link do PR>' }`.

Jeśli pojawi się pole `awaitingPrompt`, skrypt zatrzymuje się i oczekuje na
wysłanie zmodyfikowanego prompta pod endpoint `POST /api/update-prompt` w
formacie `{ "prompt": "nowa treść" }`.

## Podstrona `generuj.html`

W katalogu `public/` dodano prostą stronę, która łączy się z powyższym strumieniem i wypisuje wszystkie logi. Strona wyświetla domyślny prompt w polu tekstowym i pozwala go edytować przed kontynuacją. Otwórz w przeglądarce `/generuj.html`, aby uruchomić proces i obserwować postęp.

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
