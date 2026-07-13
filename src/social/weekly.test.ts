import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWeeklyRun } from './weekly.js';

const pkg = (contentKind: 'current' | 'evergreen', staticPost = false, carousel = false) => ({
  score: { topicality: 2, recognizability: 2, ironyPotential: 2, clarity: 2, hookStrength: 2, total: 10 },
  hook: 'Komunikat jest wspólny, ale rachunek nadal ma narodowy adres.',
  instagramCaption: 'Deklaracja połączyła stanowiska. Koszt wykonania nadal rozdziela państwa.',
  youtubeTitle: 'Wspólny komunikat, osobny rachunek',
  youtubeDescription: 'Co zostaje po wspólnej deklaracji i kto płaci za jej wykonanie.',
  scenes: ['Najpierw pojawiła się wspólna deklaracja.','Cel zapisano bez większych sporów.','Harmonogram pozostał sprawą krajową.','Tak samo rozdzielono koszty wykonania.','Jedność najlepiej wyglądała w komunikacie.','Cała analiza na pseudointelekt.pl.'],
  hashtags: ['#geopolityka'], staticPost, carousel,
  imagePrompt: 'Editorial illustration with a brass compass beside a folded trade map and a sealed cable spool, restrained magazine collage, no text, no logos.',
  contentKind, experiment: 'konkretny koszt w hooku', template: 'situation-room-v2' as const,
});

test('weekly run requires exactly two current items and one evergreen', () => {
  const input = {
    weekKey: '2026-W29', promptVersion: 'social-v2',
    items: [
      { jobId: '11111111-1111-4111-8111-111111111111', variantKey: 'a', package: pkg('current') },
      { jobId: '22222222-2222-4222-8222-222222222222', variantKey: 'b', package: pkg('current') },
      { jobId: '33333333-3333-4333-8333-333333333333', variantKey: 'c', package: pkg('evergreen', true) },
    ],
  };
  assert.deepEqual(validateWeeklyRun(input), []);
  assert.ok(validateWeeklyRun({ ...input, items: input.items.slice(0, 2) }).length > 0);
});

test('weekly run allows one carousel on a different item than the static post', () => {
  const input = {
    weekKey: '2026-W30', promptVersion: 'social-v3',
    items: [
      { jobId: '11111111-1111-4111-8111-111111111111', variantKey: 'a', package: pkg('current', false, true) },
      { jobId: '22222222-2222-4222-8222-222222222222', variantKey: 'b', package: pkg('current', true, false) },
      { jobId: '33333333-3333-4333-8333-333333333333', variantKey: 'c', package: pkg('evergreen') },
    ],
  };
  assert.deepEqual(validateWeeklyRun(input), []);
  input.items[0].package.staticPost = true;
  assert.ok(validateWeeklyRun(input).includes('one item cannot request both static post and carousel'));
});
