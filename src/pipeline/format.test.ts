import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFinal } from './format.js';

test('formatFinal rejects short content', () => {
  assert.throws(() => formatFinal({ title: 't', description: 'd', markdown: 'short' }), /content too short/);
});
