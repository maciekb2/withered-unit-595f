import type { APIRoute } from 'astro';
import { getPool } from '../../../server/postgres';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const expected = process.env.SOCIAL_METRICS_TOKEN || process.env.GENERATOR_PRIVATE_TOKEN;
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) return new Response('Forbidden', { status: 403 });
  const [statuses, oldest, lastSuccess] = await Promise.all([
    getPool().query<{ status: string; count: string }>('SELECT status,count(*)::text count FROM social_jobs GROUP BY status'),
    getPool().query<{ seconds: string }>("SELECT COALESCE(extract(epoch FROM now()-min(created_at)),0)::text seconds FROM social_jobs WHERE status IN ('waiting_article','eligible','failed')"),
    getPool().query<{ timestamp: string | null }>("SELECT extract(epoch FROM max(updated_at))::text timestamp FROM social_jobs WHERE status='review'"),
  ]);
  const lines = [
    '# HELP pseudointelekt_social_jobs Number of social jobs by status.',
    '# TYPE pseudointelekt_social_jobs gauge',
    ...statuses.rows.map(row => `pseudointelekt_social_jobs{status="${row.status}"} ${row.count}`),
    '# HELP pseudointelekt_social_oldest_pending_seconds Age of the oldest pending social job.',
    '# TYPE pseudointelekt_social_oldest_pending_seconds gauge',
    `pseudointelekt_social_oldest_pending_seconds ${oldest.rows[0]?.seconds || 0}`,
    '# HELP pseudointelekt_social_last_success_timestamp_seconds Last completed social draft timestamp.',
    '# TYPE pseudointelekt_social_last_success_timestamp_seconds gauge',
    `pseudointelekt_social_last_success_timestamp_seconds ${lastSuccess.rows[0]?.timestamp || 0}`,
  ];
  return new Response(`${lines.join('\n')}\n`, { headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8', 'cache-control': 'no-store' } });
};
