# Proces generowania artykułu

Ten projekt automatyzuje tworzenie satyrycznych wpisów na bloga. Poniżej opisano pełną ścieżkę, parametry zapytań do OpenAI oraz najważniejsze reguły walidacji.

## 1. Gorące tematy i wybór wątku
1. Pobierz tytuły ostatnich artykułów z GitHuba.
2. `getHotTopics()` zbiera wiadomości z RSS (BBC, Politico, PAP, Reuters). Lista jest wysyłana w logu SSE `🔥 Gorące tematy z ostatnich dni`.
3. `suggestArticleTopic()` (temperature 0.7, top_p 0.9, max_tokens 600) proponuje satyryczne tematy na podstawie gorących newsów i ostatnich wpisów. Użytkownik wybiera jedną z propozycji lub podaje własny temat bazowy.

## 2. Outline
`generateOutline(baseTopic)` przygotowuje strukturę artykułu:
- używa `chat()` z guardrails (temperature 0.3, top_p 0.9, max_tokens 800),
- zwraca `finalTitle`, `description` i 4–6 sekcji po 2–5 bulletów,
- opis ≤200 znaków, bez znaków markdown; tytuł ≤100 znaków,
- guardrails zawsze zawierają m.in. zakaz raportów bez źródła i ostrożność przy liczbach.

## 3. Draft
`generateDraft(outline, articlePrompt)` tworzy szkic:
 - korzysta z `chat()` (temperature 0.6, top_p 0.9, max_tokens 1200) z wklejonym outline oraz regułami,
 - każdy bullet rozwijany jest w spójny akapit liczący około 10–20 linijek (≥8 zdań),
 - niepewne dane oznaczane są tokenem `[[TODO-CLAIM]]`.

## 4. Edit
`editDraft(draft, outline)` wygładza tekst:
 - `chat()` z niską temperaturą 0.2 (top_p 0.9, max_tokens 1000),
 - nie zmienia tytułu ani opisu, dba o spójne akapity 10–20 linijek,
 - `scrubTodoClaims()` zastępuje zdania z `[[TODO-CLAIM]]` neutralnym uogólnieniem.

## 5. Proofread
`proofread(edited)` sprawdza gramatykę i styl:
- `chat()` z temperaturą 0.2 (top_p 0.9, max_tokens 1000),
- weryfikuje tytuł, opis i treść, nie zmieniając sensu,
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
