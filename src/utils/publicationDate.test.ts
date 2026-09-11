import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationDate } from './publicationDate';

test('publication dates retain explicit backfill dates and valid leap days', () => {
  assert.equal(publicationDate('2026-09-01'), '2026-09-01');
  assert.equal(publicationDate('2024-02-29'), '2024-02-29');
});

for (const value of ['2026-02-29', '2026-09-31', '2026-13-01', '2026-9-1', '../2026-09-01', '', '2026-09-01T12:00:00Z']) {
  test(`reject invalid publication date ${JSON.stringify(value)}`, () => {
    assert.throws(() => publicationDate(value), /date/i);
  });
}
