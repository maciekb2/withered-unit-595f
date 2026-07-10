# Migration providerów generowania

Ten dokument opisuje kolejny etap po zamknięciu pierwotnego backlogu technicznego:

- tekst artykułów ma przejść na tokenowo autoryzowany gateway na domowym Jetsonie;
- obrazki hero mają przejść na nowszy, konfigurowalny model z powtarzalnym stylem.

## Stan obecny

Tekst jest generowany przez `src/pipeline/openai.ts`, które woła OpenAI Chat Completions:

- `generateOutline`
- `writeArticle`
- `repairEdited`
- starsze ścieżki `generateDraft` / `editDraft`

Obrazki hero są generowane przez `src/modules/heroImageGenerator.ts`, a model i koszt jakości są teraz konfigurowalne przez:

- `OPENAI_IMAGE_MODEL`
- `OPENAI_IMAGE_SIZE`
- `OPENAI_IMAGE_STYLE`
- `OPENAI_IMAGE_QUALITY`

## Docelowy kontrakt tekstu

Gateway Jetsona powinien być traktowany jako osobny provider tekstu, a OpenAI powinno zostać fallbackiem do czasu pełnej weryfikacji.

Planowane zmienne:

- `TEXT_GENERATION_PROVIDER`: `openai` albo `jetson`
- `JETSON_GATEWAY_URL`: publiczny URL gatewaya przez domenę Cloudflare, obecnie `https://jetson.senara-system.xyz`; nie używać prywatnego adresu ani lokalnego WARP jako produkcyjnego endpointu Workera
- `JETSON_GATEWAY_TOKEN`: sekret Workera, nigdy wpisywany do repo
- `JETSON_GATEWAY_MODEL`: domyślnie model zweryfikowany na gatewayu
- `JETSON_GATEWAY_TIMEOUT_MS`: twardy timeout na jeden request
- `JETSON_GATEWAY_DISABLE_THINKING`: przełącznik dla modeli, które potrafią wypisywać widoczne rozumowanie

Oczekiwany transport do zweryfikowania przed przełączeniem produkcji:

- endpoint gatewaya: `/api/generate` pod domeną `https://jetson.senara-system.xyz`
- autoryzacja: `Authorization: Bearer <JETSON_GATEWAY_TOKEN>`
- Cloudflare Access/service headers, jeśli gateway wymaga ich oprócz bearer tokenu
- payload zawiera `model`, `messages`, limit tokenów i opcjonalny wymóg JSON
- odpowiedź musi dać się sprowadzić do jednego tekstu bez widocznego rozumowania

Nie wolno zapisywać tokenu, raw sekretów ani surowego stanu autoryzacji w dokumentach, logach lub backlogu.

## Wymagania dla adaptera tekstu

Adapter providerów powinien zachować obecny kontrakt `chat()`:

- wejście: `messages`, `model`, `max_completion_tokens`, `response_format`, `response_style`
- wyjście: `Promise<string>`
- logi audytowe nadal zapisują prompty, odpowiedzi, model, użyty provider i kontekst Access
- błędy muszą zawierać provider i status, ale bez tokenów i nagłówków autoryzacyjnych
- timeout i błąd gatewaya powinny przełączyć na OpenAI tylko wtedy, gdy `TEXT_GENERATION_FALLBACK=openai`

Minimalny bezpieczny rollout:

1. Dodać provider abstraction bez zmiany domyślnego provideru. Status: zrobione, domyślnie `TEXT_GENERATION_PROVIDER=openai`.
2. Dodać testy adaptera dla OpenAI i Jetsona na mockowanym `fetch`. Status: zrobione w `src/pipeline/openai.test.ts`.
3. Dodać sekrety Workera dla Jetsona.
4. Zweryfikować gateway z laptopa i potem przez Worker dry-run/smoke path.
5. Dopiero wtedy przełączyć `TEXT_GENERATION_PROVIDER=jetson`.

## Implementacja adaptera

Adapter tekstu jest spięty przez `textGenerationProviderFromEnv(env)` w `src/pipeline/openai.ts`.

- Domyślny provider to OpenAI, więc aktualna produkcja nie zmienia zachowania.
- Provider `jetson` wysyła request na `/api/generate` z bearer tokenem i timeoutem.
- Jeśli `TEXT_GENERATION_FALLBACK=openai`, błąd gatewaya przełącza pojedyncze wywołanie na OpenAI.
- `TEXT_GENERATION_FALLBACK_MODEL` wybiera model używany po awarii Jetsona; obecny tymczasowy fallback to `gpt-5.5`.
- Jeśli `TEXT_GENERATION_FALLBACK=none`, błąd gatewaya przerywa generowanie.
- Logi zapisują provider, model, status i host gatewaya, ale nie zapisują tokenów.

## Architektura artykułów pod mały model

Jetson nie powinien dostawać zadania "napisz cały artykuł naraz". Docelowy tryb dla `TEXT_GENERATION_PROVIDER=jetson` to etapowy pipeline:

1. `generateOutline` tworzy krótki plan, finalny tytuł, opis/lead i trzy sekcje.
2. Kod używa opisu z outline jako leadu. To celowo pomija osobne wywołanie leadu, bo `qwen3:4b` potrafił wtedy wypisywać analizę promptu zamiast prozy.
3. `writeArticleSectioned` pisze każdą sekcję osobno, przekazując:
   - cały outline,
   - aktualną sekcję i jej tezy,
   - skrócony tekst poprzednich sekcji,
   - style guide,
   - context pack z tematem i źródłem.
4. Kod składa artykuł deterministycznie: tytuł, opis, lead, sekcje `## ...`.
5. Tylko jedno źródło URL jest dokładane deterministycznie w leadzie, żeby walidator nie musiał walczyć z nadmiarowymi linkami.
6. Standardowy walidator i ewentualny repair zostają jako bramka jakości.

Przełączniki:

- `TEXT_TOPIC_SELECTION=auto`: dla Jetsona pomija LLM-ową sugestię tematu w cron/auto i bierze pierwszy temat RSS; dla OpenAI zostawia dawną sugestię LLM.
- `TEXT_TOPIC_SELECTION=rss-first`: zawsze pomija LLM-ową sugestię tematu w cron/auto.
- `TEXT_TOPIC_SELECTION=llm`: wymusza dawny etap `topicSuggester` także w cron/auto.
- `TEXT_ARTICLE_PIPELINE=auto`: używa trybu sekcyjnego automatycznie dla Jetsona, a one-shot dla OpenAI.
- `TEXT_ARTICLE_PIPELINE=sectioned`: wymusza etapowy tryb także dla OpenAI/testów.
- `TEXT_ARTICLE_PIPELINE=one-shot`: zostawia starą ścieżkę `writeArticle`.
- `TEXT_SECTION_PARAGRAPHS`: liczba akapitów na sekcję, domyślnie `3`.
- `TEXT_SECTION_MAX_TOKENS`: limit tokenów na pojedyncze wywołanie sekcji, domyślnie `1800`.

## Docelowy kontrakt obrazów

Obrazki powinny dostać jawny model w konfiguracji:

- `OPENAI_IMAGE_MODEL`
- `OPENAI_IMAGE_SIZE`
- `OPENAI_IMAGE_QUALITY`
- `OPENAI_IMAGE_STYLE`

Domyślny styl jest spójny z panelem Situation Room: czysta ilustracja redakcyjna 3:2, jedna metafora, ograniczona paleta zieleni, turkusu, kości słoniowej i starego złota, bez tekstu, wizualnego szumu, groteskowych karykatur i stereotypów.

Implementacja zostawia obrazy w OpenAI API i ustawia `OPENAI_IMAGE_MODEL=gpt-image-1-mini`, poziomy rozmiar `1536x1024` oraz `OPENAI_IMAGE_QUALITY=medium`. Styl jest trzymany w promptcie, a nie w legacy parametrze DALL-E.

OpenAI docs wskazują `gpt-image-1-mini` jako kosztową wersję GPT Image, więc to jest preferowany fallback kosztowy zamiast wracania do legacy DALL-E.

## Blokery przed przełączeniem

Na tym etapie trzeba jeszcze odświeżyć live informacje o gatewayu Jetsona. Podczas rozpoczęcia migracji WARP był połączony, ale SSH do `jetson-home` (`192.168.1.41:22`) zakończył się timeoutem. Przed implementacją przełączenia tekstu trzeba sprawdzić:

- aktywny publiczny URL gatewaya przez domenę `https://jetson.senara-system.xyz`, nie prywatny adres WARP;
- aktualny domyślny model;
- dokładny payload `/api/generate`;
- wymagane nagłówki do wyłączenia widocznego rozumowania;
- gdzie bezpiecznie pobrać i ustawić token jako sekret Workera.
