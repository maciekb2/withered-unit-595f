import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCarouselCopy, buildCarouselFilter, SOCIAL_CAROUSEL_MAX_SLIDES, SOCIAL_CAROUSEL_MIN_SLIDES } from '../../scripts/social-carousel.mjs';
import { buildBufferAssetsInput } from '../../scripts/social-buffer-assets.mjs';

test('carousel adapts between six and ten slides from one sourced package', () => {
  const copy = buildCarouselCopy(
    { hook: 'Hook sytuacyjny', scenes: ['Wstęp', 'Scena zapasowa'] },
    { lead: 'Rozbudowany lead', summaryPoints: ['Fakt jeden', 'Fakt dwa', 'Fakt trzy', 'Fakt cztery', 'Fakt pięć'], punchline: 'Puenta' },
  );
  assert.equal(SOCIAL_CAROUSEL_MIN_SLIDES, 6);
  assert.equal(SOCIAL_CAROUSEL_MAX_SLIDES, 10);
  assert.equal(copy.length + 1, 10);
  assert.equal(copy.at(-1), 'Pełna analiza na pseudointelekt.pl.');
  assert.doesNotMatch(buildCarouselFilter({ textFile: '', slideNumber: 1, total:10 }), /gblur/u);
  assert.match(buildCarouselFilter({ textFile: '/tmp/slide.txt', textLength:240, slideNumber:2, total:10 }), /fontsize=38/u);
  assert.match(buildCarouselFilter({ textFile: '/tmp/slide.txt', textLength:320, slideNumber:2, total:10 }), /fontsize=34/u);
  assert.match(buildCarouselFilter({ textFile: '/tmp/slide.txt', textLength:240, slideNumber:2, total:10 }), /color=0x000000d9/u);
});

test('Buffer carousel input preserves ordered image assets', () => {
  assert.equal(buildBufferAssetsInput([
    { type: 'image', url: 'https://example.com/01.png' },
    { type: 'image', url: 'https://example.com/02.png' },
  ]), '{image:{url:"https://example.com/01.png"}},{image:{url:"https://example.com/02.png"}}');
});
