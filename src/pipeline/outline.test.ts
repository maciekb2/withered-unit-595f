import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOutline } from './outline.js';

const sampleResponse = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          finalTitle: 'Tytul',
          description: 'Opis',
          sections: [
            { h2: 'S1', bullets: ['a', 'b'] },
            { h2: 'S2', bullets: ['a', 'b'] },
            { h2: 'S3', bullets: ['a', 'b'] },
          ],
          guardrails: [],
        }),
      },
    },
  ],
};

test('generateOutline returns exactly 3 sections with 2 bullets', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(sampleResponse), { status: 200 }) as any;
  const res = await generateOutline({ apiKey: 'k', baseTopic: 'T' });
  assert.equal(res.outline.sections.length, 3);
  assert.ok(res.outline.sections.every(s => s.bullets.length === 2));
  globalThis.fetch = original;
});

test('generateOutline rejects markdown in description', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                finalTitle: 'Tytul',
                description: 'Opis # z markdown',
                sections: [
                  { h2: 'S1', bullets: ['a', 'b'] },
                  { h2: 'S2', bullets: ['a', 'b'] },
                  { h2: 'S3', bullets: ['a', 'b'] },
                ],
                guardrails: [],
              }),
            },
          },
        ],
      }),
      { status: 200 },
    ) as any;

  await assert.rejects(() => generateOutline({ apiKey: 'k', baseTopic: 'T' }), /markdown/);
  globalThis.fetch = original;
});

test('generateOutline rejects likely English title and description', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                finalTitle: 'Spain starts evacuating virus-hit cruise ship in Tenerife',
                description: 'Cruise ship crisis reveals systemic fragility amid pandemic-era complacency',
                sections: [
                  { h2: 'S1', bullets: ['a', 'b'] },
                  { h2: 'S2', bullets: ['a', 'b'] },
                  { h2: 'S3', bullets: ['a', 'b'] },
                ],
                guardrails: [],
              }),
            },
          },
        ],
      }),
      { status: 200 },
    ) as any;

  await assert.rejects(() => generateOutline({ apiKey: 'k', baseTopic: 'T' }), /finalTitle must be in Polish/);
  globalThis.fetch = original;
});

test('generateOutline replaces section headings that repeat the title', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                finalTitle: 'Atlantycka kłótnia przy rodzinnej zastawie',
                description: 'Opis',
                sections: [
                  { h2: 'Atlantycka kłótnia przy rodzinnej zastawie', bullets: ['a', 'b'] },
                  { h2: 'Rachunek pod obrusem', bullets: ['a', 'b'] },
                  { h2: 'Polska puenta', bullets: ['a', 'b'] },
                ],
                guardrails: [],
              }),
            },
          },
        ],
      }),
      { status: 200 },
    ) as any;

  try {
    const res = await generateOutline({ apiKey: 'k', baseTopic: 'T' });
    assert.equal(res.outline.sections[0].h2, 'Zdarzenie');
    assert.equal(res.outline.sections[1].h2, 'Rachunek pod obrusem');
  } finally {
    globalThis.fetch = original;
  }
});

test('generateOutline exposes prompt and raw on error', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), { status: 200 }) as any;

  await assert.rejects(async () => {
    await generateOutline({ apiKey: 'k', baseTopic: 'T' });
  }, (err: any) => {
    assert.ok(err.messages.some((m: any) => m.role === 'user' && m.content.includes('Temat bazowy: T')));
    assert.equal(err.raw, '');
    return /OpenAI response empty|No JSON/.test(err.message);
  });
  globalThis.fetch = original;
});
