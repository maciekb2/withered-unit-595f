# Źródła i przegląd partii: 18–20 września 2026

Partia kontynuuje wpisy 12–17 września w draft PR #287. Daty `pubDate` oznaczają dni wpisów; wcześniejsze daty komunikatów i obserwacji są jawnie podane w tekstach. Każdy materiał ma jeden główny `sourceUrl`, trzy sekcje H2 i dziewięć akapitów. Analiza mechanizmów oraz możliwe warianty działania nie są przedstawiane jako dodatkowe wydarzenia. Nie dodawano wymyślonych cytatów, stanowisk ani wyników badań.

## 18 września: wspólna wyszukiwarka danych ONZ

- [ONZ: New UN system platform puts millions of data points at users’ fingertips, 18 września 2026](https://www.un.org/en/node/248238) — źródło główne; zakres serwisu, skala zasobu, pozostawienie istniejących platform i powrót do źródeł. Prezentacja odbyła się 17 września, nie w dniu komunikatu.
- [Google: Making global data easier to explore, 17 września 2026](https://blog.google/innovation-and-ai/technology/ai/google-un-data-commons-platform/) — źródło pomocnicze dotyczące Data Commons i grafu wiedzy; jawnie opis dostawcy, a nie niezależny test skuteczności.

Przykłady różnic definicji, opóźnienia pomiaru i utraty metadanych są analizą wymagań pracy ze statystyką, nie raportem z testowania platformy. Tekst nie obiecuje zmierzonej oszczędności czasu ani bezbłędnych odpowiedzi AI. Nie użyto późniejszego komunikatu UNICC z 28 września jako wiedzy dostępnej 18 września.

## 19 września: nieformalny ECOFIN i zyski energetyki

- [Irlandzka prezydencja: spotkanie ECOFIN, 18–19 września 2026](https://irish-presidency.consilium.europa.eu/en/events/informal-meeting-of-economic-and-financial-affairs-ministers-ecofin/) — źródło główne, potwierdzenie wydarzenia i formatu.
- [Prezydencja: zapowiedź tematów rozmów](https://irish-presidency.consilium.europa.eu/en/news/tanaiste-to-host-key-meeting-of-finance-ministers-and-central-bank-governors-as-part-of-ireland-s-eu-presidency/) — AI, banki, nadzwyczajne zyski i oczekiwane przyszłe propozycje. Materiał ma język zapowiedzi; tekst nie przekształca go w potwierdzone rozstrzygnięcia.
- [Financial Justice Ireland: apel z 16 września 2026](https://www.financialjustice.ie/news/this-is-not-a-time-for-business-as-usual-financial-justice-ireland-calls-for-action-as-eu-finance-mi/) — przypisany postulat organizacji społecznych, nie stanowisko ministrów ani szacunek wpływów podatkowych.
- [Szwajcarskie władze: zapowiedź udziału minister finansów, 14 września 2026](https://www.sepos.admin.ch/de/newnsb/bx1zflAcz0kW) — wyjaśnienie, że nieformalny ECOFIN służy wymianie poglądów, bez podejmowania decyzji.

Nie ogłoszono nowego podatku, porozumienia, obniżki rachunków ani wiedzy o zamkniętych negocjacjach. Warianty konstrukcji daniny i podziału pomocy są warunkową analizą redakcyjną. Nie opierano wpisu na podsumowaniu prezydencji z 30 września.

## 20 września: żywność i Światowy Dzień Sprzątania

- [ONZ: World Cleanup Day 2026](https://www.un.org/en/observances/cleanup-day) — źródło główne; data obchodów, temat, Shaoxing oraz rozróżnienie zapobiegania, wykorzystania żywności i zagospodarowania pozostałości.
- [UNEP: komunikat o Food Waste Index Report 2024, 27 marca 2024](https://www.unep.org/news-and-stories/press-release/world-squanders-over-1-billion-meals-day-un-report) — dane za 2022, części niejadalne i udziały sektorów. Nie przedstawiano ich jako pomiaru z września 2026.
- [UNEP: opis Food Waste Index Report 2024](https://www.unep.org/resources/publication/food-waste-index-report-2024?os=win) — funkcja pomiaru i punktu odniesienia. Tekst nie deklaruje samodzielnego przeglądu całego raportu.

Przykłady organizacji zbiórki i przekazania nadwyżek są analizą możliwych mechanizmów, a nie opisem programów wdrożonych w Shaoxing. Nie utożsamiono wszystkich odpadów żywnościowych z jadalnymi posiłkami ani odebranej masy z ilością uratowanego jedzenia. Nie przypisano jednodniowym obchodom globalnej poprawy.

## Ilustracje i walidacja

Wbudowany ImageGen przygotował trzy osobne hero 1536 × 1024 RGB. Pliki w `public/blog-images/` odpowiadają nazwom trzech nowych artykułów. Zachowano paletę Situation Room, powierzchnie papierowego kolażu oraz brak ludzi, tekstu, liczb i logotypów. Metafory: szuflada źródeł i lupa; monety z beczki zatrzymane na stole rozmów nad pustym domem; papierowy bochenek na krawędzi talerza nad koszem. Po przeglądzie trzeci obraz poprawiono, zastępując fotograficzną fakturę chleba papierową formą; końcowy obraz sprawdzono ponownie.

Body liczy odpowiednio 1116, 1108 i 1134 słowa według walidatora jakości. Walidatory jakości, metadanych i pojedynczego źródła przeszły bez błędów; jakość bez ostrzeżeń. `npm run check` z 1 października 2026: typecheck, audyt treści, 197/197 testów i build Node zakończone pomyślnie. Kontrola potwierdziła 173 odwołania do obrazów w źródle i buildzie. PNG poprawnie zdekodowane; `git diff --check` poprawnie.

Partia przygotowuje zawartość repozytorium. Publikacja odbywa się osobną ścieżką wydania; nie zmieniono harmonogramu ani runtime.
