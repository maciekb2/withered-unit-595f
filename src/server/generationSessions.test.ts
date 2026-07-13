import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearTopic,
  isTopicSelectionError,
  resolveTopic,
  TopicSelectionError,
  waitForTopic,
} from './generationSessions.js';

test('topic session resolves exactly once and removes the pending resolver', async () => {
  const result = waitForTopic('session-resolve', 1000);

  assert.equal(resolveTopic('session-resolve', 'Nowy temat'), true);
  assert.deepEqual(await result, { topic: 'Nowy temat' });
  assert.equal(resolveTopic('session-resolve', 'Drugi temat'), false);
});

test('topic session rejects after its bounded wait time', async () => {
  const result = waitForTopic('session-timeout', 5);

  await assert.rejects(result, /Topic selection timed out/);
  assert.equal(resolveTopic('session-timeout', 'Za późno'), false);
});

test('new wait replaces and rejects an older request for the same session', async () => {
  const first = waitForTopic('session-reused', 1000);
  const second = waitForTopic('session-reused', 1000);

  await assert.rejects(first, /replaced by a newer request/);
  assert.equal(resolveTopic('session-reused', 'Aktualny temat'), true);
  assert.deepEqual(await second, { topic: 'Aktualny temat' });
});

test('clearTopic rejects a pending wait and is safe for unknown sessions', async () => {
  const result = waitForTopic('session-clear', 1000);
  clearTopic('session-clear');
  clearTopic('missing-session');

  await assert.rejects(result, /Topic selection cancelled/);
});

test('topic selection errors expose stable cancellation codes', async () => {
  const result = waitForTopic('session-coded-clear', 1000);
  clearTopic(
    'session-coded-clear',
    new TopicSelectionError('stream disconnected', 'TOPIC_CANCELLED'),
  );

  await assert.rejects(result, error => {
    assert.equal(isTopicSelectionError(error), true);
    assert.equal((error as TopicSelectionError).code, 'TOPIC_CANCELLED');
    return true;
  });
  assert.equal(isTopicSelectionError(new Error('ordinary failure')), false);
});
