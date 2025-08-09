import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestArticleTopic } from './topicSuggester.js';
import type { HotTopic } from '../utils/hotTopics.js';

const mockHotTopics: HotTopic[] = [
  { title: 'Temat A', url: 'https://a.example', published: '', source: 'x' },
  { title: 'Temat B', url: 'https://b.example', published: '', source: 'y' },
];

const recent = ['Stary tytuł 1', 'Stary tytuł 2'];

test('suggestArticleTopic avoids recent titles and covers multiple themes', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify([
                { title: 'Nowy tytuł 1', rationale: 'Polityka: satyryczny komentarz' },
                { title: 'Nowy tytuł 2', rationale: 'Ekologia: ironiczny ton' },
                { title: 'Nowy tytuł 3', rationale: 'Historia: patriotyczna nuta' },
              ]),
            },
          },
        ],
      }),
      { status: 200 },
    ) as any;

  const suggestions = await suggestArticleTopic(
    mockHotTopics,
    recent,
    'test-key',
  );

  assert.equal(suggestions.length, 3);
  for (const s of suggestions) {
    assert.ok(!recent.includes(s.title));
  }
  const themes = new Set(suggestions.map(s => s.rationale.split(':')[0]));
  assert.ok(themes.size >= 2);

  globalThis.fetch = originalFetch;
});
