import type { APIRoute } from 'astro';
import { getPool, json } from '../../../server/postgres';
import { isPrivateGeneratorRequest } from '../../../server/generatorAuth';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!await isPrivateGeneratorRequest(request)) return json({ error: 'Forbidden' }, 403);
  const pool = getPool();
  const [candidates, recent, metrics] = await Promise.all([
    pool.query(`SELECT id,slug,source,status,created_at FROM social_jobs
      WHERE status='candidate' AND created_at >= now()-interval '120 days'
      ORDER BY (source->>'publishedAt')::timestamptz DESC NULLS LAST LIMIT 60`),
    pool.query(`SELECT j.slug,j.status,j.score,j.variant_key,j.prompt_version,j.updated_at,
      COALESCE(json_agg(json_build_object('channel',p.channel,'status',p.status,'draftId',p.buffer_draft_id))
        FILTER (WHERE p.id IS NOT NULL),'[]') publications
      FROM social_jobs j LEFT JOIN social_publications p ON p.job_id=j.id
      WHERE j.updated_at >= now()-interval '60 days' AND j.status IN ('review','queued','published')
      GROUP BY j.id ORDER BY j.updated_at DESC LIMIT 80`),
    pool.query(`SELECT p.channel,p.variant_key,s.window_hours,s.provider,s.metrics,s.normalized_score,s.measured_at
      FROM social_metric_snapshots s JOIN social_publications p ON p.id=s.publication_id
      ORDER BY s.measured_at DESC LIMIT 300`),
  ]);
  return json({
    generatedAt: new Date().toISOString(),
    policy: { weeklyItems: 3, current: 2, evergreen: 1, maxStaticPosts: 1, reuseDays: 60 },
    candidates: candidates.rows,
    recent: recent.rows,
    metrics: metrics.rows,
  });
};
