import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyBufferPost } from '../../scripts/social-buffer-state.mjs';

const now = new Date('2026-07-12T12:00:00Z');

test('zero-valued YouTube metrics do not turn a Buffer draft into a publication', () => {
  const post = { dueAt: null, metricsUpdatedAt: now.toISOString(), metrics: [{ type: 'views', value: 0 }] };
  assert.deepEqual(classifyBufferPost(post, {}, now), { status: 'draft', publishedAt: null });
});

test('future due date is queued and past due date is published', () => {
  assert.deepEqual(classifyBufferPost({ dueAt: '2026-07-13T12:00:00Z' }, {}, now), { status: 'queued', publishedAt: null });
  const published = classifyBufferPost({ dueAt: '2026-07-11T12:00:00Z' }, {}, now);
  assert.equal(published.status, 'published');
  assert.equal(published.publishedAt?.toISOString(), '2026-07-11T12:00:00.000Z');
});

test('real metric activity is a conservative fallback publication signal', () => {
  const post = { dueAt: null, metricsUpdatedAt: '2026-07-12T11:00:00Z', metrics: [{ type: 'views', value: 1 }] };
  const result = classifyBufferPost(post, {}, now);
  assert.equal(result.status, 'published');
  assert.equal(result.publishedAt?.toISOString(), '2026-07-12T11:00:00.000Z');
});
