import test from 'node:test';
import assert from 'node:assert/strict';
import { detectLanguageIssues, ensurePolishArticleLanguage } from './languageGuard.js';
import type { Edited } from './types.js';

function polishArticle(overrides: Partial<Edited> = {}): Edited {
  return {
    title: 'Polska flaga na kablu: cyberpożar po awariach',
    description: 'Po cyfrowych awariach państwo ćwiczy odporność usług i procedur.',
    markdown: [
      '# Polska flaga na kablu: cyberpożar po awariach',
      'Po cyfrowych awariach państwo ćwiczy odporność usług i procedur. Źródło tematu: https://example.com',
      '## Alarm pod biurkiem',
      'Polska administracja znów odkrywa, że kabel bywa bardziej szczery niż konferencja prasowa. Gdy system pada, obietnice modernizacji zaczynają brzmieć jak instrukcja obsługi bez baterii.',
    ].join('\n\n'),
    ...overrides,
  };
}

test('detectLanguageIssues detects English title', () => {
  const issues = detectLanguageIssues(polishArticle({
    title: 'Spain starts evacuating virus-hit cruise ship in Tenerife',
  }));

  assert.deepEqual(issues.map(issue => issue.field), ['title']);
});

test('detectLanguageIssues detects English first paragraph', () => {
  const issues = detectLanguageIssues(polishArticle({
    markdown: [
      '# Polska flaga na kablu',
      'The government says the security market reveals systemic fragility after the state opened talks with the crisis team.',
      '## Alarm pod biurkiem',
      'Polska administracja znów odkrywa, że kabel bywa bardziej szczery niż konferencja prasowa.',
    ].join('\n\n'),
  }));

  assert(issues.some(issue => issue.field === 'firstParagraph'));
});

test('detectLanguageIssues leaves Polish article unchanged', () => {
  assert.deepEqual(detectLanguageIssues(polishArticle()), []);
});

test('ensurePolishArticleLanguage translates suspicious fields and verifies result', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: 'Teneryfa ewakuuje statek z wirusem',
              description: 'Po kryzysie sanitarnym procedury wracają na pokład.',
              firstParagraph: 'Po kryzysie sanitarnym procedury wracają na pokład. Źródło tematu: https://example.com',
            }),
          },
        },
      ],
    }),
    { status: 200 },
  ) as any;

  try {
    const result = await ensurePolishArticleLanguage({
      apiKey: 'k',
      edited: polishArticle({
        title: 'Spain starts evacuating virus-hit cruise ship in Tenerife',
        description: 'Cruise ship crisis reveals systemic fragility amid complacency',
        markdown: [
          '# Spain starts evacuating virus-hit cruise ship in Tenerife',
          'The government says the security market reveals systemic fragility after the state opened talks with the crisis team.',
          '## Procedury na pokładzie',
          'Polska administracja znów odkrywa, że procedura bywa bardziej szczera niż konferencja prasowa.',
        ].join('\n\n'),
      }),
    });

    assert.equal(result.repaired, true);
    assert.equal(result.edited.title, 'Teneryfa ewakuuje statek z wirusem');
    assert.match(result.edited.markdown, /Po kryzysie sanitarnym procedury wracają na pokład/);
    assert.deepEqual(detectLanguageIssues(result.edited), []);
  } finally {
    globalThis.fetch = original;
  }
});

test('ensurePolishArticleLanguage fails when repair remains English', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: 'Spain starts evacuating virus-hit cruise ship',
              description: 'Government security market reveals systemic fragility',
              firstParagraph: 'The government says the security market reveals systemic fragility after talks.',
            }),
          },
        },
      ],
    }),
    { status: 200 },
  ) as any;

  try {
    await assert.rejects(
      () => ensurePolishArticleLanguage({
        apiKey: 'k',
        edited: polishArticle({
          title: 'Spain starts evacuating virus-hit cruise ship',
          description: 'Government security market reveals systemic fragility',
          markdown: [
            '# Spain starts evacuating virus-hit cruise ship',
            'The government says the security market reveals systemic fragility after talks.',
            '## Procedury',
            'Polska administracja znów odkrywa, że procedura bywa bardziej szczera niż konferencja prasowa.',
          ].join('\n\n'),
        }),
        maxAttempts: 1,
      }),
      /Language validation failed/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
