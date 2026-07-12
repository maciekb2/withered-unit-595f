import type { APIRoute } from 'astro';
import { getPool, json } from '../../server/postgres';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const slugs = (url.searchParams.get('slugs') || '').split(',').filter(Boolean).slice(0, 100);
  const result = slugs.length
    ? await getPool().query<{ slug: string; value: number }>("SELECT slug, value FROM engagement_counters WHERE kind = 'like' AND slug = ANY($1)", [slugs])
    : await getPool().query<{ slug: string; value: number }>("SELECT slug, value FROM engagement_counters WHERE kind = 'like'");
  return json(Object.fromEntries(result.rows.map(row => [row.slug, Number(row.value)])));
};
