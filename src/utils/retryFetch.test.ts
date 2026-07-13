import test from 'node:test';
import assert from 'node:assert/strict';
import { retryFetch } from './retryFetch.js';

test('retryFetch retries transient HTTP failures and returns the recovery response', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls < 3 ? new Response('temporary', { status: 503 }) : new Response('ok');
  };

  try {
    const response = await retryFetch('https://example.test', { retries: 2, retryDelayMs: 0 });
    assert.equal(response.status, 200);
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('retryFetch retries network errors but does not retry client errors', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) throw new TypeError('connection reset');
    return new Response('unauthorized', { status: 401 });
  };

  try {
    const response = await retryFetch('https://example.test', { retries: 3, retryDelayMs: 0 });
    assert.equal(response.status, 401);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('retryFetch returns the final transient response after exhausting retries', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response('still down', { status: 502 });
  };

  try {
    const response = await retryFetch('https://example.test', { retries: 1, retryDelayMs: 0 });
    assert.equal(response.status, 502);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
