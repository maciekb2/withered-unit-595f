#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url).pathname;
const out = process.argv[2] || `${root}/migration/cloudflare-state.json`;
const account = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
const database = 'c290edf1-394f-4c8b-940c-da62db2774b1';
if (!account || !token) throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required');

async function api(path, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const body = await response.json();
  if (!response.ok || body.success === false) throw new Error(`${response.status}: ${JSON.stringify(body.errors || body)}`);
  return body.result;
}

async function d1(sql) {
  const result = await api(`/accounts/${account}/d1/database/${database}/query`, { method: 'POST', body: JSON.stringify({ sql }) });
  return result.flatMap(item => item.results || []);
}

async function kvKeys(namespaceId) {
  const keys = [];
  let cursor = '';
  do {
    const query = cursor ? `?limit=1000&cursor=${encodeURIComponent(cursor)}` : '?limit=1000';
    const result = await api(`/accounts/${account}/storage/kv/namespaces/${namespaceId}/keys${query}`);
    keys.push(...result);
    cursor = result.length === 1000 ? result.at(-1)?.name : '';
  } while (cursor);
  return keys.map(item => item.name);
}

async function kvValues(namespaceId, keys) {
  const entries = {};
  for (let offset = 0; offset < keys.length; offset += 100) {
    const batch = keys.slice(offset, offset + 100);
    const result = await api(`/accounts/${account}/storage/kv/namespaces/${namespaceId}/bulk/get`, {
      method: 'POST', body: JSON.stringify({ keys: batch }),
    });
    for (const key of batch) entries[key] = result?.[key] ?? null;
  }
  return entries;
}

const counters = await d1('SELECT kind, slug, value, created_at, updated_at FROM engagement_counters');
const likeSessions = await d1('SELECT slug, session_id, created_at FROM engagement_like_sessions');
const logs = await d1('SELECT id, time, worker_id, data FROM logs ORDER BY id');
const namespaceIds = {
  views: '0bdd1f5ed5e64d38877fa2dfc796b4ed',
  likes: 'e22b4da9fe0e45d8ae2515792d5929df',
};
const kv = {};
for (const [name, namespaceId] of Object.entries(namespaceIds)) {
  const keys = await kvKeys(namespaceId);
  kv[name] = await kvValues(namespaceId, keys);
}

await mkdir(new URL('.', `file://${out}`).pathname, { recursive: true });
await writeFile(out, JSON.stringify({ exportedAt: new Date().toISOString(), counters, likeSessions, logs, kv }, null, 2));
console.log(`Exported ${logs.length} logs, ${counters.length} counters and ${Object.values(kv).reduce((n, values) => n + Object.keys(values).length, 0)} KV keys to ${out}`);
