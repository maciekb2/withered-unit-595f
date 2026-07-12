#!/usr/bin/env node
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const intervalMs = Number(process.env.SOCIAL_METRICS_INTERVAL_MS || 21_600_000);
const enabled = process.env.SOCIAL_METRICS_ENABLED !== 'false';
const windows = [24, 72, 168, 672];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function bufferPost(id) {
  const query = `query SocialPostMetrics { post(input:{id:${JSON.stringify(id)}}) {
    id dueAt metrics { type name value unit } metricsUpdatedAt
  } }`;
  const response = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.BUFFER_API_KEY}` },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json();
  if (!response.ok || data.errors?.length) throw new Error(data.errors?.[0]?.message || `Buffer HTTP ${response.status}`);
  return data.data?.post;
}

async function sync() {
  if (!process.env.BUFFER_API_KEY) throw new Error('BUFFER_API_KEY is required');
  const publications = await pool.query(`SELECT id,buffer_draft_id,published_at,created_at
    FROM social_publications WHERE buffer_draft_id IS NOT NULL AND status IN ('draft','queued','published')
      AND created_at >= now()-interval '40 days' ORDER BY created_at`);
  for (const publication of publications.rows) {
    try {
      const post = await bufferPost(publication.buffer_draft_id);
      if (!post?.metrics?.length) continue;
      const publishedAt = publication.published_at || post.dueAt || publication.created_at;
      const ageHours = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / 3_600_000);
      const dueWindows = windows.filter(window => ageHours >= window);
      for (const window of dueWindows) {
        await pool.query(`INSERT INTO social_metric_snapshots(publication_id,window_hours,provider,metrics)
          VALUES($1,$2,'buffer',$3::jsonb) ON CONFLICT(publication_id,window_hours,provider)
          DO UPDATE SET metrics=EXCLUDED.metrics,measured_at=now()`, [publication.id, window, JSON.stringify(post.metrics)]);
      }
      await pool.query(`UPDATE social_publications SET status='published',published_at=COALESCE(published_at,$2),
        metrics_updated_at=$3,updated_at=now() WHERE id=$1`, [publication.id, publishedAt, post.metricsUpdatedAt || new Date()]);
    } catch (error) {
      console.error(JSON.stringify({ type: 'social-metrics-error', publicationId: publication.id, error: error instanceof Error ? error.message : String(error) }));
    }
  }
  console.log(JSON.stringify({ type: 'social-metrics-sync', publications: publications.rowCount }));
}

async function main() {
  console.log(JSON.stringify({ type: 'social-metrics-start', enabled, intervalMs }));
  if (!enabled) return new Promise(() => undefined);
  do {
    await sync();
    if (process.env.SOCIAL_METRICS_RUN_ONCE === 'true') break;
    await sleep(intervalMs);
  } while (true);
  await pool.end();
}

main().catch(error => { console.error(error); process.exitCode = 1; });
