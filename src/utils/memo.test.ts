import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoRound, MEMO_SYMBOLS, formatMemoTime } from './memo';

test('memo deals two of every symbol and shuffles without changing the collection', () => {
  const a = new MemoRound(() => 0);
  const b = new MemoRound(() => 0.999);
  assert.equal(a.deck.length, 16);
  assert.notDeepEqual(a.deck, b.deck);
  for (let i = 0; i < MEMO_SYMBOLS.length; i++) assert.equal(a.deck.filter(n => n === i).length, 2);
});
test('memo ignores invalid/repeated picks and counts only completed attempts', () => {
  const round = new MemoRound(() => 0.999);
  for (const index of [-1, 16, NaN, 0.5]) assert.equal(round.select(index, 1), 'ignored');
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
  for (let i = 0; i < 16; i += 2) {
    assert.equal(round.select(i, 100 + i * 100), 'first');
    assert.equal(round.select(i + 1, 200 + i * 100), 'match');
    round.resolve();
    assert.equal(round.select(i, 300), 'ignored');
  }
  assert.equal(round.won, true);
  assert.equal(round.moves, 8);
  assert.equal(round.elapsed(90000), 1500);
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
test('memo clock handles zero, minutes and invalid values', () => {
  assert.equal(formatMemoTime(0), '00:00');
  assert.equal(formatMemoTime(61999), '01:01');
  assert.equal(formatMemoTime(NaN), '00:00');
  assert.equal(formatMemoTime(-1), '00:00');
});
