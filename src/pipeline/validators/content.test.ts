import { validateAntiHallucination } from './content';
import type { Outline } from '../types';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const outline: Outline = {
  finalTitle: 'T',
  description: 'D',
  sections: [
    { h2: 'Sec1', bullets: ['a', 'b'] },
    { h2: 'Sec2', bullets: ['a', 'b'] },
    { h2: 'Sec3', bullets: ['a', 'b'] },
    { h2: 'Sec4', bullets: ['a', 'b'] },
  ],
  guardrails: [],
};

test('fails when sourceUrl metadata is missing', () => {
  const md = `## Sec1\nWedług najnowszego raportu Instytut XYZ donosi o problemie.\n\n## Sec2\ntekst\n\n## Sec3\ntekst\n\n## Sec4\ntekst`;
  const res = validateAntiHallucination(md, outline);
  assert.equal(res.ok, false);
  assert(res.errors.some(e => e.includes('Brak poprawnego sourceUrl')));
});

test('accepts sourced metadata and rejects raw source URLs in body', () => {
  const md = `## Sec1\nWedług statystyk obecnie 10 osób czeka, w magazynie 20 produktów, a rok temu było 30.\n\n## Sec2\ntekst\n\n## Sec3\ntekst\n\n## Sec4\ntekst`;
  const res = validateAntiHallucination(md, outline, 'https://example.com/source');
  assert.equal(res.ok, true);

  const withRawUrl = validateAntiHallucination(`${md}\n\nhttps://example.com/source`, outline, 'https://example.com/source');
  assert.equal(withRawUrl.ok, false);
  assert(withRawUrl.errors.some(e => e.includes('metadanych, nie w body')));
});
