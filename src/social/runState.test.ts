import test from 'node:test';
import assert from 'node:assert/strict';
import { isFinalizedSocialJobStatus, isSealedSocialRunStatus } from './runState.js';

test('active and reviewed weekly runs cannot be reopened by create', () => {
  for (const status of ['ready', 'processing', 'review', 'queued', 'published']) {
    assert.equal(isSealedSocialRunStatus(status), true);
  }
  assert.equal(isSealedSocialRunStatus('uploading'), false);
});

test('finalize recognizes already queued or processed jobs', () => {
  for (const status of ['ready', 'generating', 'review', 'queued', 'published']) {
    assert.equal(isFinalizedSocialJobStatus(status), true);
  }
  assert.equal(isFinalizedSocialJobStatus('selected'), false);
  assert.equal(isFinalizedSocialJobStatus('failed'), false);
});
