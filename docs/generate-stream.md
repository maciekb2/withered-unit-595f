# Streamowanie generowania artykułu

Nowy mechanizm pozwala śledzić postęp tworzenia wpisu w czasie rzeczywistym za pomocą Server-Sent Events.

## Endpoint

```
GET /api/generate-stream
```

Możesz opcjonalnie przekazać własny prompt w parametrze `prompt`:

```
GET /api/generate-stream?prompt=Twoj%20tekst
```

Odpowiedzią jest strumień `text/event-stream`. Każda wiadomość to obiekt JSON zawierający przynajmniej pole `log`. Po zakończeniu wysyłany jest obiekt `{ done: true, url: '<link do PR>' }`.

## Podstrona `generuj.html`

W katalogu `public/` znajduje się teraz strona pozwalająca edytować prompt przed startem generowania. Otwórz w przeglądarce `/generuj.html`, wpisz własny tekst i kliknij **Start**, aby obserwować postęp.

```
const es = new EventSource('/api/generate-stream?prompt=' + encodeURIComponent('Twój prompt'));
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
