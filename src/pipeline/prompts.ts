export const TODO_CLAIM_RULE = `Jeśli nie masz 100% pewności co do konkretnej liczby, daty lub nazwy raportu – oznacz zdanie tokenem [[TODO-CLAIM]] i sformułuj je warunkowo (np. „jeśli założymy, że…”). Nie wymyślaj źródeł ani dokładnych wartości.`;

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
  const outlineText = `Tytuł: ${outline.finalTitle}\nOpis: ${outline.description}\nSekcje:\n${sectionsText(outline)}\n\nZasady:\n${rulesText(outline)}`;
  const extra = 'Użyj dokładnie podanych nagłówków sekcji w formacie "## {nazwa}" i w tej samej kolejności. Nie dodawaj ani nie usuwaj nagłówków. Napisz szkic jako ciąg dłuższych akapitów; każdy bullet z sekcji rozwiń w spójny akapit liczący około 12–20 linijek (co najmniej dziesięć zdań). W każdym akapicie przytocz przynajmniej jedną konkretną statystykę, datę lub raport wraz z wiarygodnym źródłem (np. GUS, Eurostat, NATO); jeśli brak danych, oznacz zdanie [[TODO-CLAIM]] i sformułuj je warunkowo. Unikaj list wypunktowanych i zachowaj profesjonalny ton.';
  return `${outlineText}\n\n${extra}\n\n${articlePrompt}`;
}

export function buildEditPrompt(draft: Draft, outline: Outline): string {
  return `Edytuj szkic artykułu, zachowując satyryczny ton i wskazówki. Nie zmieniaj tytułu, opisu ani nagłówków sekcji ("## ..."). Zadbaj, aby każdy akapit liczył około 12–20 linijek, brzmiał profesjonalnie i zawierał odwołania do konkretnych danych ze źródłami; jeśli brak pewności, pozostaw [[TODO-CLAIM]] zgodnie z zasadami.\nZasady:\n${rulesText(outline)}\n\nTytuł: ${outline.finalTitle}\nOpis: ${outline.description}\n\nSzkic:\n${draft.markdown}\n\nZwróć JSON { markdown, title, description }.`;
}
