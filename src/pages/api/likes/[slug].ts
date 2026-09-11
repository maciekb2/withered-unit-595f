import type { APIRoute } from 'astro';
import { getPool, json, sessionId, slugFrom, withSession } from '../../../server/postgres';

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  const slug = slugFrom(params);
  const session = sessionId(request);
  const db = getPool();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // The unique insert, not a preceding SELECT, must decide who increments.
    // Concurrent requests from one session otherwise both observe "not seen".
    const inserted = await client.query('INSERT INTO engagement_like_sessions (slug, session_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING slug', [slug, session]);
    if (inserted.rowCount) {
      await client.query("INSERT INTO engagement_counters (kind, slug, value) VALUES ('like', $1, 1) ON CONFLICT (kind, slug) DO UPDATE SET value = engagement_counters.value + 1, updated_at = now()", [slug]);
    }
    const result = await client.query<{ value: number }>("SELECT value FROM engagement_counters WHERE kind = 'like' AND slug = $1", [slug]);
    await client.query('COMMIT');
    return withSession(json({ likes: Number(result.rows[0]?.value || 0) }), session);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
