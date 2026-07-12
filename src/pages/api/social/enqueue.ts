import type { APIRoute } from 'astro';
import { getPool, json } from '../../../server/postgres';
import { validateSocialSource, type SocialSource } from '../../../social/types';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!process.env.GENERATOR_PRIVATE_TOKEN || request.headers.get('x-generator-private-token') !== process.env.GENERATOR_PRIVATE_TOKEN) {
    return json({ error: 'Forbidden' }, 403);
  }
  try {
    const source = await request.json() as SocialSource;
    const errors = validateSocialSource(source);
    if (errors.length) return json({ error: 'Invalid social source', details: errors }, 400);
    const result = await getPool().query<{ id: string; status: string }>(
      `INSERT INTO social_jobs (slug, source, status)
       VALUES ($1, $2::jsonb, 'candidate')
       ON CONFLICT (slug) DO UPDATE SET source = EXCLUDED.source, updated_at = now()
       RETURNING id, status`,
      [source.slug, JSON.stringify(source)],
    );
    return json(result.rows[0], 202);
  } catch (error) {
    console.error('[social-enqueue]', error);
    return json({ error: 'Unable to enqueue social package' }, 500);
  }
};
