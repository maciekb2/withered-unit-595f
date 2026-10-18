# Pseudointelekt: artykuły 15–18 października 2026

## Zakres

Cztery artykuły i cztery ilustracje: jeden wpis na każdy dzień 15–18 października 2026. Punkt wyjścia origin/main f3647fa; poprzednia partia kończy się 14 października. Bez zmian aplikacji, zależności, bazy, storage, sekretów i schedulera. Teksty wygenerowano lokalną sesją Codex (subskrypcja ChatGPT), bez wywołań API generatora; ilustracje wbudowanym image_gen. Partię przejrzał i zaakceptował Maciej.

Nowy standard: esej popularnonaukowy w duchu Foreign Affairs z zachowaniem ironicznego charakteru serwisu. Pięć H2 (wiadomość, kontekst historyczny, mechanizm, interesy i kontrdowody, co dalej), po cztery akapity w sekcji. Źródła wspierające wyłącznie jako wzmianki w treści, bez listy źródeł i bez URL w body; sourceUrl tylko we frontmatter. Każde źródło datowane nie później niż dzień artykułu.

## Mapa

| Dzień | Tytuł | Słowa | Tag | Źródło główne |
| --- | --- | ---: | --- | --- |
| 2026-10-15 | Rozejm energetyczny upadł. Strony nie wiedziały, że go zawarły | 2086 | geopolityka | https://www.theguardian.com/world/2026/oct/15/us-effort-to-get-russia-ukraine-energy-ceasefire-collapses |
| 2026-10-16 | NIK: atom najwcześniej w 2036 roku. W programie zabrakło budowniczych | 2061 | gospodarka-i-energia | https://www.nik.gov.pl/komunikaty/transformacja-energetyczna-opozniona-droga-do-polskiego-atomu/ |
| 2026-10-17 | Trybunał ma dwóch strażników u bramy. Ślubowanie mieszka w ustawie | 2047 | polityka-i-media | https://www.rp.pl/sady-i-trybunaly/art45351471-trwa-manifestacja-pod-trybunalem-konstytucyjnym-relacja-na-zywo |
| 2026-10-18 | Francja protestowała przeciw drożyźnie. Rachunek dostał ratusz w Limoges | 2047 | europa-i-unia | https://www.afp.com/en/france-counts-cost-violent-protests-1800-arrested |

Słowa liczone jak w validateArticleQuality (wyrazy literowe razem z H2).

## Źródła i daty

- 15 października: Guardian (15.10), Reuters/Boursorama o obwodzie kirowohradzkim (15.10), Al Jazeera/AP/Reuters o rafineriach (15.10), readout Białego Domu z 18.03.2025 (American Presidency Project), AP o próbach rozejmu (30.01.2026), Babel o Starshield (15.10). Guardian i Al Jazeera były później aktualizowane; użyto tylko wiadomości potwierdzonych w materiałach z 15.10. Nie twierdzimy, że zawarto uzgodniony rozejm; przyczyny ograniczeń Starshield pozostają nierozstrzygnięte.
- 16 października: komunikat NIK, karta kontroli P/24/015/KGP i raport PDF (publikacja 16.10), energia.rp.pl (16.10), gov.pl o Żarnowcu (strona bez daty, istnienie przed 2026 udokumentowane), uchwała RM nr 204 z 17.12.1990 (M.P. 1990 nr 49 poz. 373). Rok 2036 to dolna data rozpatrywanego planu, nie gwarancja rozruchu; PEJ jest inwestorem, nie wykonawcą.
- 17 października: Rzeczpospolita (relacja z 17.10, później aktualizowana), Deutsche Welle (16.10), Komisja Wenecka CDL-AD(2016)001 (11.03.2016), Konstytucja RP art. 32 i 194, ustawa z 30.11.2016 o statusie sędziów TK art. 4–5, VideoParlament (17.10). Obowiązek ślubowania wynika z ustawy, nie z art. 194; 50 spraw to przytoczony zarzut, nie fakt urzędowy.
- 18 października: AFP (18.10), BBC (17–18.10), BBC i Guardian o podatku paliwowym (4–5.12.2018), raport Senatu nr 521 o zamieszkach 2023 (9.04.2024), komunikat resortu gospodarki nr 1041 (17.07.2023). Liczby to bilanse autorów; zatrzymanie odróżnione od skazania; nie użyto treści wieczornego orędzia.

Cytaty: wyłącznie krótkie przytoczenia z dokumentów źródłowych, bez wymyślonych rozmówców i scen. Szczegółowe mapy akapit–źródło pozostają w prywatnych materiałach roboczych.

## Grafika

Wbudowany image_gen, jeden obraz na tekst, 1536×1024 RGB, bez skalowania i retuszu. Prompt hero-image.txt z PSEUDOINTELEKT_HERO_STYLE_LOCK bez zmian: forestgreen/teal/ivory/mutedgold, dimensional cut-paper, bez tekstu, twarzy, logo i watermarków. Metafory: rozdarty pusty dokument między transformatorem a rafinerią; plac budowy atomu bez wykonawcy; brama Trybunału z dwoma strażnikami; rachunek za zamieszki trafiający do ratusza.

## Weryfikacja

- npm run check: typecheck, content audit (201 plików, zero normalizacji), 197/197 testów i build (201 odwołań hero) PASS.
- Walidator partii: 4/4 PASS, bez ostrzeżeń. git diff --check PASS.
- Ręcznie: dokładne pola frontmatter, 5 H2 × 4 akapity, brak URL, linków i list w body, tytuły bez linków, PNG 1536×1024.

Stan: partia gotowa do scalenia po akceptacji. Wydanie produkcyjne wymaga bramek release-system (build, Trivy) i promocji przez GitOps.
