import test from 'node:test';
import assert from 'node:assert/strict';
import { assessTopicRelevance, filterEditorialTopics } from './topicRelevance.js';

const topic = (title: string, description = '') => ({
  title, description, url: 'https://example.com', source: 'test', published: new Date().toISOString(),
});

test('rejects entertainment, sport and isolated incidents from automatic generation', () => {
  assert.equal(assessTopicRelevance(topic('Hollywood blockbusters and arthouse films: Sam Neill')).eligible, false);
  assert.equal(assessTopicRelevance(topic('Team wins football tournament after dramatic match')).eligible, false);
  assert.equal(assessTopicRelevance(topic('Fire destroys a warehouse outside London')).eligible, false);
});

test('accepts and ranks geopolitical, economic and technology topics', () => {
  const filtered = filterEditorialTopics([
    topic('Hollywood actor discusses a new film'),
    topic('EU agrees new sanctions on Russia after summit'),
    topic('SpaceX IPO could reshape the technology market'),
  ]);
  assert.deepEqual(filtered.map(item => item.title), [
    'EU agrees new sanctions on Russia after summit',
    'SpaceX IPO could reshape the technology market',
  ]);
});
