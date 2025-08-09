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

test('fails report without source', () => {
  const md = `## Sec1\nWedług najnowszego raportu Instytut XYZ donosi o problemie.\n\n## Sec2\ntekst\n\n## Sec3\ntekst\n\n## Sec4\ntekst`;
  const res = validateAntiHallucination(md, outline);
  assert.equal(res.ok, false);
  assert(res.errors.some(e => e.includes('Raport bez źródła')));
});

test('warns for numbers without context', () => {
  const md = `## Sec1\nObecnie 10 osób czeka, w magazynie 20 produktów, a rok temu było 30.\n\n## Sec2\ntekst\n\n## Sec3\ntekst\n\n## Sec4\ntekst`;
  const res = validateAntiHallucination(md, outline);
  assert.equal(res.ok, true);
  assert(res.errors.some(e => e.startsWith('WARN')));
});
