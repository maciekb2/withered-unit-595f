import test from 'node:test';
import assert from 'node:assert/strict';
import { scrubTodoClaims } from './scrubTodoClaims.js';

test('scrubTodoClaims removes tagged sentences', () => {
  const md = 'To jest zdanie.[[TODO-CLAIM]] Kolejne bez tagu.';
  const { cleaned, removedCount } = scrubTodoClaims(md);
  assert.equal(removedCount, 1);
  assert(!cleaned.includes('[[TODO-CLAIM]]'));
});

test('preserves headings on separate lines', () => {
  const md = '## Sekcja\nFakt.[[TODO-CLAIM]] Kolejny.';
  const { cleaned } = scrubTodoClaims(md);
  assert(cleaned.startsWith('## Sekcja\n'));
});
