import test from 'node:test';
import assert from 'node:assert/strict';
import { generateHeroImage } from './heroImageGenerator.js';

test('generateHeroImage uses low-cost GPT Image model without DALL-E style parameter', async () => {
  const original = globalThis.fetch;
  let body: any;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({ data: [{ b64_json: Buffer.from('image').toString('base64') }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    const image = await generateHeroImage({
      apiKey: 'k',
      prompt: 'prompt',
      model: 'gpt-image-1-mini',
      quality: 'low',
      style: 'vivid',
    });

    assert.equal(image.toString(), 'image');
    assert.equal(body.model, 'gpt-image-1-mini');
    assert.equal(body.quality, 'low');
    assert.equal(body.style, undefined);
  } finally {
    globalThis.fetch = original;
  }
});

test('generateHeroImage keeps DALL-E style compatibility', async () => {
  const original = globalThis.fetch;
  let body: any;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({ data: [{ b64_json: Buffer.from('image').toString('base64') }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    await generateHeroImage({
      apiKey: 'k',
      prompt: 'prompt',
      model: 'dall-e-3',
      quality: 'hd',
      style: 'natural',
    });

    assert.equal(body.model, 'dall-e-3');
    assert.equal(body.quality, 'hd');
    assert.equal(body.style, 'natural');
  } finally {
    globalThis.fetch = original;
  }
});
