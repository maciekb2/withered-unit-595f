#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url).pathname;
const out = process.argv[2] || `${root}/migration/cloudflare-state.json`;
const db = 'pseudointelekt_logs';

function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
}

function d1(sql) {
  const raw = wrangler(['d1', 'execute', db, '--remote', '--command', sql, '--json']);
  const parsed = JSON.parse(raw);
  return parsed.flatMap(item => item.results || []);
}

function kvList(namespaceId) {
  return JSON.parse(wrangler(['kv', 'key', 'list', '--namespace-id', namespaceId, '--remote']));
}

function kvGet(namespaceId, key) {
  return wrangler(['kv', 'key', 'get', key, '--namespace-id', namespaceId, '--remote']).trim();
}

const counters = d1('SELECT kind, slug, value, created_at, updated_at FROM engagement_counters');
const likeSessions = d1('SELECT slug, session_id, created_at FROM engagement_like_sessions');
const logs = d1('SELECT id, time, worker_id, data FROM logs ORDER BY id');
const namespaces = {
  views: '0bdd1f5ed5e64d38877fa2dfc796b4ed',
  likes: 'e22b4da9fe0e45d8ae2515792d5929df',
};
const kv = {};
for (const [name, namespaceId] of Object.entries(namespaces)) {
  kv[name] = {};
  for (const { name: key } of kvList(namespaceId)) kv[name][key] = kvGet(namespaceId, key);
}

await mkdir(new URL('.', `file://${out}`).pathname, { recursive: true });
await writeFile(out, JSON.stringify({ exportedAt: new Date().toISOString(), counters, likeSessions, logs, kv }, null, 2));
console.log(`Exported ${logs.length} logs, ${counters.length} counters and ${Object.values(kv).reduce((n, values) => n + Object.keys(values).length, 0)} KV keys to ${out}`);
