import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChannelHashtags, buildYouTubeDraftText, stripEditorialUrls } from '../../scripts/social-copy.mjs';

test('YouTube draft keeps only the canonical tracked target URL', () => {
  const target = 'https://pseudointelekt.pl/blog/test/?utm_source=youtube&utm_medium=social';
  const text = buildYouTubeDraftText({
    youtubeTitle: 'Testowy tytuł',
    youtubeDescription: 'Opis materiału. Pełna analiza: https://pseudointelekt.pl/blog/2026-07-12-test/',
    hashtags: ['#geopolityka', '#Europa', '#nadmiar'],
  }, target);
  assert.equal((text.match(/https?:\/\//gu) || []).length, 1);
  assert.ok(text.endsWith(target));
  assert.equal(text.includes('2026-07-12-test'), false);
  assert.match(text, /#Pseudointelekt #geopolityka #Europa/u);
  assert.equal(text.includes('#nadmiar'), false);
});

test('URL stripping removes a dangling CTA label and normalizes spacing', () => {
  assert.equal(stripEditorialUrls('Opis.\n\nPełna analiza: https://example.com/a'), 'Opis.');
});

test('channel hashtags add the brand, deduplicate and keep conservative limits', () => {
  const input = ['#Geopolityka', '#pseudointelekt', '#Europa', '#UE', '#Polityka', '#Nadmiar', 'bezHashtaga'];
  assert.deepEqual(buildChannelHashtags(input, 'youtube'), ['#Pseudointelekt', '#Geopolityka', '#Europa']);
  assert.deepEqual(buildChannelHashtags(input, 'instagram'), ['#Pseudointelekt', '#Geopolityka', '#Europa', '#UE', '#Polityka']);
});
