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
      styleGuide: 'Styl: satyra geopolityczna.',
      contextPack: JSON.stringify({ leadSourceUrl: 'https://example.com/source' }),
      model: 'gpt-5',
      paragraphsPerSection: 2,
    });

    assert.equal(calls.length, 3);
    assert.equal(res.edited.title, outline.finalTitle);
    assert.equal(res.edited.description, outline.description);
    assert(res.edited.markdown.includes('## Pierwsza sekcja'));
    assert(res.edited.markdown.includes('## Druga sekcja'));
    assert(res.edited.markdown.includes('## Trzecia sekcja'));
    assert(res.edited.markdown.length > 800);
    assert.equal(res.edited.markdown.match(/https?:\/\/\S+/g), null);
    assert.doesNotMatch(res.edited.markdown, /^#\s|Opis testowy/m);
  } finally {
    globalThis.fetch = original;
  }
});

test('writeArticleSectioned extracts only the requested section when model returns a full article', async () => {
  const original = globalThis.fetch;
  const calls: any[] = [];
  const responses = [
    '# Tytul testowy\n\nOpis testowy\n\n## Pierwsza sekcja\nPierwsza tresc bez naglowka po ekstrakcji.\n\n## Druga sekcja\nObca tresc.',
    '## Druga sekcja\nDruga tresc.\n\n## Trzecia sekcja\nObca tresc.',
    '## Trzecia sekcja\nTrzecia tresc.',
  ];

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)));
    const content = responses.shift() || 'Tresc.';
    return new Response(
      JSON.stringify({ choices: [{ message: { content } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    const res = await writeArticleSectioned({
      apiKey: 'k',
      outline,
      contextPack: JSON.stringify({ leadSourceUrl: 'https://example.com/source' }),
      paragraphsPerSection: 1,
    });

    assert.equal(calls.length, 3);
    assert.match(res.edited.markdown, /## Pierwsza sekcja\n\nPierwsza tresc/);
    assert.match(res.edited.markdown, /## Druga sekcja\n\nDruga tresc/);
    assert.match(res.edited.markdown, /## Trzecia sekcja\n\nTrzecia tresc/);
    assert.doesNotMatch(res.edited.markdown, /Obca tresc/);
  } finally {
    globalThis.fetch = original;
  }
});
