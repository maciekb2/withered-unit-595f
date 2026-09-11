import test from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import { collectBusiness, BUSINESS_QUERIES } from './businessMetrics';
const pool = (query: (text: string) => Promise<unknown>) => ({ query }) as Pick<pg.Pool, 'query'>;
test('database failure is explicit and never emitted as healthy zero business data', async () => {
  assert.equal(await collectBusiness(pool(async () => { throw new Error('secret connection string'); })), 'pseudointelekt_database_up 0\n');
});
test('missing optional generation table is isolated; output contains aggregates only', async () => {
  const text = await collectBusiness(pool(async sql => {
    if (sql === BUSINESS_QUERIES.generation) throw new Error('relation missing');
    if (sql === BUSINESS_QUERIES.contact) return { rows: [{ day:2,week:4,expired:1,email:'not-exported@example.invalid' }] };
    if (sql === BUSINESS_QUERIES.engagement) return { rows: [{kind:'view',value:25},{kind:'like',value:3}] };
    if (sql === BUSINESS_QUERIES.social) return { rows: [{status:'queued',value:2,oldest:1700000000},{status:'private-label',value:1}] };
    return { rows: [] };
  }));
  assert.match(text, /database_up 1/);
  assert.match(text, /collector_up{collector="generation"} 0/);
  assert.match(text, /contact_messages_window{window="24h"} 2/);
  assert.match(text, /social_jobs{status="queued"} 2/);
  assert.doesNotMatch(text, /not-exported|private-label|relation missing/);
});
