import type { APIRoute } from 'astro';
import { getPool, json, sessionId } from '../../server/postgres';

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json() as Record<string, unknown>;
    await getPool().query(
      'INSERT INTO logs (worker_id, data) VALUES ($1, $2::jsonb)',
      [process.env.WORKER_ID || 'pseudointelekt-selfhosted', JSON.stringify({ type: 'client-log', sessionId: sessionId(request), ...payload })],
    );
    return new Response('OK');
  } catch {
    return json({ error: 'Bad Request' }, 400);
  }
};
