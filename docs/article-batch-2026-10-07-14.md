# Pseudointelekt: artykuły 7–14 października 2026

## Zakres

Uzupełnienie jednego wpisu na każdy brakujący dzień do14października włącznie. Punkt wyjścia origin/main db51339d174ee9440dca716a66b7eb73954f1d04; poprzednia partia kończy się6października. Osiem nowych tekstów i osiem hero. Bez zmian aplikacji, zależności, bazy, storage, sekretów i schedulera. Właściciel: prywatny Pseudointelekt/maciekb2/withered-unit-595f. Praca w izolowanym worktree, bez publikowania WIP głównego checkoutu.

## Mapa i przegląd

| Dzień | Tytuł | Słowa body | Źródło |
| --- | --- | ---: | --- |
| 2026-10-07 | Dług dostaje pierwszeństwo. Szkoła może poczekać | 1072 | https://unctad.org/publication/world-of-debt |
| 2026-10-08 | Eurogrupa szuka oszczędności. Do fabryki nadal brakuje mostu | 1116 | https://www.consilium.europa.eu/en/meetings/eurogroup/2026/10/08/ |
| 2026-10-09 | ONZ wzywa do ochrony cywilów. Protokół nie zatrzymuje pocisku | 1128 | https://dppa.un.org/en/speeches-and-statements/assistant-secretary-generals-remarks-at-the-security-council-on |
| 2026-10-10 | WHO oddaje pacjentom mikrofon. Przycisk decyzji zostaje dalej | 1130 | https://www.who.int/campaigns/world-mental-health-day/2026 |
| 2026-10-11 | UNICEF chce końca małżeństw dzieci. Prawo potrzebuje otwartych drzwi | 1109 | https://www.unicef.org/gender-equality/international-day-girl |
| 2026-10-12 | Nobel nagradza modele. Gospodarka nie dostaje pilota | 1124 | https://news.stanford.edu/stories/2026/10/robert-e-hall-nobel-prize-economic-sciences |
| 2026-10-13 | El Niño wysyła ostrzeżenie. Pomoc czeka na podpis | 1131 | https://unsdg.un.org/latest/stories/how-un-country-teams-are-advancing-integrated-responses-el-ni%C3%B1o |
| 2026-10-14 | IEA obniża popyt na ropę. Ulga nie wynika z odejmowania | 1152 | https://www.iea.org/reports/oil-market-report-october-2026 |

Źródła sprawdzono14października w przeglądarce internetowej: bezpośrednie strony i indeksowane treści wydawców. UNCTAD/DPPA/UNSDG podczas bezpośredniego odczytu zwracały403, dlatego daty i przywołane wiadomości potwierdzono w ich indeksowanych materiałach pierwotnych; nie twierdzimy odczytu zamkniętych pełnych raportów.

-7października: dane UNCTAD dotyczą2025roku. Kwota niemal biliona to odsetki netto, nie wartość całego długu;3,7miliarda dotyczy mieszkańców państw porównujących kategorie wydatków. Data komunikatu7października potwierdzona w oficjalnym World Investment Forum news; sourceUrl prowadzi do właściwego raportu A World of Debt2026. Nie antydatowano powstania zadłużenia.
-8października: podsumowanie Eurogrupy pokazuje debatę/monitoring, nie przyjęcie gotowego instrumentu inwestycyjnego. Przykłady pośrednictwa i gwarancji są jawnie warunkowe.
-9października: źródło DPPA jest wystąpieniem o Ukrainie i apelem dotyczącym Oleszek, nie zawartym porozumieniem. Bez dopisywania przejazdów, niezweryfikowanych bilansów ofiar lub obietnicy bezpieczeństwa.
-10października: dokładny temat kampanii WHO2026, udział osób z doświadczeniem opieki i wsparcie w społeczności. Bez porad klinicznych i twierdzenia, że sama kampania wdrożyła reformę.
-11października: temat UNICEF2026 i szacowana roczna skala ponad12milionów małżeństw dziewcząt przed pełnoletnością. Nie przedstawiono szacunku jako rejestru zdarzeń z tego dnia ani nie dopisano nowego globalnego prawa.
-12października: oficjalna wiadomość Stanford potwierdza datę, Halla/Woodforda i mikroekonomiczne podstawy stabilizacji. Interpretacja zastosowań modeli odróżniona od opisu wszystkich prac laureatów; bez wymyślonych cytatów i decyzji banku centralnego.
-13października: data i przykłady Etiopii/Mozambiku/Filipin z UN Development Coordination Office. Scenariusze przygotowania warunkowe; prognoza nie zamieniona w relację z katastrofy.
-14października: data raportu IEA potwierdzona na stronie wydawcy;2,6miliona baryłek dziennie to prognozowana roczna zmiana popytu wobec2025, nie wynik zamkniętego roku. Deficyt do końca roku również prognozą. Nowy tekst analizuje popyt i bilans, zamiast powtarzać wpis2października o ogłoszeniu G7.

Każdy tekst ma3H2/9akapitów, źródło wyłącznie w frontmatter, kanoniczne tagi oraz jedną oś opowieści. Fakty źródłowe streszczone krótko (do150słów), pozostała treść autorską analizą i warunkowymi scenariuszami. Bez fikcyjnych rozmówców, scen, cytatów i dodatkowych statystyk. Ironia dotyczy wykonania zobowiązań przez instytucje, nie osób potrzebujących ochrony. Przegląd językowy zastąpił powtarzane deklaracje o metodzie konkretnym objaśnieniem mechanizmów. Istniejące guardrailsy pełnego materiału prasowego pozostają odpowiednie; nie trzeba zmieniać promptów dla tej partii.

## Grafika

Built-in ImageGen, jeden osobny obraz na tekst, wszystkie1536×1024RGB. Każdy obejrzany i zdekodowany. Forestgreen/teal/ivory/mutedgold, dimensional cut-paper Situation Room, bez tekstu, twarzy, ludzi, logo i watermarków. Metafory: folder kierujący pieniądze do długu; brakujący środek mostu skarbonka–fabryka; dokument zbyt krótki na ochronę trasy; mikrofon oddzielony od kontroli; obrączka zamykająca szkołę; model/medal i panel decyzji; alarm zablokowany folderem; kanały dostaw paliwa i wąskie gardło.

## Weryfikacja

- Real quality/finalJSON/antiHallucination validators:8/8PASS,zero warnings;1072–1152słów body.
- npm run check:197/197testów PASS,typecheck/content audit/build PASS. Po korekcie języka i sourceUrl ponowne walidatory/content audit/Nodebuild PASS.
- npm run test:smoke lokalnie:197artykułów/obrazów,nawigacja,tematy,SEO,404,health PASS (412żądań).
- Osiem dokładnych tytułów/body/sourceUrl po renderze, hashe hero, RSS all8 i health ok=true PASS. Archiwum197.
- Przegląd rzeczywistej przeglądarki desktop1440×1000 i mobile390×844. Wszystkie8stron mobile:3H2,heroLoaded=true,bez poziomego overflow. Widok dzisiejszego tekstu sprawdzony wizualnie.
- Lokalny podgląd nie korzysta z PostgreSQL: liczniki views/likes zwracają500 z powodu nieustawionego DATABASE_URL. To ograniczenie podglądu, nie dowód błędu nowych treści ani weryfikacja tych funkcji na produkcji. Integracja DB należy do osobnego zadania PR CI.

Stan: gotowa partia w PR do przeglądu. Nie jest to dowód nowego wdrożenia na produkcji. Wydanie nadal wymaga bramek image scan/Flux i dokładnej publicznej akceptacji po scaleniu. Prywatne wyniki robocze:/tmp/pseudointelekt-07-14-review.jsonl,/tmp/pseudointelekt-07-14-local-acceptance.json,/tmp/pseudointelekt-07-14-smoke.log. Wiedza wyłącznie w prywatnym RAG.
