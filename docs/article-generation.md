# Proces generowania artykułu

Ten projekt automatyzuje tworzenie satyrycznych wpisów na bloga. Poniżej opisano pełną ścieżkę, parametry zapytań do OpenAI oraz najważniejsze reguły walidacji.

## 1. Gorące tematy i wybór wątku
1. Pobierz tytuły ostatnich artykułów z GitHuba.
2. `getHotTopics()` zbiera wiadomości z RSS (BBC, Politico, PAP, Reuters). Lista jest wysyłana w logu SSE `🔥 Gorące tematy z ostatnich dni`.
3. `suggestArticleTopic()` (max_completion_tokens 2000, `response_style=brief`) proponuje satyryczne tematy na podstawie gorących newsów i ostatnich wpisów. Użytkownik wybiera jedną z propozycji lub podaje własny temat bazowy.

## 2. Outline
`generateOutline(baseTopic)` przygotowuje strukturę artykułu:
- używa `chat()` (model gpt-5) z jednoliniowymi guardrails, `max_completion_tokens` 2000, `response_style=normal` i `response_format=json_schema`,
- zwraca `finalTitle`, `description` i **4 sekcje** po **2–3 bulletów**,
- każdy bullet zawiera konkretną statystykę, datę lub nazwę raportu z wiarygodnym źródłem; w razie braku danych oznaczony jest `[[TODO-CLAIM]]`,
- opis ≤200 znaków, bez znaków markdown; tytuł ≤100 znaków,
- guardrails zawsze zawierają m.in. zakaz raportów bez źródła i ostrożność przy liczbach.

## 3. Draft
`generateDraft(outline, articlePrompt)` tworzy szkic:
 - korzysta z `chat()` (model gpt-5, max_completion_tokens 1200, `response_style=full`) z wklejonym outline oraz regułami,
 - każdy bullet rozwijany jest w spójny, profesjonalny akapit liczący około 12–20 linijek (≥10 zdań) z co najmniej jedną statystyką lub raportem wraz ze źródłem,
 - niepewne dane oznaczane są tokenem `[[TODO-CLAIM]]`.

## 4. Edit
`editDraft(draft, outline)` wygładza tekst:
 - `chat()` (model gpt-5, max_completion_tokens 1000, `response_style=full`),
 - nie zmienia tytułu ani opisu, dba o spójne akapity 12–20 linijek z rzetelnymi danymi i źródłami,
 - `scrubTodoClaims()` zastępuje zdania z `[[TODO-CLAIM]]` neutralnym uogólnieniem.

## 5. Proofread
`proofread(edited)` sprawdza gramatykę, styl i płynność całego tekstu:
 - `chat()` (model gpt-5, max_completion_tokens 1000, `response_style=full`),
- usuwa powtórzenia i nienaturalnie brzmiące frazy, przeredagowuje zdania tak, by tworzyły spójną narrację bez zmiany sensu,
- zwraca poprawiony tekst, który trafia do walidacji.

## 6. Walidacja treści
`validateAntiHallucination()` analizuje finalny markdown:
- raport bez źródła → błąd,
- twarde liczby bez kontekstu → ostrzeżenie,
- pozostawiony `[[TODO-CLAIM]]` → błąd,
- brak którejś sekcji z outline → błąd.

## 7. Format i publikacja
`formatFinal()` buduje `FinalJson` i sprawdza schema (`title` ≤100, `description` ≤200 i bez `#*_\``, `content` ≥500 znaków). `validateFinalJson()` dodatkowo escapu‑je pola dla YAML.

Po pozytywnej walidacji:
1. Generowany jest obrazek hero.
2. `publishArticleToGitHub()` wysyła plik `.md` i grafikę oraz tworzy PR.

W razie jakichkolwiek błędów proces przerywa się z czytelnym komunikatem SSE. Dzięki ujednoliconym parametrom `chat()` wszystkie zapytania do OpenAI korzystają z jednego schematu i tych samych mechanizmów guardrails.

## 8. Evidence i przypisy
Aby każda liczba i data miała potwierdzone źródło, model może korzystać z pętli
agentowej z funkcjami `search_web` i `fetch_url`.
1. **search_web(query, k)** – zwraca listę trafień `{url, title, snippet, date}`.
2. **fetch_url(url)** – pobiera treść artykułu `{url, title, text, date, source_type}`.

Po zebraniu źródeł model buduje strukturę:
```json
{
  "evidence": {
    "S1": {"url":"...","title":"...","date":"...","quotes":["..."]}
  },
  "draft": {
    "finalTitle": "...",
    "sections": [
      {"h2":"...","paragraphs":[{"text":"...","refs":["S1"]}]}
    ]
  },
  "bibliography": {
    "S1": {"url":"...","title":"...","date":"..."}
  }
}
```

Każde zdanie z liczbą, datą lub twardą tezą musi mieć referencję w `refs`.
Gdy brak pewnych danych, model używa `[[TODO-CLAIM]]` bez odnośnika. Po stronie
serwera prosty regex sprawdza, czy każda wzmianka o liczbie posiada `refs`
i w razie potrzeby prosi model o uzupełnienie. Przykładową implementację
agentowej pętli znajdziesz w `src/pipeline/evidence.ts`.
