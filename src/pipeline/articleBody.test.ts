import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArticleBody } from './articleBody.js';

const title = 'Port, przemówienie i rachunek';
const description = 'Rząd ogłosił sukces, ale dokumenty pokazują koszt całej operacji.';

test('normalizeArticleBody removes a repeated title, description and source preamble', () => {
  const body = [
    `# ${title}`,
    description,
    'Źródło tematu: https://example.com/news',
    '## Zdarzenie',
    'Pierwszy właściwy akapit zawiera konkretny opis decyzji, jej wykonawców oraz bezpośrednie skutki dla odbiorców.',
  ].join('\n\n');

  assert.equal(
    normalizeArticleBody(body, title, description),
    '## Zdarzenie\n\nPierwszy właściwy akapit zawiera konkretny opis decyzji, jej wykonawców oraz bezpośrednie skutki dla odbiorców.',
  );
});

test('normalizeArticleBody removes a lead with an attached source URL', () => {
  const body = [
    `## ${title}`,
    `${description} Źródło depeszy: https://example.com/news`,
    '## Mechanizm',
    'Właściwa treść pozostaje w artykule i nie powtarza informacji wyświetlanej już pod tytułem.',
  ].join('\n\n');

  assert.doesNotMatch(normalizeArticleBody(body, title, description), /Źródło depeszy|Rząd ogłosił/);
});

test('normalizeArticleBody removes exact repeated long paragraphs', () => {
  const paragraph = 'Ten sam długi akapit opisuje decyzję instytucji, jej koszt, wykonanie oraz konsekwencje dla mieszkańców i administracji.';
  const result = normalizeArticleBody(
    `## Zdarzenie\n\n${paragraph}\n\n${paragraph}\n\n## Skutek\n\nInny akapit zamyka wątek.`,
    title,
    description,
  );

  assert.equal(result.match(/Ten sam długi akapit/g)?.length, 1);
});
