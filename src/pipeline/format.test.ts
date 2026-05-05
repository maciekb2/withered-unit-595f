import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFinal } from './format.js';

test('formatFinal rejects short content', () => {
  assert.throws(() => formatFinal({ title: 't', description: 'd', markdown: 'short' }), /content too short/);
});

test('formatFinal adds inferred topic tags', () => {
  const result = formatFinal({
    title: 'Polska flaga na kablu: cyberpożar po awariach',
    description: 'Po cyfrowych awariach państwo powinno ćwiczyć odporność usług.',
    markdown: 'Treść artykułu. '.repeat(80),
  });
  assert.deepEqual(result.tags, ['technologia-i-cyber']);
});
