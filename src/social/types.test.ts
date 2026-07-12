import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSocialSource, validateSocialSource } from './types.js';

test('buildSocialSource creates a compact, sourced package for the social worker', () => {
  const source = buildSocialSource({
    title: 'Europa zatwierdziła komunikat, rachunek został przy państwach',
    description: 'Wspólna deklaracja nie usunęła kosztów, terminów ani narodowych wyjątków.',
    content: [
      '## Pierwsza sekcja',
      'Pierwszy długi akapit opisuje decyzję, wykonanie oraz koszt ponoszony przez uczestników porozumienia. '.repeat(2),
      'Drugi długi akapit pokazuje rozbieżność między komunikatem a rzeczywistym harmonogramem działania. '.repeat(2),
      'Trzeci długi akapit domyka analizę konsekwencjami, które zostają po zakończeniu konferencji. '.repeat(2),
    ].join('\n\n'),
    tags: ['europa', 'geopolityka'],
    sourceUrl: 'https://example.com/source',
  }, 'europa-komunikat-i-rachunek', '2026-07-12T10:00:00.000Z');
  assert.equal(source.articleUrl, 'https://pseudointelekt.pl/blog/2026-07-12-europa-komunikat-i-rachunek/');
  assert.equal(source.slug, '2026-07-12-europa-komunikat-i-rachunek');
  assert.equal(source.heroUrl, 'https://pseudointelekt.pl/blog-images/2026-07-12-europa-komunikat-i-rachunek.png');
  assert.equal(source.summaryPoints.length, 3);
  assert.deepEqual(validateSocialSource(source), []);
});

test('validateSocialSource rejects incomplete packages', () => {
  const errors = validateSocialSource({ slug: 'x', title: 'krótki', lead: 'krótki', summaryPoints: [], punchline: '', tags: [], heroUrl: 'http://x', articleUrl: 'x', publishedAt: '' });
  assert.ok(errors.length >= 5);
});
