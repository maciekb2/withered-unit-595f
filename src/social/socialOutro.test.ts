import test from 'node:test';
import assert from 'node:assert/strict';
import { OUTRO_FRAME_COUNT, outroFrameSvg } from '../../scripts/social-outro.mjs';

test('outro starts with the wordmark and ends with a visible brain mark', () => {
  const first = outroFrameSvg(0);
  const last = outroFrameSvg(OUTRO_FRAME_COUNT - 1);
  assert.match(first, />PSEUDOINTELEKT<\/text>/u);
  assert.match(first, /fill-opacity="1\.000"/u);
  assert.match(last, /opacity="1\.000"/u);
  assert.match(last, /M535 820 C485 770/u);
});

test('outro uses a reusable deterministic particle field', () => {
  const frame = outroFrameSvg(60);
  assert.equal((frame.match(/<circle /gu) || []).length, 180);
  assert.equal(frame, outroFrameSvg(60));
});
