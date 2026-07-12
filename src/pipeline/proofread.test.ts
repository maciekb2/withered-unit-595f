import test from 'node:test';
import assert from 'node:assert/strict';
import { proofread } from './proofread';

test('proofread preserves the article contract and uses the local provider', async () => {
  const original = globalThis.fetch;
  let body: any;
  globalThis.fetch = (async (_input, init) => {
    body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ response: JSON.stringify({ title: 'Nowy tytuł', description: 'Krótki opis.', markdown: '## Sekcja\nPoprawiony akapit bez nowych faktów.' }) }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    const result = await proofread({
      apiKey: '',
      model: 'qwen3:30b',
      provider: { type: 'jetson', gatewayUrl: 'https://gateway.test', token: 'token', model: 'qwen3:30b', timeoutMs: 1000, disableThinking: false, fallback: 'none' },
      edited: { title: 'Stary tytuł', description: 'Opis.', markdown: '## Sekcja\nStary akapit.' },
      maxTokens: 500,
    });
    assert.equal(result.edited.title, 'Nowy tytuł');
    assert.equal(result.edited.description, 'Krótki opis.');
    assert.equal(body.model, 'qwen3:30b');
  } finally {
    globalThis.fetch = original;
  }
});
