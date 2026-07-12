import type { APIRoute } from 'astro';
import { getPool, json } from '../../../server/postgres';
import { isPrivateGeneratorRequest } from '../../../server/generatorAuth';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!await isPrivateGeneratorRequest(request)) return json({ error: 'Forbidden' }, 403);
  const result = await getPool().query(
    `SELECT j.id,j.slug,j.status,j.score,j.attempts,j.scheduled_for,j.last_error,j.run_id,j.variant_key,j.prompt_version,j.created_at,j.updated_at,
      COALESCE(json_agg(json_build_object('kind',a.kind,'token',a.public_token,'file',regexp_replace(a.path,'.*/',''))) FILTER (WHERE a.id IS NOT NULL),'[]') assets
     FROM social_jobs j LEFT JOIN social_assets a ON a.job_id=j.id
     GROUP BY j.id ORDER BY j.created_at DESC LIMIT 100`,
  );
  return json({ jobs: result.rows });
};

export const POST: APIRoute = async ({ request }) => {
  if (!await isPrivateGeneratorRequest(request)) return json({ error: 'Forbidden' }, 403);
  const body = await request.json().catch(() => ({})) as { id?: string; action?: string };
  if (!body.id || !/^[0-9a-f-]{36}$/i.test(body.id)) return json({ error: 'Invalid id' }, 400);
  const status = body.action === 'skip' ? 'skipped' : body.action === 'retry' || body.action === 'regenerate' ? 'ready' : null;
  if (!status) return json({ error: 'Unsupported action' }, 400);
  const result = await getPool().query(
    `UPDATE social_jobs SET status=$2, attempts=CASE WHEN $2='eligible' THEN 0 ELSE attempts END, locked_at=NULL,last_error=NULL,updated_at=now() WHERE id=$1 RETURNING id,status`,
    [body.id,status],
  );
  return result.rows[0] ? json(result.rows[0]) : json({ error: 'Not found' }, 404);
};
