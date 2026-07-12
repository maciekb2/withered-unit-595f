import test from 'node:test';
import assert from 'node:assert/strict';
import { buildYouTubeDraftText, stripEditorialUrls } from '../../scripts/social-copy.mjs';

test('YouTube draft keeps only the canonical tracked target URL', () => {
  const target = 'https://pseudointelekt.pl/blog/test/?utm_source=youtube&utm_medium=social';
  const text = buildYouTubeDraftText({
    youtubeTitle: 'Testowy tytuł',
    youtubeDescription: 'Opis materiału. Pełna analiza: https://pseudointelekt.pl/blog/2026-07-12-test/',
  }, target);
  assert.equal((text.match(/https?:\/\//gu) || []).length, 1);
  assert.ok(text.endsWith(target));
  assert.equal(text.includes('2026-07-12-test'), false);
});

test('URL stripping removes a dangling CTA label and normalizes spacing', () => {
  assert.equal(stripEditorialUrls('Opis.\n\nPełna analiza: https://example.com/a'), 'Opis.');
});
