import test from 'node:test';
import assert from 'node:assert/strict';
import { assessEditorialCandidate } from './editorialCandidate.js';
import type { FinalJson, Outline } from './types.js';

const outline: Outline = {
  finalTitle: 'Test', description: 'Opis', guardrails: [],
  sections: [
    { h2: 'Sekcja pierwsza', bullets: ['a'] },
    { h2: 'Sekcja druga', bullets: ['b'] },
    { h2: 'Sekcja trzecia', bullets: ['c'] },
  ],
};

const makeArticle = (wordsPerSection: number): FinalJson => ({
  title: 'Test', description: 'Opis', sourceUrl: 'https://example.com',
  content: outline.sections.map((section, sectionIndex) =>
    `## ${section.h2}\n\n${Array.from({ length: wordsPerSection }, (_, index) => `sekcja${sectionIndex}slowo${index}`).join(' ')}`,
  ).join('\n\n'),
});

test('rejects a proofreading candidate that collapses a long article', () => {
  const decision = assessEditorialCandidate(makeArticle(400), makeArticle(40), outline);
  assert.equal(decision.accepted, false);
  assert(decision.reasons.some(reason => reason.includes('nadmiernie skrocila')));
});

test('accepts a complete candidate that preserves structure and length', () => {
  const decision = assessEditorialCandidate(makeArticle(400), makeArticle(380), outline);
  assert.equal(decision.accepted, true);
});
