#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const input = process.argv[2] || 'migration/cloudflare-state.json';
const state = JSON.parse(await readFile(input, 'utf8'));
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  for (const row of state.counters || []) {
    await client.query(`INSERT INTO engagement_counters (kind, slug, value, created_at, updated_at)
      VALUES ($1, $2, $3, COALESCE($4, now()), COALESCE($5, now()))
      ON CONFLICT (kind, slug) DO UPDATE SET value = GREATEST(engagement_counters.value, EXCLUDED.value), updated_at = now()`,
      [row.kind, row.slug, Number(row.value) || 0, row.created_at, row.updated_at]);
  }
  for (const [kind, values] of [['view', state.kv?.views || {}], ['like', state.kv?.likes || {}]]) {
    const prefix = `${kind}-`;
    for (const [key, rawValue] of Object.entries(values)) {
      if (!key.startsWith(prefix)) continue;
      await client.query(`INSERT INTO engagement_counters (kind, slug, value)
        VALUES ($1, $2, $3)
        ON CONFLICT (kind, slug) DO UPDATE SET value = GREATEST(engagement_counters.value, EXCLUDED.value), updated_at = now()`,
        [kind, key.slice(prefix.length), Number.parseInt(String(rawValue), 10) || 0]);
    }
  }
  for (const row of state.likeSessions || []) {
    await client.query('INSERT INTO engagement_like_sessions (slug, session_id, created_at) VALUES ($1, $2, COALESCE($3, now())) ON CONFLICT DO NOTHING', [row.slug, row.session_id, row.created_at]);
  }
  for (const row of state.logs || []) {
    await client.query('INSERT INTO logs (time, worker_id, data) VALUES (COALESCE($1, now()), $2, $3::jsonb)', [row.time, row.worker_id || 'pseudointelekt-worker', typeof row.data === 'string' ? row.data : JSON.stringify(row.data)]);
  }
  await client.query('COMMIT');
  console.log(`Imported ${state.logs?.length || 0} logs, ${state.counters?.length || 0} counters and ${state.likeSessions?.length || 0} like sessions`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
