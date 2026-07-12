import type { APIRoute } from 'astro';
import { resolveTopic } from '../../server/generationSessions';
import { isPrivateGeneratorRequest } from '../../server/generatorAuth';
import { sessionId } from '../../server/postgres';

export const POST: APIRoute = async ({ request }) => {
  if (!isPrivateGeneratorRequest(request)) return new Response('Forbidden', { status: 403 });
  const data = await request.json().catch(() => ({})) as { topic?: unknown };
  const topic = String(data.topic || '').trim();
  if (!topic) return new Response('Topic is required', { status: 400 });
  if (!resolveTopic(sessionId(request), topic)) return new Response('No pending prompt', { status: 400 });
  return new Response('OK');
};
