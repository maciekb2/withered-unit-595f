import type { APIRoute } from 'astro';
import { getPool, json, slugFrom } from '../../../server/postgres';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const slug = slugFrom(params);
  const result = await getPool().query<{ value: number }>(
    "SELECT value FROM engagement_counters WHERE kind = 'view' AND slug = $1",
    [slug],
  );
  return json({ views: Number(result.rows[0]?.value || 0) });
};

export const POST: APIRoute = async ({ params }) => {
  const slug = slugFrom(params);
  const result = await getPool().query<{ value: number }>(
    `INSERT INTO engagement_counters (kind, slug, value)
     VALUES ('view', $1, 1)
     ON CONFLICT (kind, slug) DO UPDATE SET value = engagement_counters.value + 1, updated_at = now()
     RETURNING value`, [slug],
  );
  return json({ views: Number(result.rows[0].value) });
};
