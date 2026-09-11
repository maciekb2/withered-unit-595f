import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationInput } from './publication-input.ts';

const valid = { BASE_TOPIC: 'Porty i zamówienia', LEAD_SOURCE_URL: 'https://commission.europa.eu/news/example', SOURCE_CONTEXT: 'Zweryfikowany kontekst wydarzenia.', ARTICLE_TOPIC: 'europa-i-unia', PUBLICATION_DATE: '2026-09-01' };
test('explicit publication input retains source, date and canonical topic', () => {
  const input = publicationInput(valid);
  assert.equal(input.date, valid.PUBLICATION_DATE);
  assert.equal(input.topic, valid.ARTICLE_TOPIC);
  assert.equal(input.topicDescription, valid.SOURCE_CONTEXT);
  assert.equal(input.leadSourceUrl, valid.LEAD_SOURCE_URL);
});
for (const [key, value] of [['BASE_TOPIC', ''], ['LEAD_SOURCE_URL', 'https://example.com'], ['LEAD_SOURCE_URL', 'file:///tmp/a'], ['LEAD_SOURCE_URL', 'https://user:password@example.org'], ['SOURCE_CONTEXT', ''], ['SOURCE_CONTEXT', 'x'.repeat(501)], ['ARTICLE_TOPIC', 'made-up'], ['PUBLICATION_DATE', '2026-09-31']]) {
  test(`reject unsafe publication input ${key}: ${value.slice(0, 30)}`, () => assert.throws(() => publicationInput({ ...valid, [key]: value })));
}
