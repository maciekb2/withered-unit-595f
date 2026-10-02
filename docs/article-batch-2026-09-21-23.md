# Źródła i przegląd partii: 21–23 września 2026

Partia kontynuuje wpisy 12–20 września w draft PR #287. Daty `pubDate` oznaczają dni wpisów. Każdy artykuł ma jedno główne źródło we frontmatter, trzy H2 i dziewięć akapitów. Analiza organizacji, finansowania i możliwych skutków jest wyraźnie oddzielona od udokumentowanych wydarzeń. Nie dodawano fikcyjnych wypowiedzi ani decyzji.

## 21 września: trwałość projektów pokojowych

- [PBF: Pathways to Durability](https://www.un.org/peacebuilding/sites/default/files/2026-09/sustainability_and_national_ownership_in_un_peacebuilding_fund_nov_2025.pdf) — źródło główne. Sprawdzono metodologię oraz przytoczone przykłady w sekcji o trwałości finansowania. To synteza wcześniejszych ewaluacji, nie nowe badanie terenowe ani ocena wszystkich interwencji.
- [Wykaz dokumentów PBF](https://www.un.org/peacebuilding/en/peacebuilding-fund-documents?order=uw_publication_date&page=12&sort=asc) — publikacja wymieniona pod datą 21 września 2026. Nazwa pliku PDF nie służy jako samodzielny dowód daty opracowania; wpis opisuje datę udostępnienia w wykazie.
- [ONZ: wystąpienie Guterresa na Dzień Pokoju, 21 września 2026](https://ukraine.un.org/en/323039-un-secretary-general-calls-global-leaders-make-peace-active-and-deliberate-choice) — pomocniczy kontekst apelu o inwestowanie w pokój.

Nie przypisano grantowi pokoju w całym państwie. Przykłady z Gambii i Burundi dotyczą opisanych usług; nie są rankingiem krajów. Pytania o kontynuację, mandat i późniejszą ocenę są analizą redakcyjną.

## 22 września: przyszły budżet UE

- [Irlandzka prezydencja: wyniki GAC z 22 września 2026](https://irish-presidency.consilium.europa.eu/en/news/results-of-the-general-affairs-council-22-september-2026/) — źródło główne. Debata i ocena postępu przez gospodarzy nie są przedstawiane jako zawarte porozumienie.
- [Rada UE: wieloletni budżet i procedura](https://www.consilium.europa.eu/en/policies/eu-long-term-budget/) — rozróżnienie zobowiązań i płatności, ram oraz zasobów własnych; jednomyślność, zgoda Parlamentu i etapy krajowe dla zasobów własnych.

Nie podano nieuzgodnionych kwot ani dat wypłat. Nie rozstrzygano rozbieżności w miesiącu prezentacji propozycji między stronami Rady; ten szczegół nie jest potrzebny do tekstu. Nie wykorzystano późniejszego podsumowania prezydencji z 30 września. Przykłady skutków opóźnienia lub elastyczności są warunkową analizą.

## 23 września: akcelerator sieci

- [UNOPS: ogłoszenie Global Grids Accelerator, 23 września 2026](https://www.unops.org/news-and-stories/news/un-secretary-general-launches-global-grids-accelerator-to-power-growth-and-clean-energy-in-africa-and-south-east-asia) — źródło główne. Uruchomienie współpracy nie oznacza przyznania finansowania wszystkim projektom ani ukończenia linii. Moc projektów w kolejce nie jest dostarczoną energią ani mocą już wybudowanych instalacji.
- [UNOPS: opublikowane wystąpienie dyrektora z 23 września 2026](https://www.unops.org/news-and-stories/speeches/grids-global-accelerator-launch-event) — przypisane przykłady kompetencji wykonawczych. Strona ma zastrzeżenie „Check against delivery”; artykuł odnosi się do opublikowanego tekstu, bez twierdzenia o dosłownym wygłoszeniu.
- [IEA: komunikat o sieciach z 17 października 2023](https://www.iea.org/news/lack-of-ambition-and-attention-risks-making-electricity-grids-the-weak-link-in-clean-energy-transitions) — historyczne, warunkowe oszacowanie potrzeb do 2040 roku, nie wykonana rozbudowa ani nowy pomiar z września 2026.

Nie użyto późniejszych aktualizacji jako wiedzy z dnia wpisu. Analiza harmonogramów, kosztów utrzymania i współpracy transgranicznej nie jest relacją z konkretnego, niepotwierdzonego projektu.

## Ilustracje i weryfikacja

Wbudowany ImageGen przygotował trzy osobne hero PNG 1536 × 1024 RGB w `public/blog-images/`, o nazwach odpowiadających artykułom. Sprawdzono je wizualnie i zdekodowano: paleta Situation Room, papierowy kolaż, brak ludzi, tekstu, liczb i logotypów. Metafory: most i odsuwane rusztowanie; teczka budżetu z blokami i suwmiarką; wiatrak oraz niepołączona wtyczka przy słupie sieci.

Body: 1110, 1109 i 1115 słów według walidatora jakości. Walidatory jakości, źródeł i metadanych poprawne; brak ostrzeżeń jakości. 1 października 2026 `npm run check` przeszedł: typecheck, audyt, 197/197 testów, build Node. Kontrola potwierdziła 176 odwołań do obrazów w źródle i buildzie. `git diff --check` poprawnie.

Przygotowanie treści nie zmieniło harmonogramu ani runtime. Publikacja pozostaje osobnym etapem normalnej ścieżki wydania.
