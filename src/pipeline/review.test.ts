import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewArticle } from './review';

test('reviewArticle parses structured reviewer JSON through the selected provider', async () => {
  const original = globalThis.fetch;
  let body: any;
  globalThis.fetch = (async (_input, init) => {
    body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ response: JSON.stringify({ ok: false, issues: ['powtórzony akapit'], suggestions: ['skrócić lead'] }) }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    const result = await reviewArticle({
      apiKey: '',
      model: 'gpt-oss:20b',
      provider: { type: 'jetson', gatewayUrl: 'https://gateway.test', token: 'token', model: 'gpt-oss:20b', timeoutMs: 1000, disableThinking: false, fallback: 'none' },
      article: { title: 'Tytuł', description: 'Opis', content: 'Treść' },
    });
    assert.equal(result.review.ok, false);
    assert.deepEqual(result.review.issues, ['powtórzony akapit']);
    assert.equal(body.model, 'gpt-oss:20b');
  } finally {
    globalThis.fetch = original;
  }
});
