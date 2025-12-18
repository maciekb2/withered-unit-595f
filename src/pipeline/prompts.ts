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

export function buildDraftPrompt(outline: Outline, articlePrompt: string, contextPack = ''): string {
  const outlineText = `Tytul: ${outline.finalTitle}\nOpis: ${outline.description}\nSekcje:\n${sectionsText(outline)}\n\nZasady:\n${rulesText(outline)}`;
  const ctx = contextPack.trim() ? `\n\nKontekst (JSON):\n${contextPack.trim()}\n` : '';
  const extra =
    'Uzyj dokladnie podanych naglowkow sekcji w formacie "## {nazwa}" i w tej samej kolejnosci. Nie dodawaj ani nie usuwaj naglowkow. ' +
    'Napisz szkic jako ciag akapitow; kazdy bullet z sekcji rozwin w spojny akapit liczacy okolo 6-10 zdan i bez odchodzenia od glownego tematu. ' +
    'W calym tekscie uzyj zrodel 3-5 (maks 1 na sekcje) tylko jesli faktycznie masz dane; kazde zrodlo podawaj jako pelny URL http(s)://... w tym samym zdaniu co liczba/data/raport. ' +
    'Jesli nie masz pewnego URL - nie podawaj konkretnych liczb/dat/nazw raportow; uogolnij albo uzyj [[TODO-CLAIM]] i sformuluj warunkowo. ' +
    'Unikaj list wypunktowanych, trzymaj sie jednego glownego tematu i zachowaj profesjonalny ton.';
  return `${outlineText}${ctx}\n\n${extra}\n\n${articlePrompt}`;
}

export function buildEditPrompt(draft: Draft, outline: Outline, editTemplate = ''): string {
  const extra = editTemplate ? `\n\nDodatkowe instrukcje:\n${editTemplate.trim()}\n` : '';
  return (
    `Zredaguj szkic artykulu w jednym kroku (edycja + korekta), zachowujac satyryczny ton i wskazowki. ` +
    `Nie zmieniaj tytulu, opisu ani naglowkow sekcji ("## ..."). ` +
    `Kazdy akapit ma okolo 6-10 zdan, spojny i w jednym watku, bez skakania po tematach. ` +
    `W calym tekscie pozostaw maks 3-5 odnosnikow do zrodel (maks 1 na sekcje) tylko gdy masz dane; kazde zrodlo ma byc pelnym URL http(s)://... w tym samym zdaniu co liczba/data/raport. ` +
    `Jesli brak pewnego URL - usun konkret (liczbe/date/nazwe raportu) albo uogolnij; nie wymyslaj danych. ` +
    `Jesli brak pewnosci, pozostaw [[TODO-CLAIM]] i sformuluj zdanie warunkowo (ale nie zostawiaj TODO w finalnym wyniku). ` +
    `Usun powtorzenia i popraw plynosc zdan; nie dodawaj nowych danych.\n` +
    `Zasady:\n${rulesText(outline)}\n\n` +
    `Tytul: ${outline.finalTitle}\nOpis: ${outline.description}\n\n` +
    `Szkic:\n${draft.markdown}\n` +
    extra +
    `Zwracaj JSON { markdown, title, description }.`
  );
}
