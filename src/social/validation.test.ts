import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSocialPackage } from './validation.js';

const source = {
  slug: 'testowy-material', title: 'Komunikat obiecał wspólną drogę, rachunek został osobno',
  lead: 'Państwa podpisały deklarację, lecz terminy i koszty nadal rozliczają oddzielnie.',
  summaryPoints: ['Deklaracja opisuje wspólny cel.', 'Każde państwo zachowało własny harmonogram.', 'Koszt wykonania pozostał po stronie rządów.'],
  punchline: 'Jedność zmieściła się w komunikacie.', tags: ['europa'], heroUrl: 'https://pseudointelekt.pl/a.png',
  articleUrl: 'https://pseudointelekt.pl/blog/test/', publishedAt: '2026-07-12T10:00:00Z',
};

test('social validation accepts concise sourced copy', () => {
  const errors = validateSocialPackage({
    score: { topicality: 2, recognizability: 1, ironyPotential: 2, clarity: 2, hookStrength: 2, total: 9 },
    hook: 'Wspólny komunikat, osobne harmonogramy i bardzo narodowe rachunki.',
    instagramCaption: 'Deklaracja jest wspólna. Wykonanie nadal podróżuje osobno.',
    youtubeTitle: 'Jedność kończy się przy harmonogramie', youtubeDescription: 'Krótko o cenie wspólnej deklaracji.',
    scenes: ['Najpierw pojawiła się wspólna deklaracja.','Cel zapisano bez większych sporów.','Harmonogram pozostał już sprawą krajową.','Tak samo rozdzielono koszty wykonania.','Jedność najlepiej wyglądała w komunikacie.','Cała analiza na pseudointelekt.pl.'],
    hashtags: ['#geopolityka','#europa'],
    staticPost: true,
    imagePrompt: 'Editorial illustration with a brass compass beside a folded trade map and a sealed cable spool, restrained magazine collage, no text, no logos.',
    contentKind: 'current',
    experiment: 'konkretny koszt w pierwszym zdaniu',
    template: 'situation-room-v2',
  }, source);
  assert.deepEqual(errors, []);
});

test('social validation rejects generic filler and invented numbers', () => {
  const pkg: any = { hook: 'W dzisiejszym świecie wszystko zmienia się bardzo szybko.', instagramCaption: 'Warto zauważyć 99 procent.', youtubeTitle: 'Test', youtubeDescription: '', scenes: ['x'], hashtags: [], score: {}, template: 'situation-room-v2' };
  const errors = validateSocialPackage(pkg, source);
  assert.ok(errors.includes('contains banned generic phrasing'));
  assert.ok(errors.includes('contains a number absent from source'));
});
