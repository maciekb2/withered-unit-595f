#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const [command, ...args] = process.argv.slice(2);
const base = (process.env.SOCIAL_ADMIN_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const origin = new URL(base).origin;
const token = process.env.GENERATOR_PRIVATE_TOKEN;
if (!token) throw new Error('GENERATOR_PRIVATE_TOKEN is required');

async function stdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function request(path, init = {}) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { origin, 'x-generator-private-token': token, ...(init.headers || {}) },
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 1000)}`);
  process.stdout.write(`${text}\n`);
}

switch (command) {
  case 'context':
    await request('/api/social/context');
    break;
  case 'backfill':
    await request('/api/social/backfill', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    break;
  case 'create': {
    const body = await stdin();
    JSON.parse(body.toString('utf8'));
    await request('/api/social/runs', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    break;
  }
  case 'upload': {
    const [runId, jobId, mime = 'image/png'] = args;
    if (!runId || !jobId) throw new Error('upload requires runId and jobId');
    const bytes = await stdin();
    await request('/api/social/upload', {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        'x-social-run-id': runId,
        'x-social-job-id': jobId,
        'x-social-image-type': mime,
      },
      body: bytes,
    });
    break;
  }
  case 'finalize':
    if (!args[0]) throw new Error('finalize requires runId');
    await request('/api/social/finalize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ runId: args[0] }) });
    break;
  case 'status':
    await request(`/api/social/runs?id=${encodeURIComponent(args[0] || '')}`);
    break;
  case 'validate-file':
    process.stdout.write(`${(await readFile(args[0])).byteLength}\n`);
    break;
  default:
    throw new Error('Usage: social-weekly-client.mjs context|backfill|create|upload|finalize|status');
}
