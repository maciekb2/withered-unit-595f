import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoRound, MEMO_SYMBOLS, formatMemoTime } from './memo';

test('anchor lower arc joins the stem without clipping its stroke in the 24px viewBox', () => {
  const anchor = MEMO_SYMBOLS.find(symbol => symbol.name === 'Kotwica')!;
  // This half-ellipse starts at y=16; its lower bound is 16 + vertical radius.
  const arc = anchor.path.match(/M3 14v2a9 ([\d.]+) 0 0 0 18 0/);
  assert.ok(arc, 'Expected the anchor lower half-ellipse');
  const bottom = 16 + Number(arc[1]);
  assert.equal(bottom, 21, 'Lower arc should meet the stem at y=21');
  assert.ok(bottom + 1.6 / 2 < 24, 'Leave room for the full stroke');
});

test('memo deals two of every symbol and shuffles without changing the collection', () => {
  const a = new MemoRound(() => 0);
  const b = new MemoRound(() => 0.999);
  assert.equal(a.deck.length, 40);
  assert.equal(new Set(MEMO_SYMBOLS.map(symbol => symbol.name)).size, 20);
  assert.equal(new Set(MEMO_SYMBOLS.map(symbol => symbol.path)).size, 20);
  assert.notDeepEqual(a.deck, b.deck);
  for (let i = 0; i < MEMO_SYMBOLS.length; i++) assert.equal(a.deck.filter(n => n === i).length, 2);
});
test('memo ignores invalid/repeated picks and counts only completed attempts', () => {
  const round = new MemoRound(() => 0.999);
  for (const index of [-1, 40, NaN, 0.5]) assert.equal(round.select(index, 1), 'ignored');
  assert.equal(round.startedAt, null);
  assert.equal(round.select(0, 100), 'first');
  assert.equal(round.select(0, 200), 'ignored');
  assert.equal(round.moves, 0);
  assert.equal(round.select(2, 300), 'miss');
  assert.equal(round.select(4, 400), 'ignored');
  assert.equal(round.moves, 1);
  round.resolve();
  assert.equal(round.select(0, 500), 'first');
});
test('memo preserves matches, wins once and freezes the timer at the last pair', () => {
  const round = new MemoRound(() => 0.999);
  for (let i = 0; i < 40; i += 2) {
    assert.equal(round.select(i, 100 + i * 100), 'first');
    assert.equal(round.select(i + 1, 200 + i * 100), 'match');
    round.resolve();
    assert.equal(round.select(i, 300), 'ignored');
  }
  assert.equal(round.won, true);
  assert.equal(round.moves, 20);
  assert.equal(round.elapsed(90000), 3900);
});
test('a new memo round clears selection, score and timer independently', () => {
  const old = new MemoRound(() => 0.999);
  old.select(0, 0); old.select(2, 500);
  const fresh = new MemoRound();
  old.resolve();
  assert.equal(fresh.startedAt, null);
  assert.equal(fresh.elapsed(1000), 0);
  assert.equal(fresh.moves, 0);
  assert.equal(fresh.matched.size, 0);
  assert.deepEqual(fresh.selected, []);
});
test('the expanded round is not won at the former eight-pair boundary', () => {
  const round = new MemoRound(() => 0.999);
  for (let index = 0; index < 16; index += 2) {
    round.select(index, index * 100);
    round.select(index + 1, index * 100 + 50);
    round.resolve();
  }
  assert.equal(round.won, false);
  assert.equal(round.finishedAt, null);
  assert.equal(round.select(38, 2000), 'first');
  assert.equal(round.select(39, 2050), 'match');
  assert.equal(round.matched.size, 18);
  assert.equal(round.won, false);
});
test('memo clock handles zero, minutes and invalid values', () => {
  assert.equal(formatMemoTime(0), '00:00');
  assert.equal(formatMemoTime(61999), '01:01');
  assert.equal(formatMemoTime(NaN), '00:00');
  assert.equal(formatMemoTime(-1), '00:00');
});
