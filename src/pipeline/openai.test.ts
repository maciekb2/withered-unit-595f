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
    assert.match(capturedBody.prompt, /\[user\]/);
    assert.match(capturedBody.prompt, /Napisz lead/);
    assert.equal(capturedBody.messages, undefined);
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

test('chat disables Jetson for the current run after the first fallback', async () => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  const provider = {
    type: 'jetson' as const,
    gatewayUrl: 'https://jetson.example.test',
    token: 'jetson-token',
    fallback: 'openai' as const,
    fallbackModel: 'gpt-5.5',
  };

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.includes('jetson.example.test')) {
      return new Response('gateway timeout', { status: 524 });
    }
    return new Response(
      JSON.stringify({ choices: [{ message: { content: 'tekst z openai' } }] }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    await chat('openai-key', {
      messages: [{ role: 'user', content: 'Napisz lead' }],
      max_completion_tokens: 100,
      model: 'gpt-5',
      provider,
    });
    await chat('openai-key', {
      messages: [{ role: 'user', content: 'Napisz kolejną sekcję' }],
      max_completion_tokens: 100,
      model: 'gpt-5',
      provider,
    });

    assert.deepEqual(urls, [
      'https://jetson.example.test/api/generate',
      'https://api.openai.com/v1/chat/completions',
      'https://api.openai.com/v1/chat/completions',
    ]);
  } finally {
    globalThis.fetch = original;
  }
});

test('chat uses Cloudflare Workers AI binding when configured', async () => {
  const calls: Array<{ model: string; body: any }> = [];
  const result = await chat('openai-key', {
    messages: [{ role: 'user', content: 'Napisz lead' }],
    max_completion_tokens: 100,
    model: 'gpt-5',
    provider: {
      type: 'cloudflare-ai',
      model: '@cf/qwen/qwen3-30b-a3b-fp8',
      dailyNeuronLimit: 8000,
      binding: {
        run: async (model: string, body: any) => {
          calls.push({ model, body });
          return { response: 'tekst z workers ai' };
        },
      } as unknown as Ai,
    },
  });

  assert.equal(result, 'tekst z workers ai');
  assert.equal(calls[0].model, '@cf/qwen/qwen3-30b-a3b-fp8');
  assert.equal(calls[0].body.max_tokens, 100);
  assert.deepEqual(calls[0].body.messages, [{ role: 'user', content: 'Napisz lead' }]);
});

test('chat falls back from Cloudflare Workers AI to OpenAI when budget is exhausted', async () => {
  const original = globalThis.fetch;
  let openAiBody: any;
  const db = {
    prepare: () => ({
      bind: () => ({
        first: async () => ({ used: 7999 }),
      }),
    }),
  } as unknown as D1Database;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
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
      messages: [{ role: 'user', content: 'Napisz dłuższy lead' }],
      max_completion_tokens: 2000,
      model: 'gpt-5',
      provider: {
        type: 'cloudflare-ai',
        model: '@cf/qwen/qwen3-30b-a3b-fp8',
        dailyNeuronLimit: 8000,
        logsDb: db,
        fallback: 'openai',
        fallbackModel: 'gpt-5.5',
        binding: {
          run: async () => ({ response: 'nie powinno sie wykonac' }),
        } as unknown as Ai,
      },
    });

    assert.equal(result, 'tekst z openai');
    assert.equal(openAiBody.model, 'gpt-5.5');
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

test('Jetson gateway maps Chat messages to the native prompt contract', async () => {
  const original = globalThis.fetch;
  let requestBody: any;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ response: '{"ok":true}' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    const result = await chat('unused', {
      messages: [{ role: 'user', content: 'Zwróć JSON.' }],
      max_completion_tokens: 100,
      model: 'qwen3:30b',
      response_format: { type: 'json_schema', json_schema: { name: 'x', schema: {} } },
      provider: {
        type: 'jetson',
        gatewayUrl: 'https://jetson.example.test',
        token: 'secret',
        model: 'qwen3:30b',
        timeoutMs: 5000,
        disableThinking: true,
        fallback: 'none',
      },
    });
    assert.equal(result, '{"ok":true}');
    assert.match(requestBody.prompt, /\[user\]/);
    assert.match(requestBody.prompt, /Zwróć JSON/);
    assert.equal(requestBody.format, undefined);
    assert.equal(requestBody.response_format, undefined);
  } finally {
    globalThis.fetch = original;
  }
});

test('Jetson gateway rejects a successful but unsupported response shape', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ done: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch;

  try {
    await assert.rejects(
      chat('unused', {
        messages: [{ role: 'user', content: 'Napisz lead.' }],
        max_completion_tokens: 100,
        provider: {
          type: 'jetson',
          gatewayUrl: 'https://jetson.example.test',
          token: 'secret',
          timeoutMs: 1000,
          fallback: 'none',
        },
      }),
      /Jetson gateway response empty/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test('Jetson gateway falls back once after an empty response', async () => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  const provider = {
    type: 'jetson' as const,
    gatewayUrl: 'https://jetson.example.test',
    token: 'secret',
    timeoutMs: 1000,
    fallback: 'openai' as const,
    fallbackModel: 'gpt-5.5',
  };
  globalThis.fetch = (async input => {
    const url = String(input);
    urls.push(url);
    if (url.includes('jetson.example.test')) {
      return new Response(JSON.stringify({ response: '' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return Response.json({ choices: [{ message: { content: 'awaryjna odpowiedź' } }] });
  }) as typeof fetch;

  try {
    const first = await chat('openai-key', {
      messages: [{ role: 'user', content: 'Napisz lead.' }],
      max_completion_tokens: 100,
      provider,
    });
    const second = await chat('openai-key', {
      messages: [{ role: 'user', content: 'Napisz drugą sekcję.' }],
      max_completion_tokens: 100,
      provider,
    });

    assert.equal(first, 'awaryjna odpowiedź');
    assert.equal(second, 'awaryjna odpowiedź');
    assert.deepEqual(urls, [
      'https://jetson.example.test/api/generate',
      'https://api.openai.com/v1/chat/completions',
      'https://api.openai.com/v1/chat/completions',
    ]);
  } finally {
    globalThis.fetch = original;
  }
});

test('textGenerationProviderFromEnv reads Cloudflare Workers AI config', () => {
  const ai = { run: async () => ({ response: 'ok' }) } as unknown as Ai;
  const db = {} as D1Database;

  const provider = textGenerationProviderFromEnv({
    TEXT_GENERATION_PROVIDER: 'cloudflare-ai',
    TEXT_GENERATION_FALLBACK: 'none',
    CLOUDFLARE_AI_TEXT_MODEL: '@cf/openai/gpt-oss-120b',
    CLOUDFLARE_AI_DAILY_NEURON_LIMIT: '6000',
    TEXT_GENERATION_FALLBACK_MODEL: 'gpt-5.5',
    OPENAI_TEXT_MODEL: 'gpt-5.5',
    AI: ai,
    pseudointelekt_logs_db: db,
  } as Env);

  assert.deepEqual(provider, {
    type: 'cloudflare-ai',
    binding: ai,
    logsDb: db,
    model: '@cf/openai/gpt-oss-120b',
    fallback: 'none',
    fallbackModel: 'gpt-5.5',
    dailyNeuronLimit: 6000,
  });
});
