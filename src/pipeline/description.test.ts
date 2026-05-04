import test from 'node:test';
import assert from 'node:assert/strict';
import { assertArticleDescription, cleanArticleDescription } from './description.js';

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
