import { validateArticleQuality } from './quality';
import type { FinalJson, Outline } from '../types';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const outline: Outline = {
  finalTitle: 'Rachunek za parasol: Europa uczy się płacić za własny spokój',
  description: 'Opis',
  sections: [
    { h2: 'Parasol z metką', bullets: ['a', 'b'] },
    { h2: 'Lekcja z przerwy', bullets: ['a', 'b'] },
    { h2: 'Polska puenta', bullets: ['a', 'b'] },
  ],
  guardrails: [],
};

test('validateArticleQuality rejects section headings that repeat the title', () => {
  const article = articleWithBody([
    '## Rachunek za parasol: Europa uczy się płacić za własny spokój',
    longParagraph(),
    '## Lekcja z przerwy',
    longParagraph(),
    '## Polska puenta',
    longParagraph(),
  ].join('\n\n'));

  const result = validateArticleQuality(article, outline);
  assert.equal(result.ok, false);
  assert(result.errors.some(error => error.includes('Naglowek sekcji powtarza tytul')));
});

test('validateArticleQuality warns about generic phrasing without failing', () => {
  const article = articleWithBody([
    '## Parasol z metką',
    longParagraph('wielkie narracje'),
    '## Lekcja z przerwy',
    longParagraph(),
    '## Polska puenta',
    longParagraph(),
    longParagraph(),
    longParagraph(),
    longParagraph(),
  ].join('\n\n'));

  const result = validateArticleQuality(article, outline);
  assert.equal(result.ok, true);
  assert(result.warnings.some(warning => warning.includes('Generyczne frazy')));
});

function articleWithBody(content: string): FinalJson {
  return {
    title: outline.finalTitle,
    description: 'Opis',
    content,
  };
}

function longParagraph(extra = ''): string {
  const sentence = [
    'Europa przestaje traktować bezpieczeństwo jak rachunek dopisany drobnym drukiem do cudzej faktury',
    'Politycy odkrywają, że magazyny, fabryki i decyzje budżetowe są mniej efektowne niż konferencje, ale bardziej użyteczne',
    'W tej historii nie chodzi o panikę, tylko o nudną zdolność do wykonania obietnic',
    'Polska ma tu interes prosty: mniej teatralnych deklaracji, więcej realnej produkcji i odporności',
    extra,
  ].filter(Boolean).join('. ');
  return `${sentence}. ${sentence}. ${sentence}.`;
}
