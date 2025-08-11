import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDraft } from './draft.js';

const outline = {
  finalTitle: 't',
  description: 'd',
  sections: [
    { h2: 's1', bullets: ['a', 'b'] },
    { h2: 's2', bullets: ['a', 'b'] },
    { h2: 's3', bullets: ['a', 'b'] },
    { h2: 's4', bullets: ['a', 'b'] }
  ],
  guardrails: []
};

test('generateDraft keeps TODO-CLAIM tokens', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({
      choices: [
        { message: { content: 'Niepewna liczba [[TODO-CLAIM]]' } }
      ]
    }),
    { status: 200 }
  ) as any;

  const res = await generateDraft({ apiKey: 'k', outline, articlePrompt: 'p' });
  assert(res.draft.markdown.includes('[[TODO-CLAIM]]'));

  globalThis.fetch = original;
});
