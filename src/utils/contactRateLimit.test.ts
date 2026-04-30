import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTACT_LIMITS,
  checkContactRateLimit,
  getClientIp,
  shortHash,
} from './contactRateLimit.js';

class MemoryKv {
  values = new Map<string, string>();
  expirations = new Map<string, number>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void> {
    this.values.set(key, value);
    if (options?.expirationTtl) {
      this.expirations.set(key, options.expirationTtl);
    }
  }
}

function envFor(kv: MemoryKv) {
  return {
    pseudointelekt_contact_form: kv as unknown as KVNamespace,
  };
}

function request(ip = '203.0.113.10') {
  return new Request('https://pseudointelekt.pl/api/contact', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': ip },
  });
}

test('getClientIp prefers Cloudflare IP and falls back to first forwarded IP', () => {
  assert.equal(getClientIp(request('198.51.100.7')), '198.51.100.7');
  assert.equal(
    getClientIp(
      new Request('https://pseudointelekt.pl/api/contact', {
        headers: { 'X-Forwarded-For': '198.51.100.8, 198.51.100.9' },
      }),
    ),
    '198.51.100.8',
  );
});

test('checkContactRateLimit blocks the fourth request from one session', async () => {
  const kv = new MemoryKv();
  const env = envFor(kv);
  const sessionId = 'session-to-hash';

  for (let i = 0; i < CONTACT_LIMITS.sessionMax; i += 1) {
    assert.equal(await checkContactRateLimit(request(), env, sessionId), null);
  }

  const blocked = await checkContactRateLimit(request(), env, sessionId);
  assert.equal(blocked?.status, 429);
  assert.deepEqual(await blocked?.json(), {
    message: 'Too many messages. Try again later.',
  });

  const sessionHash = await shortHash(sessionId);
  const sessionKey = `rate:contact:session:${sessionHash}`;
  assert.equal(kv.values.get(sessionKey), String(CONTACT_LIMITS.sessionMax));
  assert.equal(kv.expirations.get(sessionKey), CONTACT_LIMITS.sessionWindowSeconds);
  assert(![...kv.values.keys()].some(key => key.includes(sessionId)));
});

test('checkContactRateLimit blocks the eleventh request from one IP', async () => {
  const kv = new MemoryKv();
  const env = envFor(kv);
  const ip = '203.0.113.44';

  for (let i = 0; i < CONTACT_LIMITS.ipMax; i += 1) {
    assert.equal(await checkContactRateLimit(request(ip), env, `session-${i}`), null);
  }

  const blocked = await checkContactRateLimit(request(ip), env, 'session-final');
  assert.equal(blocked?.status, 429);

  const ipHash = await shortHash(ip);
  const ipKey = `rate:contact:ip:${ipHash}`;
  assert.equal(kv.values.get(ipKey), String(CONTACT_LIMITS.ipMax));
  assert.equal(kv.expirations.get(ipKey), CONTACT_LIMITS.ipWindowSeconds);
  assert(![...kv.values.keys()].some(key => key.includes(ip)));
});
