# Źródła i przegląd partii: 24–26 września 2026

Partia kontynuuje wpisy 12–23 września w draft PR #287. Każdy tekst ma jedno główne źródło we frontmatter, trzy H2 i dziewięć odrębnych akapitów. Ustalenia źródeł przypisano instytucjom; warunkowa analiza wdrażania nie jest relacją z niepotwierdzonych wydarzeń.

## 24 września: publiczny nadzór nad AI

- [Wystąpienie Costy na 81. Zgromadzeniu Ogólnym ONZ, 24 września 2026](https://www.consilium.europa.eu/en/press/press-releases/2026/09/24/speech-by-president-antonio-costa-at-the-81st-united-nations-general-assembly/) — główne źródło stanowiska UE. Apel nie jest traktatem ani ustanowieniem nowego regulatora. Nagłówek strony i materiały newsroomu potwierdzają rok 2026; błędny rok 2024 w opisach linków multimedialnych nie został wykorzystany.
- [ONZ: ustanowienie panelu i dialogu](https://www.un.org/global-digital-compact/en/ai) oraz [FAQ panelu naukowego](https://www.un.org/independent-international-scientific-panel-ai/en/faq) — potwierdzone indeksowane informacje o rezolucji z 26 sierpnia 2025, corocznych ocenach oraz funkcji forum. Bez twierdzeń o treści późniejszych ocen. Bezpośredni odczyt tych podstron zwrócił 403; użyto dostępnych wyników indeksu oficjalnej domeny, ograniczając zakres do opisanych funkcji.

Nie dopisano stanowisk firm ani innych państw. Rozróżniono naukową ocenę, dialog polityczny i egzekwowanie prawa. Pytania o dokumentację, aktualizacje, dostęp i kompetencje są analizą redakcyjną, bez twierdzenia o nowych obowiązkach prawnych.

## 25 września: współpraca przeciw przemytowi tytoniu

- [Sekretariat WHO FCTC: ósma rocznica protokołu, 25 września 2026](https://fctc.who.int/newsroom/news/item/25-09-2026-eight-years-of-the-protocol-strengthening-international-cooperation-to-eliminate-illicit-trade-in-tobacco-products) — główne źródło liczby 73 stron, obszarów pracy grup i mechanizmu wymiany informacji. Liczba stron nie jest liczbą państw ani miarą skuteczności.
- [WHO FCTC: opis protokołu](https://fctc.who.int/protocol) — wejście w życie 25 września 2018; śledzenie z art. 8, pomoc prawna z art. 29 oraz perspektywa zdrowia publicznego i dochodów.
- [WHO FCTC: udział przemysłu w systemach śledzenia](https://extranet.who.int/fctcapps/fctcapps/fctc/kh/TIInterference/track-and-trace-systems-tobacco-industry-links-2019) — granice delegowania obowiązków i kontaktów. Wykorzystano przytoczone postanowienia, bez powielania historycznych oskarżeń wobec przedsiębiorstw.

Nie wymyślono krajowych strat, zatrzymań, wdrożeń ani odpowiedzi branży. Analiza jakości zapisów, czasu odpowiedzi i podziału kompetencji nie oznacza stwierdzenia błędu w konkretnym systemie.

## 26 września: rozbrojenie i weryfikacja

- [ONZ: przesłanie Guterresa z 26 września 2026](https://indonesia.un.org/en/322920-international-day-total-elimination-nuclear-weapons-2026-secretary-generals-message-ant%C3%B3nio) — główne źródło apelu, nie zawartego porozumienia.
- [ONZ: dzień eliminacji broni jądrowej](https://www.un.org/en/node/98419) oraz [zapowiedziane posiedzenia 81. sesji](https://static.un.org/en/ga/81/meetings/) — indeksowane oficjalne zapowiedzi posiedzenia 29 września. Bezpośrednie otwarcie było ograniczone; nie wykorzystano relacji z późniejszego posiedzenia jako wiedzy z 26 września.
- [SIPRI: ocena z 8 czerwca 2026](https://www.sipri.org/media/press-release/2026/increasing-focus-nuclear-weapons-amid-heightened-escalation-risks-new-sipri-yearbook-out-now) — szacunki na styczeń 2026: 12 187 wszystkich głowic, około 9745 w zapasach wojskowych, około 4012 rozmieszczonych; modernizacja w 2025, wygaśnięcie New START i wynik konferencji NPT. Nie podano tych danych jako bieżącego pomiaru wrześniowego.
- [IAEA Bulletin 1/1995: relacja agencji do NPT](https://www.iaea.org/sites/default/files/publications/magazines/bulletin/bull37-1/37103480913.pdf) — historyczne opracowanie przytaczające art. VI (PDF s. 5) oraz rozdział mandatu zabezpieczeń i rozbrojenia. Wykorzystano tekst zobowiązania i rozróżnienie funkcji, bez przenoszenia historycznej diagnozy politycznej na rok 2026.
- [IAEA: porozumienia zabezpieczeń związane z NPT](https://www.iaea.org/ar/publications/documents/infcircs/structure-and-content-agreements-between-agency-and-states-required-connection-treaty-non-proliferation-nuclear-weapons) — oficjalny indeks potwierdza cel niewykorzystywania materiału działalności pokojowej do broni; zgodny z odczytanym PDF. Nie przypisano IAEA automatycznej kontroli wszystkich głowic.

Nie utożsamiono braku dokumentu końcowego z wygaśnięciem NPT. Pytania o limity, inspekcje i kolejność redukcji są analizą konstrukcji przyszłego instrumentu; nie są opisem uzgodnień z dnia wpisu.

## Ilustracje i weryfikacja

Trzy osobne hero wygenerowano wbudowanym ImageGen, zapisano w `public/blog-images/` i obejrzano. PNG 1536 × 1024 RGB poprawnie zdekodowano. Paleta Situation Room, papierowy kolaż, brak ludzi, napisów, liczb i logotypów. Metafory: chip w suwmiarce z kłódką; paczka i przerwany ślad między przejściami; rakiety z przyrządem pomiarowym i pustym dokumentem. Prompty i oryginały zachowano prywatnie poza Git.

Body po przeglądzie przed wydaniem według walidatora: 1110, 1132 i 1119 słów. Walidatory jakości, źródeł i metadanych poprawne; brak ostrzeżeń jakości; kanoniczne tagi. 1 października 2026 `npm run check` przeszedł: typecheck, audyt treści, 197/197 testów i build Node. Potwierdzono 179 odwołań do ilustracji w źródle i buildzie. `git diff --check` poprawnie.

Treści przygotowano w istniejącej gałęzi redakcyjnej. Publikacja pozostaje osobnym etapem wydania; harmonogram i runtime bez zmian.
