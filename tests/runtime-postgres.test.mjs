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
  await db.query(await fs.readFile(new URL('../deploy/selfhosted/migrations/005_generation_runs.sql', import.meta.url), 'utf8'));
  const protection = await fs.readFile(new URL('../deploy/selfhosted/migrations/006_contact_protection.sql', import.meta.url), 'utf8');
  await db.query(protection);
  await db.query(protection); // The migration runner is deliberately repeatable.
  await db.query('TRUNCATE contact_rate_limits');
});
after(async () => { await db.end(); });

function contactRequest(fields, headers = {}) {
  return new Request('http://localhost/api/contact', {
    method: 'POST', headers: { origin: 'http://localhost', ...headers },
    body: new URLSearchParams({ name: 'Integration', email: 'integration@example.invalid', message: 'Test wiadomości', submissionId: crypto.randomUUID(), ...fields }),
  });
}

test('missing contact schema returns a controlled no-store 503 without exposing SQL', async () => {
  await db.query('ALTER TABLE contact_messages RENAME TO contact_messages_test_outage');
  try {
    const response = await contact.POST({ request: contactRequest({}), clientAddress: '192.0.2.30' });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    assert.match(body.message, /chwilowo niedostępny/);
    assert.doesNotMatch(JSON.stringify(body), /SELECT|INSERT|contact_messages|postgres/i);
  } finally { await db.query('ALTER TABLE contact_messages_test_outage RENAME TO contact_messages'); }
});

test('contact rejects foreign origin, duplicate fields and file uploads before persistence; honeypot is inert', async () => {
  const before = (await db.query('SELECT count(*) FROM contact_messages')).rows[0].count;
  assert.equal((await contact.POST({ request: contactRequest({}, { origin: 'https://evil.invalid' }) })).status, 403);
  const duplicate = new FormData();
  duplicate.append('name', 'First'); duplicate.append('name', 'Second');
  assert.equal((await contact.POST({ request: new Request('http://localhost/api/contact', { method: 'POST', headers: { origin: 'http://localhost' }, body: duplicate }) })).status, 400);
  const file = new FormData(); file.append('message', new Blob(['not text']), 'file.txt');
  assert.equal((await contact.POST({ request: new Request('http://localhost/api/contact', { method: 'POST', headers: { origin: 'http://localhost' }, body: file }) })).status, 400);
  assert.equal((await contact.POST({ request: contactRequest({ website: 'https://spam.invalid' }) })).status, 202);
  assert.equal((await db.query('SELECT count(*) FROM contact_messages')).rows[0].count, before);
});

test('parallel retries store one contact and consume one quota; changed payload cannot reuse the identifier', async () => {
  const fields = { submissionId: crypto.randomUUID(), email: `retry-${crypto.randomUUID()}@example.invalid` };
  const ip = '192.0.2.31';
  try {
    const results = await Promise.all(Array.from({ length: 12 }, () => contact.POST({ request: contactRequest(fields), clientAddress: ip })));
    assert.equal(results.filter(response => response.status === 201).length, 1);
    assert.equal(results.filter(response => response.status === 200).length, 11);
    assert.equal((await db.query('SELECT id FROM contact_messages WHERE submission_id=$1', [fields.submissionId])).rowCount, 1);
    assert.equal((await contact.POST({ request: contactRequest({ ...fields, message: 'Different message' }), clientAddress: ip })).status, 409);
    const { hashContactKey } = await import('../src/server/contactProtection.ts');
    assert.equal((await db.query('SELECT hits FROM contact_rate_limits WHERE bucket=$1', [`ip:${hashContactKey(ip)}`])).rows[0].hits, 1);
  } finally { await db.query('DELETE FROM contact_messages WHERE email=$1', [fields.email]); }
});

test('email quota is atomic under parallel submissions and expired quota is reusable', async () => {
  const email = `limit-${crypto.randomUUID()}@example.invalid`;
  try {
    const results = await Promise.all(Array.from({ length: 8 }, () => contact.POST({ request: contactRequest({ email }), clientAddress: '192.0.2.32' })));
    assert.equal(results.filter(response => response.status === 201).length, 3);
    assert.equal(results.filter(response => response.status === 429).length, 5);
    for (const response of results.filter(response => response.status === 429)) assert.equal(response.headers.get('retry-after'), '600');
    assert.equal((await db.query('SELECT id FROM contact_messages WHERE email=$1', [email])).rowCount, 3);
    const { hashContactKey } = await import('../src/server/contactProtection.ts');
    await db.query("UPDATE contact_rate_limits SET expires_at=now()-interval '1 second' WHERE bucket=$1", [`email:${hashContactKey(email)}`]);
    assert.equal((await contact.POST({ request: contactRequest({ email }), clientAddress: '192.0.2.32' })).status, 201);
  } finally { await db.query('DELETE FROM contact_messages WHERE email=$1', [email]); }
});

test('IP and global quotas reject new identities without saving messages', async () => {
  const { hashContactKey } = await import('../src/server/contactProtection.ts');
  const ipKey = `ip:${hashContactKey('192.0.2.33')}`;
  const email = `blocked-${crypto.randomUUID()}@example.invalid`;
  await db.query("INSERT INTO contact_rate_limits VALUES ($1, 10, now()+interval '1 hour')", [ipKey]);
  const ipResult = await contact.POST({ request: contactRequest({ email }), clientAddress: '192.0.2.33' });
  assert.equal(ipResult.status, 429);
  assert.equal(ipResult.headers.get('retry-after'), '3600');
  const original = (await db.query("SELECT hits FROM contact_rate_limits WHERE bucket='global'")).rows[0].hits;
  try {
    await db.query("UPDATE contact_rate_limits SET hits=30, expires_at=now()+interval '1 minute' WHERE bucket='global'");
    const globalResult = await contact.POST({ request: contactRequest({ email }), clientAddress: '192.0.2.34' });
    assert.equal(globalResult.status, 429);
    assert.equal(globalResult.headers.get('retry-after'), '60');
    assert.equal((await db.query('SELECT id FROM contact_messages WHERE email=$1', [email])).rowCount, 0);
  } finally { await db.query("UPDATE contact_rate_limits SET hits=$1 WHERE bucket='global'", [original]); }
});

test('monitoring connection is read-only and aggregates are available without leaking content', async () => {
  const { collectBusiness, createMetricsPool } = await import('../src/server/businessMetrics.ts');
  const metricsDb = createMetricsPool(connection);
  try {
    assert.equal((await metricsDb.query('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only, 'on');
    assert.equal((await metricsDb.query('SHOW statement_timeout')).rows[0].statement_timeout, '2s');
    assert.equal(metricsDb.options.query_timeout, 2500);
    await assert.rejects(metricsDb.query('SELECT pg_sleep(5)'), /statement timeout|Query read timeout/);
    await assert.rejects(metricsDb.query("INSERT INTO contact_messages(name,email,message) VALUES('monitor','never@example.invalid','do not write')"), /read-only/);
    const text = await collectBusiness(metricsDb);
    assert.match(text, /pseudointelekt_database_up 1/);
    assert.match(text, /pseudointelekt_collector_up{collector="generation"} 1/);
    assert.doesNotMatch(text, /never@example|do not write|DATABASE_URL/);
  } finally { await metricsDb.end(); }
});

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

test('contact notifications keep untrusted mentions in plain text and retries do not notify twice', async () => {
  const email = `notification-${crypto.randomUUID()}@example.invalid`;
  const submissionId = crypto.randomUUID();
  const originalFetch = globalThis.fetch;
  const originalWebhook = process.env.SLACK_WEBHOOK_URL;
  const payloads = [];
  process.env.SLACK_WEBHOOK_URL = 'https://notification.example.invalid';
  globalThis.fetch = async (_url, options) => { payloads.push(JSON.parse(options.body)); return new Response('ok'); };
  try {
    const fields = { email, submissionId, name: '<!channel>', message: '<@U123> <https://evil.invalid|click> ' + 'x'.repeat(3900) };
    assert.equal((await contact.POST({ request: contactRequest(fields), clientAddress: '192.0.2.35' })).status, 201);
    assert.equal((await contact.POST({ request: contactRequest(fields), clientAddress: '192.0.2.35' })).status, 200);
    assert.equal(payloads.length, 1);
    assert.equal(payloads[0].text, 'Nowa wiadomość z formularza Pseudointelektu');
    assert.ok(payloads[0].blocks.every(block => block.text.type === 'plain_text' && block.text.text.length <= 3000));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWebhook === undefined) delete process.env.SLACK_WEBHOOK_URL; else process.env.SLACK_WEBHOOK_URL = originalWebhook;
    await db.query('DELETE FROM contact_messages WHERE email=$1', [email]);
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
  const request = fields => new Request('http://localhost/api/contact', { method: 'POST', headers: { origin: 'http://localhost' }, body: new URLSearchParams({ submissionId: crypto.randomUUID(), ...fields }) });
  try {
    const malformed = await contact.POST({ request: new Request('http://localhost/api/contact', { method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'multipart/form-data' }, body: '{broken' }) });
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
