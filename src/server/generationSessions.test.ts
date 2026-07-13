import test from 'node:test';
import assert from 'node:assert/strict';
import { clearTopic, resolveTopic, waitForTopic } from './generationSessions.js';

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
