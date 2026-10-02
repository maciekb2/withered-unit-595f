# Przegląd przed publikacją: 27 września – 2 października

Właściciel zlecił przegląd wszystkich nowych materiałów i publikację na produkcji. Zakres: sześć artykułów oraz sześć ilustracji z draft PR289. Nie obejmuje istniejącej partii 12–26 września ani zmian runtime, bazy lub harmonogramu.

## Ocena redakcyjna

Przeczytano wszystkie sześć tekstów. Każdy rozpoczyna wiadomość z konkretnego dnia, rozwija mechanizm, interesy stron, konsekwencje i dalszy etap. Są to analizy prasowe z ironicznym komentarzem, bez fikcyjnych wypowiedzi lub scen reportażowych. Fakty i datowany kontekst oddzielono od hipotetycznych przykładów. Nie przedstawiono postulatu jako obowiązującej reguły ani deklaracji jako osiągniętego rezultatu.

| Data | Forma i podtekst | Drobna korekta |
| --- | --- | --- |
| 27.09 | AI, wybór ofert i interes mieszkańców; wygoda rekomendacji kontra lokalna przepustowość | Usunięcie bliskiego powtórzenia o udziale mieszkańców |
| 28.09 | Zachęty dla producentów i faktyczna dostępność; komunikat nie zastępuje dostawy | Wyraźniejsza puenta o opakowaniu wydawanym pacjentowi |
| 29.09 | Zasady wsparcia przed finałem budżetu; modernizacja kontra zasoby | Puenta o morzu, które nie czyta wniosków |
| 30.09 | Przyspieszenie z wydłużonym terminem; kolejki i kompetencje | Techniczny komentarz zastąpiony konkretnym pytaniem o obsługę pozostałych spraw |
| 01.10 | Wspólny formularz i wykonanie; współpraca oraz kontrola | Zdanie o charakterze analizy zastąpione oceną rzeczywistych przeszkód i czynności |
| 02.10 | Deklarowany zapas i dostawa; remonty, produkty i odbudowa rezerw | Zdanie o charakterze analizy zastąpione rozróżnieniem dostawy oraz harmonogramu |

Szydera odnosi się do instytucji, komunikacji i mierników sukcesu. Nie obarcza pacjentów, migrantów, rybaków ani mieszkańców odpowiedzialnością za konstrukcję systemu. Zachowano granice prawne: brak prawa pobytu nie oznacza zagrożenia bezpieczeństwa; mandat negocjacyjny nie jest obowiązującym prawem. Nie sumuje się bez zastrzeżeń wcześniejszych i nowych deklaracji paliwowych.

## Źródła

Mapy źródeł i szczegółowe granice wykorzystania pozostają w `article-batch-2026-09-27-29.md` oraz `article-batch-2026-09-30-10-02.md`. Ponownie sprawdzono główne źródła ONZ i Rady z dat wpisów. Pakiet farmaceutyczny sprawdzono również w oficjalnym PDF z 28 września. Przy przejściowej odmowie dostępu do strony o G7 treść potwierdzono w [oficjalnej publikacji brytyjskiej z 2 października](https://www.gov.uk/government/news/g7-leaders-statement-on-global-energy-security-and-market-stability), zgodnej z oświadczeniem Rady. Frontmatter zachowuje pierwotny adres.

## Walidacja i decyzja

Po korektach liczba słów body: 1086 / 1076 / 1091 / 1170 / 1170 / 1192. Każdy tekst ma trzy H2 i dziewięć akapitów. Rzeczywiste walidatory jakości, final JSON i antyhalucynacji poprawne, jakość bez ostrzeżeń. `npm run check`: typy, audyt treści, 197/197 testów oraz build Node poprawne. 185 odwołań do ilustracji obecnych w źródle i buildzie. `git diff --check` poprawny.

Sześć ilustracji wcześniej sprawdzono wizualnie: paleta Situation Room, PNG RGB 1536×1024, bez ludzi, tekstu i logotypów. Nie zmieniano assetów. Po wydaniu należy sprawdzić publiczne treści, źródła i zdekodowane hashe wszystkich sześciu PNG, RSS, archiwum, tematy oraz health. Przegląd dopuszcza publikację po CI dla końcowego commita i skanie obrazu w prywatnym pipeline.
