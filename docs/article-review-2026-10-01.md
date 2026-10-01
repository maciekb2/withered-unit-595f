# Przegląd redakcyjny przed wydaniem: 12–26 września 2026

Na wyraźne polecenie właściciela przygotowano do publikacji piętnaście nowych artykułów i piętnaście ilustracji. Przejrzano pełne body: konkretna wiadomość na początku, jedna oś narracji, kontekst, mechanizm, interesy i sprawdzalne następne kroki. Fakty, stanowiska źródeł i warunkowe wnioski są oddzielone. Nie dodano fikcyjnych wypowiedzi ani zdarzeń.

W każdym tekście wyostrzono ironię dotyczącą opisanej sprzeczności instytucjonalnej: m.in. cyfrowy skok kontra spacer między okienkami, szyld urzędu kontra zasoby, rubryki budżetu kontra składki, partnerzy na stronie kontra przewody. Nie dodawano ataków na grupy społeczne ani stereotypów narodowych. W tekście o kontroli eksportu usunięto uwagę o pisaniu artykułu. Doprecyzowano dane IEA o łącznym eksporcie ropy i produktów oraz wskaźniki CAMS obejmujące deficyt ozonu i jego minimalną zawartość.

Po poprawkach body liczą kolejno: 1071, 1068, 1074, 1110, 1114, 1136, 1127, 1119, 1148, 1119, 1124, 1128, 1110, 1132, 1119 słów. Wszystkie mają trzy H2, dziewięć akapitów, kanoniczne tagi i jeden sourceUrl we frontmatter. Walidatory jakości, metadanych i źródeł poprawne, jakość bez ostrzeżeń. Mapy źródeł w dokumentach poszczególnych partii pozostają zapisem ich wcześniejszej walidacji; powyższe liczby opisują wersję po przeglądzie.

Źródła pierwotne partii 24–26 sprawdzono w trakcie jej przygotowania. Przy przeglądzie ponownie odczytano IEA, CAMS, materiały ONZ o BRICS, aktualizację listy Komisji i komunikat Gender Snapshot w oficjalnym indeksie DESA. Pozostałe teksty porównano z udokumentowanymi mapami źródeł wcześniejszych partii. Ograniczenia odczytu wybranych stron ONZ i Komisji pozostają jawne; nie zmieniono niepotwierdzonej zapowiedzi w wynik działania.

## Zakres wydania i właściciel

Właściciel aplikacji i infrastruktury: prywatna platforma Macieja. Źródło aplikacji: maciekb2/withered-unit-595f. Repo infrastruktury: maciekb2/mb-private-rke2, gałąź infra/home-mb-dev-bootstrap. Cel: namespace pseudointelekt w klastrze home-mb-dev; publiczny adres pseudointelekt.pl. Repo manifestów i niezależny odczyt działającego ApplicationRelease oraz GitRepository potwierdziły zgodność.

1 października działający ApplicationRelease miał promotion.mode=Automatic i sourceRef pseudointelekt-source wskazujący main. Repo manifestów potwierdza ten tryb; starsze opisy Shadow nie są bieżącą konfiguracją. Kontroler wykonuje walidację, build, skan HIGH/CRITICAL, promuje niezmienny digest i weryfikuje rollout oraz sondy. Poprzedni obraz do rollbacku: sha256:b39f3c047c5fb3fc852d5455ff61fc02b9389699615ab99232f6e91cd1d24a2a, rewizja 6d8de113711d0295f9800272871e7a2aedb42102.

Zmiana obejmuje treści i prompty redakcyjne. Nie zmienia schematu bazy, storage ani sekretów. Generator automatyczny pozostaje wyłączony; nie uruchamiano publikacji w mediach społecznościowych. Po merge należy połączyć dowody rewizji źródła, digestu GitOps i runtime, gotowości PostgreSQL oraz publicznej obecności artykułów i poprawnego dekodowania ilustracji.
