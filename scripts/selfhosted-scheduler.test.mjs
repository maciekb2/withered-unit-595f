import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSsePayloads, renderSchedulerMetrics, shouldRetry, summarizeGenerationEvents } from './selfhosted-scheduler-lib.mjs';

test('scheduler extracts a retryable failure from generation SSE', () => {
  const events = parseSsePayloads('data: {"stage":"outline","baseTopic":"Temat testowy"}\n\ndata: {"stage":"write","failed":true,"retryable":true,"errorCode":"UPSTREAM","errorMessage":"awaria"}\n\n');
  const result = summarizeGenerationEvents(events);
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'write');
  assert.equal(result.errorCode, 'UPSTREAM');
  assert.equal(result.error, 'awaria');
  assert.equal(result.topic, 'Temat testowy');
  assert.equal(shouldRetry(result, 1), true);
  assert.equal(shouldRetry(result, 2), false);
});

test('scheduler does not retry permanent generation errors', () => {
  assert.equal(shouldRetry({ ok: false, retryable: false }, 1), false);
});

test('scheduler metrics preserve last success and expose failure', () => {
  const metrics = renderSchedulerMetrics({
    status: 'failed', attempt: 2,
    lastRunAt: '2026-07-13T10:00:00.000Z',
    lastSuccessAt: '2026-07-12T10:00:00.000Z',
  });
  assert.match(metrics, /pseudointelekt_generation_status 0/);
  assert.match(metrics, /pseudointelekt_generation_last_attempt 2/);
  assert.doesNotMatch(metrics, /NaN/);
});
