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

test('formatFinal rejects likely English titles', () => {
  assert.throws(
    () => formatFinal({
      title: 'Spain starts evacuating virus-hit cruise ship in Tenerife',
      description: 'Po kryzysie sanitarnym procedury wracają na pokład.',
      markdown: 'Treść artykułu. '.repeat(80),
    }),
    /title must be in Polish/,
  );
});

test('formatFinal normalizes obvious English place names in title', () => {
  const result = formatFinal({
    title: 'Tenerife ewakuuje statek z wirusem',
    description: 'Po kryzysie sanitarnym procedury wracają na pokład.',
    markdown: 'Treść artykułu. '.repeat(80),
  });

  assert.equal(result.title, 'Teneryfa ewakuuje statek z wirusem');
});
