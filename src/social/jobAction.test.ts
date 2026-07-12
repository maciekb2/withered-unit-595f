import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSocialJobAction } from './jobAction.js';

test('retry and regenerate reset the attempt budget', () => {
  assert.deepEqual(resolveSocialJobAction('retry'), { status: 'ready', resetAttempts: true });
  assert.deepEqual(resolveSocialJobAction('regenerate'), { status: 'ready', resetAttempts: true });
});

test('skip preserves attempt history and unknown actions are rejected', () => {
  assert.deepEqual(resolveSocialJobAction('skip'), { status: 'skipped', resetAttempts: false });
  assert.equal(resolveSocialJobAction('publish'), null);
});
