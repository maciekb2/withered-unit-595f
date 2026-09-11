import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const connection = process.env.TEST_DATABASE_URL;
if (!connection) throw new Error('TEST_DATABASE_URL is required (disposable local database only)');
const target = new URL(connection);
if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.pathname !== '/pseudointelekt_test') {
  throw new Error('Integration tests require a disposable localhost/pseudointelekt_test database');
}
process.env.DATABASE_URL = connection;
delete process.env.SLACK_WEBHOOK_URL;
const { getPool } = await import('../src/server/postgres.ts');
const likes = await import('../src/pages/api/likes/[slug].ts');
const views = await import('../src/pages/api/views/[slug].ts');
const contact = await import('../src/pages/api/contact.ts');
const db = getPool();
before(async () => {
  await db.query(await fs.readFile(new URL('../deploy/selfhosted/migrations/001_initial.sql', import.meta.url), 'utf8'));
});
after(async () => { await db.end(); });

test('parallel likes from one session increment exactly once, another session increments again', async () => {
  const slug = `test-${crypto.randomUUID()}`;
  const request = new Request('http://localhost/api/likes/test', { method: 'POST', headers: { cookie: 'pi_session=integration-session' } });
  try {
    const responses = await Promise.all(Array.from({ length: 30 }, () => likes.POST({ params: { slug }, request })));
    for (const response of responses) assert.equal(response.status, 200);
    assert.equal((await db.query("SELECT value FROM engagement_counters WHERE kind='like' AND slug=$1", [slug])).rows[0].value, '1');
    const next = await likes.POST({ params: { slug }, request: new Request(request, { headers: { cookie: 'pi_session=another-session' } }) });
    assert.equal((await next.json()).likes, 2);
  } finally {
    await db.query('DELETE FROM engagement_like_sessions WHERE slug=$1', [slug]);
    await db.query('DELETE FROM engagement_counters WHERE slug=$1', [slug]);
  }
});

test('views survive parallel writes and are read from PostgreSQL', async () => {
  const slug = `test-${crypto.randomUUID()}`;
  try {
    await Promise.all(Array.from({ length: 20 }, () => views.POST({ params: { slug } })));
    assert.equal((await (await views.GET({ params: { slug } })).json()).views, 20);
  } finally { await db.query('DELETE FROM engagement_counters WHERE slug=$1', [slug]); }
});

test('contact rejects invalid input without writing, valid input is persisted without external notifications', async () => {
  const email = `test-${crypto.randomUUID()}@example.invalid`;
  const request = fields => new Request('http://localhost/api/contact', { method: 'POST', body: new URLSearchParams(fields) });
  try {
    const malformed = await contact.POST({ request: new Request('http://localhost/api/contact', { method: 'POST', body: '{broken' }) });
    assert.equal(malformed.status, 400);
    const invalid = await contact.POST({ request: request({ name: 'Test', email, message: '' }) });
    assert.equal(invalid.status, 400);
    assert.equal((await db.query('SELECT id FROM contact_messages WHERE email=$1', [email])).rowCount, 0);
    const valid = await contact.POST({ request: request({ name: 'Test', email, message: 'Disposable integration test' }) });
    assert.equal(valid.status, 201);
    assert.equal(valid.headers.get('cache-control'), 'no-store');
    const persisted = await db.query('SELECT message, expires_at > now() AS retained FROM contact_messages WHERE email=$1', [email]);
    assert.equal(persisted.rowCount, 1);
    assert.equal(persisted.rows[0].message, 'Disposable integration test');
    assert.equal(persisted.rows[0].retained, true);
  } finally { await db.query('DELETE FROM contact_messages WHERE email=$1', [email]); }
});
