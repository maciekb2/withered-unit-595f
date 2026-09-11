import test from 'node:test';
import assert from 'node:assert/strict';
import { readContactForm, sameOrigin, contactClientKey, hashContactKey, MAX_CONTACT_BYTES } from './contactProtection';
import { validateContact } from '../utils/contactValidation';

test('contact accepts Unicode and newlines but rejects controls, empty fields and oversized messages', () => {
  const valid = { name: 'Łucja', email: 'lucja@example.com', message: 'Uwaga do tekstu.\nŹródło: https://example.com' };
  assert.deepEqual(validateContact(valid), {});
  for (const field of ['name', 'email', 'message'] as const) {
    assert.ok(validateContact({ ...valid, [field]: '' })[field]);
    assert.ok(validateContact({ ...valid, [field]: '\u0000' })[field]);
  }
  assert.ok(validateContact({ ...valid, message: 'x'.repeat(4001) }).message);
  assert.ok(validateContact({ ...valid, email: 'bad@<example.com>' }).email);
});
test('contact requires exact origin and rejects cross-site fetch metadata', () => {
  const request = (headers: Record<string, string>) => new Request('https://pseudointelekt.pl/api/contact', { headers });
  assert.equal(sameOrigin(request({ origin: 'https://pseudointelekt.pl' })), true);
  for (const origin of ['null', 'http://pseudointelekt.pl', 'https://pseudointelekt.pl.evil.test']) assert.equal(sameOrigin(request({ origin })), false);
  assert.equal(sameOrigin(request({})), false);
  assert.equal(sameOrigin(request({ origin: 'https://pseudointelekt.pl', 'sec-fetch-site': 'cross-site' })), false);
});
test('contact body limit applies to actual bytes, not just content-length', async () => {
  const request = (body: string, extra = {}) => new Request('http://localhost/api/contact', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', ...extra }, body });
  assert.equal((await readContactForm(request('name=Test'))).get('name'), 'Test');
  await assert.rejects(readContactForm(request('x'.repeat(MAX_CONTACT_BYTES + 1))), { status: 413 });
  await assert.rejects(readContactForm(request('name=Test', { 'content-length': '70000' })), { status: 413 });
  await assert.rejects(readContactForm(request('{}', { 'content-type': 'application/json' })), { status: 415 });
  await assert.rejects(readContactForm(request('broken', { 'content-type': 'multipart/form-data' })));
});
test('untrusted forwarding headers cannot rotate the contact IP bucket', () => {
  const previous = process.env.CONTACT_TRUST_CF_IP;
  delete process.env.CONTACT_TRUST_CF_IP;
  try {
    const req = new Request('http://localhost', { headers: { 'cf-connecting-ip': '203.0.113.2', 'x-forwarded-for': '203.0.113.3' } });
    assert.equal(contactClientKey(req, '127.0.0.1'), hashContactKey('127.0.0.1'));
    process.env.CONTACT_TRUST_CF_IP = 'true';
    assert.equal(contactClientKey(req, '127.0.0.1'), hashContactKey('203.0.113.2'));
  } finally { if (previous === undefined) delete process.env.CONTACT_TRUST_CF_IP; else process.env.CONTACT_TRUST_CF_IP = previous; }
});

test('a stalled contact body is rejected on a bounded deadline', async () => {
  const body = new ReadableStream({ pull() { return new Promise(() => {}); } });
  const request = new Request('http://localhost/api/contact', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, duplex: 'half',
  } as RequestInit);
  await assert.rejects(readContactForm(request), { status: 408 });
});
