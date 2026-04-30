import test from 'node:test';
import assert from 'node:assert/strict';
import { writeArticleSectioned } from './sectionedWrite.js';
import type { Outline } from './types.js';

const outline: Outline = {
  finalTitle: 'Tytul testowy',
  description: 'Opis testowy',
  sections: [
    { h2: 'Pierwsza sekcja', bullets: ['teza A', 'teza B'] },
    { h2: 'Druga sekcja', bullets: ['teza C', 'teza D'] },
    { h2: 'Trzecia sekcja', bullets: ['teza E', 'teza F'] },
  ],
  guardrails: [],
};

test('writeArticleSectioned composes one sourced long article from smaller model calls', async () => {
  const original = globalThis.fetch;
  const calls: any[] = [];
  const longParagraph = 'To jest spójny akapit publicystyczny z ironią i jednym tematem. '.repeat(18);
  const responses = [
    `Lead otwiera temat i ustawia tezę. ${longParagraph}`,
    `${longParagraph}\n\n${longParagraph}`,
    `${longParagraph}\n\n${longParagraph}`,
    `${longParagraph}\n\n${longParagraph}`,
  ];

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)));
    const content = responses.shift() || longParagraph;
    return new Response(
      JSON.stringify({ choices: [{ message: { content } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    const res = await writeArticleSectioned({
      apiKey: 'k',
      outline,
      writeTemplate: 'Pisz w stylu bloga.',
      styleGuide: 'Styl: satyra geopolityczna.',
      contextPack: JSON.stringify({ leadSourceUrl: 'https://example.com/source' }),
      model: 'gpt-5',
      paragraphsPerSection: 2,
    });

    assert.equal(calls.length, 4);
    assert.equal(res.edited.title, outline.finalTitle);
    assert.equal(res.edited.description, outline.description);
    assert(res.edited.markdown.includes('## Pierwsza sekcja'));
    assert(res.edited.markdown.includes('## Druga sekcja'));
    assert(res.edited.markdown.includes('## Trzecia sekcja'));
    assert(res.edited.markdown.length > 800);
    assert.deepEqual(res.edited.markdown.match(/https?:\/\/\S+/g), [
      'https://example.com/source',
    ]);
  } finally {
    globalThis.fetch = original;
  }
});
