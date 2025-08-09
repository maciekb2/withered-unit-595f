import test from 'node:test';
import assert from 'node:assert/strict';
import { editDraft } from './edit.js';

test('editDraft enforces title/description length', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              markdown: 'tekst',
              title: 't'.repeat(101),
              description: 'd'.repeat(50)
            })
          }
        }
      ]
    }),
    { status: 200 }
  ) as any;

  await assert.rejects(
    () => editDraft({ apiKey: 'k', draft: { markdown: 'm' }, outline: { finalTitle: 't', description: 'd', sections: [], guardrails: [] } }),
    /too long/
  );
  globalThis.fetch = original;
});

test('editDraft rejects markdown in description', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              markdown: 'tekst',
              title: 'ok',
              description: 'opis #' 
            })
          }
        }
      ]
    }),
    { status: 200 }
  ) as any;

  await assert.rejects(
    () =>
      editDraft({
        apiKey: 'k',
        draft: { markdown: 'm' },
        outline: { finalTitle: 't', description: 'd', sections: [], guardrails: [] },
      }),
    /markdown/
  );
  globalThis.fetch = original;
});

test('editDraft scrubs TODO claims and logs warning', async () => {
  const logs: string[] = [];
  const origConsole = console.log;
  console.log = (msg: any, ...rest: any[]) => { logs.push(String(msg)); };

  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              markdown: 'Liczba to 123 [[TODO-CLAIM]].',
              title: 'ok',
              description: 'opis'
            })
          }
        }
      ]
    }),
    { status: 200 }
  ) as any;

  const res = await editDraft({ apiKey: 'k', draft: { markdown: 'm' }, outline: { finalTitle: 't', description: 'd', sections: [], guardrails: [] } });
  assert(!res.markdown.includes('[[TODO-CLAIM]]'));
  const logged = logs.some(l => l.includes('todo-claim-warning') && l.includes('"removedCount":1'));
  assert(logged);

  console.log = origConsole;
  globalThis.fetch = original;
});
