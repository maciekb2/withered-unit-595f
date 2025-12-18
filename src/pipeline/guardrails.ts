export function guardrails(): string {
  return [
    'GUARDRAILS:',
    '- statystyki tylko ze zrodlem; zadnych "najnowszych raportow" bez linku ani dat z sufitu;',
    '- brak wymyslonych danych; przy braku pewnosci stosuj [[TODO-CLAIM]];',
    '- opis max 200 znakow, bez markdown;',
    '- jeden glowny watek, bez skakania po tematach.',
  ].join(' ');
}
