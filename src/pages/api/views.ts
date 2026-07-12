import type { APIRoute } from 'astro';
import { getPool, json } from '../../server/postgres';

export const prerender = false;

export const GET: APIRoute = async () => {
  const result = await getPool().query<{ slug: string; value: number }>(
    "SELECT slug, value FROM engagement_counters WHERE kind = 'view'",
  );
  return json(Object.fromEntries(result.rows.map(row => [row.slug, Number(row.value)])));
};
