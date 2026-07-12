import type { APIRoute } from 'astro';
import { getPool, json } from '../../../server/postgres';
import { isPrivateGeneratorRequest } from '../../../server/generatorAuth';
import { validateSocialPackage } from '../../../social/validation';
import { validateWeeklyRun, type WeeklyRunInput } from '../../../social/weekly';
import type { SocialSource } from '../../../social/types';
import { isSealedSocialRunStatus } from '../../../social/runState';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  if (!await isPrivateGeneratorRequest(request)) return json({ error: 'Forbidden' }, 403);
  const id = url.searchParams.get('id');
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Invalid id' }, 400);
  const result = await getPool().query(`SELECT r.*,
    COALESCE(json_agg(json_build_object('id',j.id,'slug',j.slug,'status',j.status,'score',j.score,
      'imageReady',j.master_image_path IS NOT NULL,'variantKey',j.variant_key,'error',j.last_error))
      FILTER (WHERE j.id IS NOT NULL),'[]') items
    FROM social_runs r LEFT JOIN social_jobs j ON j.run_id=r.id
    WHERE ($1::uuid IS NULL OR r.id=$1) GROUP BY r.id ORDER BY r.created_at DESC LIMIT 20`, [id]);
  return json({ runs: result.rows });
};

export const POST: APIRoute = async ({ request }) => {
  if (!await isPrivateGeneratorRequest(request)) return json({ error: 'Forbidden' }, 403);
  const input = await request.json().catch(() => null) as WeeklyRunInput | null;
  if (!input) return json({ error: 'Invalid JSON' }, 400);
  const errors = validateWeeklyRun(input);
  if (errors.length) return json({ error: 'Invalid weekly run', details: errors }, 400);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existingRun = await client.query<{ id: string; status: string }>(
      'SELECT id,status FROM social_runs WHERE week_key=$1 FOR UPDATE', [input.weekKey],
    );
    if (existingRun.rows[0] && isSealedSocialRunStatus(existingRun.rows[0].status)) {
      await client.query('COMMIT');
      return json({ id: existingRun.rows[0].id, status: existingRun.rows[0].status, reused: true }, 200);
    }
    const jobs = await client.query<{ id: string; source: SocialSource }>(
      'SELECT id,source FROM social_jobs WHERE id=ANY($1::uuid[]) FOR UPDATE',
      [input.items.map(item => item.jobId)],
    );
    if (jobs.rows.length !== 3) throw new Error('One or more social candidates do not exist');
    const sources = new Map(jobs.rows.map(row => [row.id, row.source]));
    const packageErrors = input.items.flatMap(item => validateSocialPackage(item.package, sources.get(item.jobId) as SocialSource));
    if (packageErrors.length) {
      await client.query('ROLLBACK');
      return json({ error: 'Invalid social package', details: [...new Set(packageErrors)] }, 400);
    }
    const run = await client.query<{ id: string }>(`INSERT INTO social_runs(week_key,status,brief)
      VALUES($1,'uploading',$2::jsonb)
      ON CONFLICT(week_key) DO UPDATE SET brief=EXCLUDED.brief,status='uploading',updated_at=now()
      RETURNING id`, [input.weekKey, JSON.stringify(input.brief || {})]);
    const runId = run.rows[0].id;
    await client.query(`UPDATE social_jobs SET run_id=NULL,status='candidate',package=NULL,master_image_path=NULL
      WHERE run_id=$1 AND id<>ALL($2::uuid[]) AND status IN ('selected','ready')`, [runId, input.items.map(item => item.jobId)]);
    for (const item of input.items) {
      await client.query(`UPDATE social_jobs SET run_id=$2,status='selected',package=$3::jsonb,
        variant_key=$4,prompt_version=$5,master_image_path=NULL,last_error=NULL,locked_at=NULL,updated_at=now()
        WHERE id=$1`, [item.jobId, runId, JSON.stringify(item.package), item.variantKey, input.promptVersion]);
    }
    await client.query('COMMIT');
    return json({ id: runId, status: 'uploading' }, 201);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[social-runs]', error);
    return json({ error: error instanceof Error ? error.message : 'Unable to create run' }, 400);
  } finally {
    client.release();
  }
};
