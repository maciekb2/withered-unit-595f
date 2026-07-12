import type { APIRoute } from 'astro';
import { stat } from 'node:fs/promises';
import { getPool, json } from '../../../server/postgres';
import { isPrivateGeneratorRequest } from '../../../server/generatorAuth';
import { isFinalizedSocialJobStatus } from '../../../social/runState';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!await isPrivateGeneratorRequest(request)) return json({ error: 'Forbidden' }, 403);
  const body = await request.json().catch(() => ({})) as { runId?: string };
  if (!body.runId || !/^[0-9a-f-]{36}$/i.test(body.runId)) return json({ error: 'Invalid runId' }, 400);
  const jobs = await getPool().query<{ id: string; status: string; master_image_path: string | null }>(
    'SELECT id,status,master_image_path FROM social_jobs WHERE run_id=$1 ORDER BY created_at', [body.runId],
  );
  if (jobs.rows.length !== 3) return json({ error: 'Run must contain exactly 3 items' }, 409);
  if (jobs.rows.every(job => isFinalizedSocialJobStatus(job.status))) {
    const run = await getPool().query<{ status: string }>('SELECT status FROM social_runs WHERE id=$1', [body.runId]);
    return json({ id: body.runId, status: run.rows[0]?.status || 'ready', items: 3, reused: true });
  }
  if (jobs.rows.some(job => job.status !== 'selected')) {
    return json({ error: 'Run contains items in incompatible states' }, 409);
  }
  for (const job of jobs.rows) {
    if (!job.master_image_path) return json({ error: `Missing image for ${job.id}` }, 409);
    await stat(job.master_image_path).catch(() => { throw new Error(`Image not found for ${job.id}`); });
  }
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE social_jobs SET status='ready',attempts=0,last_error=NULL,updated_at=now() WHERE run_id=$1 AND status='selected'", [body.runId]);
    await client.query("UPDATE social_runs SET status='ready',updated_at=now() WHERE id=$1", [body.runId]);
    await client.query('COMMIT');
    return json({ id: body.runId, status: 'ready', items: 3 });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
