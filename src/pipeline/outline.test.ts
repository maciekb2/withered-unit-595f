import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOutline } from './outline.js';

const sampleResponse = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          finalTitle: 'Tytuł',
          description: 'Opis',
          sections: [
            { h2: 'S1', bullets: ['a', 'b'] },
            { h2: 'S2', bullets: ['a', 'b'] },
            { h2: 'S3', bullets: ['a', 'b'] },
            { h2: 'S4', bullets: ['a', 'b'] }
          ],
          guardrails: []
        })
      }
    }
  ]
};

test('generateOutline returns 4-5 sections', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(sampleResponse), { status: 200 }) as any;
  const res = await generateOutline({ apiKey: 'k', baseTopic: 'T' });
  assert.equal(res.outline.sections.length, 4);
  globalThis.fetch = original;
});

test('generateOutline rejects markdown in description', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              finalTitle: 'Tytuł',
              description: 'Opis # z markdown',
              sections: [
                { h2: 'S1', bullets: ['a', 'b'] },
                { h2: 'S2', bullets: ['a', 'b'] },
                { h2: 'S3', bullets: ['a', 'b'] },
                { h2: 'S4', bullets: ['a', 'b'] }
              ],
              guardrails: []
            })
          }
        }
      ]
    }),
    { status: 200 }
  ) as any;

  await assert.rejects(
    () => generateOutline({ apiKey: 'k', baseTopic: 'T' }),
    /markdown/
  );
  globalThis.fetch = original;
});
