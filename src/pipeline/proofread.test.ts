import test from 'node:test';
import assert from 'node:assert/strict';
import { proofread } from './proofread.js';

const sampleResponse = {
  choices: [
    { message: { content: JSON.stringify({ markdown: 'Tekst', title: 'T', description: 'D' }) } }
  ]
};

test('proofread returns corrected text', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(sampleResponse), { status: 200 }) as any;
  const res = await proofread({ apiKey: 'k', edited: { markdown: 'x', title: 'T', description: 'D' } });
  assert.equal(res.edited.markdown, 'Tekst');
  globalThis.fetch = original;
});
