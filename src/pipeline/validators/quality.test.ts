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
    longParagraph('Budżet przestaje być dekoracją i zaczyna być instrukcją obsługi państwa'),
    '## Polska puenta',
    longParagraph('Warszawa nie musi czekać na cudzą pobudkę, jeśli sama pilnuje własnego zegarka'),
    longParagraph('Przemysł obronny wraca z folderu obietnic do tabeli zamówień i terminów'),
    longParagraph('Sojusze są ważne, ale własna logistyka decyduje, czy deklaracja ma koła'),
    longParagraph('Najmniej widowiskowe decyzje bywają najbardziej odporne na pierwszy kryzys'),
  ].join('\n\n'));

  const result = validateArticleQuality(article, outline);
  assert.equal(result.ok, true);
  assert(result.warnings.some(warning => warning.includes('Generyczne frazy')));
});

test('validateArticleQuality rejects repeated title and lead in body', () => {
  const description = 'Europa ogłosiła nowy plan, ale jego wykonanie zależy od fabryk, budżetów i terminów dostaw.';
  const article: FinalJson = {
    title: outline.finalTitle,
    description,
    content: [
      `# ${outline.finalTitle}`,
      description,
      '## Parasol z metką',
      longParagraph(),
      '## Lekcja z przerwy',
      longParagraph('Drugi odrębny akapit analizuje wykonanie decyzji'),
      '## Polska puenta',
      longParagraph('Trzeci odrębny akapit opisuje konsekwencje decyzji'),
    ].join('\n\n'),
  };

  const result = validateArticleQuality(article, outline);
  assert.equal(result.ok, false);
  assert(result.errors.some(error => error.includes('powtorzonego tytulu')));
  assert(result.errors.some(error => error.includes('powtarza opis/lead')));
});

test('validateArticleQuality rejects near-duplicate paragraphs', () => {
  const first = longParagraph('Port przyjął nowy ładunek po decyzji rządu');
  const second = first.replace('nowy ładunek', 'kolejny ładunek');
  const article = articleWithBody([
    '## Parasol z metką',
    first,
    '## Lekcja z przerwy',
    second,
    '## Polska puenta',
    longParagraph('Odrębny akapit opisuje końcowy skutek decyzji'),
  ].join('\n\n'));

  const result = validateArticleQuality(article, outline);
  assert.equal(result.ok, false);
  assert(result.errors.some(error => error.includes('powtorzone akapity')));
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
    extra,
    'Europa przestaje traktować bezpieczeństwo jak rachunek dopisany drobnym drukiem do cudzej faktury',
    'Politycy odkrywają, że magazyny, fabryki i decyzje budżetowe są mniej efektowne niż konferencje, ale bardziej użyteczne',
    'W tej historii nie chodzi o panikę, tylko o nudną zdolność do wykonania obietnic',
    'Polska ma tu interes prosty: mniej teatralnych deklaracji, więcej realnej produkcji i odporności',
  ].filter(Boolean).join('. ');
  return `${sentence}. ${sentence}. ${sentence}.`;
}
