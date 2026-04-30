import test from 'node:test';
import assert from 'node:assert/strict';
import { chat, textGenerationProviderFromEnv } from './openai.js';

test('chat sends Jetson requests with bearer token and thinking disabled', async () => {
  const original = globalThis.fetch;
  let capturedUrl = '';
  let capturedHeaders = new Headers();
  let capturedBody: any;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedHeaders = new Headers(init?.headers);
    capturedBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ response: 'tekst z jetsona' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const result = await chat('openai-key', {
      messages: [{ role: 'user', content: 'Napisz lead' }],
      max_completion_tokens: 100,
      model: 'gpt-5',
      provider: {
        type: 'jetson',
        gatewayUrl: 'https://jetson.example.test',
        token: 'jetson-token',
        model: 'qwen3:4b',
        timeoutMs: 1000,
        disableThinking: true,
        fallback: 'none',
      },
    });

    assert.equal(result, 'tekst z jetsona');
    assert.equal(capturedUrl, 'https://jetson.example.test/api/generate');
    assert.equal(capturedHeaders.get('Authorization'), 'Bearer jetson-token');
    assert.equal(capturedHeaders.get('x-openclaw-disable-thinking'), 'true');
    assert.equal(capturedBody.model, 'qwen3:4b');
    assert.equal(capturedBody.options.num_predict, 100);
    assert.deepEqual(capturedBody.messages, [{ role: 'user', content: 'Napisz lead' }]);
  } finally {
    globalThis.fetch = original;
  }
});

test('chat falls back from Jetson to OpenAI when fallback is enabled', async () => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  let openAiBody: any;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    urls.push(url);
    if (url.includes('jetson.example.test')) {
      return new Response('gateway unavailable', { status: 418 });
    }
    openAiBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({ choices: [{ message: { content: 'tekst z openai' } }] }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    const result = await chat('openai-key', {
      messages: [{ role: 'user', content: 'Napisz lead' }],
      max_completion_tokens: 100,
      model: 'gpt-5',
      provider: {
        type: 'jetson',
        gatewayUrl: 'https://jetson.example.test',
        token: 'jetson-token',
        fallback: 'openai',
        fallbackModel: 'gpt-5.5',
      },
    });

    assert.equal(result, 'tekst z openai');
    assert.equal(openAiBody.model, 'gpt-5.5');
    assert.deepEqual(urls, [
      'https://jetson.example.test/api/generate',
      'https://api.openai.com/v1/chat/completions',
    ]);
  } finally {
    globalThis.fetch = original;
  }
});

test('textGenerationProviderFromEnv defaults to OpenAI and reads Jetson config without secrets in vars', () => {
  assert.deepEqual(textGenerationProviderFromEnv({} as Env), { type: 'openai' });

  const provider = textGenerationProviderFromEnv({
    TEXT_GENERATION_PROVIDER: 'jetson',
    TEXT_GENERATION_FALLBACK: 'none',
    JETSON_GATEWAY_URL: 'https://jetson.example.test',
    JETSON_GATEWAY_TOKEN: 'secret',
    JETSON_GATEWAY_MODEL: 'qwen3:4b',
    JETSON_GATEWAY_TIMEOUT_MS: '5000',
    JETSON_GATEWAY_DISABLE_THINKING: 'false',
    TEXT_GENERATION_FALLBACK_MODEL: 'gpt-5.5',
  } as Env);

  assert.deepEqual(provider, {
    type: 'jetson',
    gatewayUrl: 'https://jetson.example.test',
    token: 'secret',
    model: 'qwen3:4b',
    timeoutMs: 5000,
    disableThinking: false,
    fallback: 'none',
    fallbackModel: 'gpt-5.5',
    accessClientId: undefined,
    accessClientSecret: undefined,
  });
});
