import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCarouselCopy, buildCarouselFilter, SOCIAL_CAROUSEL_SLIDES } from '../../scripts/social-carousel.mjs';
import { buildBufferAssetsInput } from '../../scripts/social-buffer-assets.mjs';

test('carousel uses a clean cover followed by five concise editorial slides', () => {
  const copy = buildCarouselCopy({ hook: 'Hook sytuacyjny', instagramCaption: 'Opis', scenes: ['Wstęp', 'Fakt jeden', 'Fakt dwa', 'Fakt trzy', 'Puenta'] });
  assert.equal(SOCIAL_CAROUSEL_SLIDES, 6);
  assert.deepEqual(copy, ['Hook sytuacyjny', 'Fakt jeden', 'Fakt dwa', 'Fakt trzy', 'Pełna analiza na pseudointelekt.pl.']);
  assert.doesNotMatch(buildCarouselFilter({ textFile: '', slideNumber: 1 }), /gblur/u);
  assert.match(buildCarouselFilter({ textFile: '/tmp/slide.txt', slideNumber: 2 }), /gblur=sigma=12/u);
  assert.match(buildCarouselFilter({ textFile: '/tmp/slide.txt', slideNumber: 2 }), /color=0x000000d9/u);
});

test('Buffer carousel input preserves ordered image assets', () => {
  assert.equal(buildBufferAssetsInput([
    { type: 'image', url: 'https://example.com/01.png' },
    { type: 'image', url: 'https://example.com/02.png' },
  ]), '{image:{url:"https://example.com/01.png"}},{image:{url:"https://example.com/02.png"}}');
});
