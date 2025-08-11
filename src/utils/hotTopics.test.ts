import test from 'node:test';
import assert from 'node:assert/strict';
import { getHotTopics } from './hotTopics.js';

test('getHotTopics returns at least 3 topics with title and url', async () => {
  const topics = await getHotTopics();
  assert.ok(Array.isArray(topics));
  assert.ok(topics.length >= 3);
  for (const t of topics.slice(0, 3)) {
    assert.equal(typeof t.title, 'string');
    assert.ok(t.title.length > 0);
    assert.equal(typeof t.url, 'string');
    assert.ok(t.url.length > 0);
  }
});
