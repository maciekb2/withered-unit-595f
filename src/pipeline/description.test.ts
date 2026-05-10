import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertArticleDescription,
  cleanArticleDescription,
  normalizeObviousPolishNames,
} from './description.js';

test('cleanArticleDescription removes explicit satire labels', () => {
  assert.equal(
    cleanArticleDescription('Satyryczny tekst o tym, jak po cyfrowych awariach państwo ćwiczy odporność.'),
    'Po cyfrowych awariach państwo ćwiczy odporność.',
  );
  assert.equal(
    cleanArticleDescription('Satyra o transatlantyckim rachunku za bezpieczeństwo.'),
    'Komentarz o transatlantyckim rachunku za bezpieczeństwo.',
  );
});

test('assertArticleDescription rejects explicit satire labels', () => {
  assert.throws(
    () => assertArticleDescription('Satyryczny komentarz o polityce.'),
    /satire explicitly/,
  );
});

test('normalizeObviousPolishNames replaces obvious English place names', () => {
  assert.equal(
    normalizeObviousPolishNames('Tenerife ewakuuje statek z wirusem'),
    'Teneryfa ewakuuje statek z wirusem',
  );
});
