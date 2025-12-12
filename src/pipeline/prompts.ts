export const TODO_CLAIM_RULE = `Jesli nie masz 100% pewnosci co do konkretnej liczby, daty lub nazwy raportu - oznacz zdanie tokenem [[TODO-CLAIM]] i sformuluj je warunkowo (np. "jesli zalozymy, ze"). Nie wymyslaj zrodel ani dokladnych wartosci.`;

import type { Outline, Draft } from './types';

function sectionsText(outline: Outline): string {
  return outline.sections
    .map((s, i) => `${i + 1}. ${s.h2}\n${s.bullets.map(b => `- ${b}`).join('\n')}`)
    .join('\n');
}

function rulesText(outline: Outline): string {
  const rules = [...outline.guardrails, TODO_CLAIM_RULE];
  return rules.map(r => `- ${r}`).join('\n');
}

export function buildDraftPrompt(outline: Outline, articlePrompt: string): string {
  const outlineText = `Tytul: ${outline.finalTitle}\nOpis: ${outline.description}\nSekcje:\n${sectionsText(outline)}\n\nZasady:\n${rulesText(outline)}`;
  const extra =
    'Uzyj dokladnie podanych naglowkow sekcji w formacie "## {nazwa}" i w tej samej kolejnosci. Nie dodawaj ani nie usuwaj naglowkow. ' +
    'Napisz szkic jako ciag akapitow; kazdy bullet z sekcji rozwin w spojny akapit liczacy okolo 6-10 zdan i bez odchodzenia od glownego tematu. ' +
    'W calym tekscie uzyj zrodel 3-5 (maks 1 na sekcje) tylko jesli faktycznie masz dane; inaczej pomin, a w razie watpliwosci uzyj [[TODO-CLAIM]] i sformuluj warunkowo. ' +
    'Unikaj list wypunktowanych, trzymaj sie jednego glownego tematu i zachowaj profesjonalny ton.';
  return `${outlineText}\n\n${extra}\n\n${articlePrompt}`;
}

export function buildEditPrompt(draft: Draft, outline: Outline): string {
  return (
    `Zredaguj szkic artykulu w jednym kroku (edycja + korekta), zachowujac satyryczny ton i wskazowki. ` +
    `Nie zmieniaj tytulu, opisu ani naglowkow sekcji ("## ..."). ` +
    `Kazdy akapit ma okolo 6-10 zdan, spojny i w jednym watku, bez skakania po tematach. ` +
    `W calym tekscie pozostaw maks 3-5 odnosnikow do zrodel (maks 1 na sekcje) tylko gdy masz dane; w przeciwnym razie pomin. ` +
    `Jesli brak pewnosci, pozostaw [[TODO-CLAIM]] i sformuluj zdanie warunkowo. ` +
    `Usun powtorzenia i popraw plynosc zdan; nie dodawaj nowych danych.\n` +
    `Zasady:\n${rulesText(outline)}\n\n` +
    `Tytul: ${outline.finalTitle}\nOpis: ${outline.description}\n\n` +
    `Szkic:\n${draft.markdown}\n\n` +
    `Zwracaj JSON { markdown, title, description }.`
  );
}
