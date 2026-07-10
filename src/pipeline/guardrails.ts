export function guardrails(): string {
  return [
    'GUARDRAILS:',
    '- statystyki tylko z dostarczonego kontekstu zrodlowego; zadnych "najnowszych raportow" ani dat z sufitu;',
    '- brak wymyslonych danych; przy braku pewnosci stosuj [[TODO-CLAIM]];',
    '- opis max 200 znakow, bez markdown;',
    '- jeden glowny watek, bez skakania po tematach.',
  ].join(' ');
}
