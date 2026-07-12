import type { APIRoute } from 'astro';
import { getPool, json, slugFrom } from '../../../server/postgres';

export const prerender = false;

export const POST: APIRoute = async ({ params, url }) => {
  const slug = slugFrom(params);
  const baseline = Math.max(0, Number.parseInt(url.searchParams.get('value') || '0', 10) || 0);
  const result = await getPool().query<{ value: number }>(
    `INSERT INTO engagement_counters (kind, slug, value)
     VALUES ('view', $1, $2)
     ON CONFLICT (kind, slug) DO UPDATE SET value = GREATEST(engagement_counters.value, EXCLUDED.value), updated_at = now()
     RETURNING value`, [slug, baseline],
  );
  return json({ views: Number(result.rows[0].value) });
};
