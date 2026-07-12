import type { APIRoute } from 'astro';
import { generateAndPublish } from '../../modules/generateAndPublish';
import { nodeExecutionContext, nodeGenerationEnv } from '../../server/nodeEnv';
import { sessionId } from '../../server/postgres';
import { initLogger } from '../../utils/logger';

function isPrivateGeneratorRequest(request: Request): boolean {
  const expected = process.env.GENERATOR_PRIVATE_TOKEN;
  if (!expected) return process.env.NODE_ENV !== 'production';
  return request.headers.get('x-generator-private-token') === expected;
}

export const GET: APIRoute = async ({ request, url }) => {
  if (!isPrivateGeneratorRequest(request)) return new Response('Generator unavailable', { status: 403 });

  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();
  let closed = false;
  const controller = {
    enqueue(chunk: string) { if (!closed) void writer.write(encoder.encode(chunk)); },
    close() { if (!closed) { closed = true; void writer.close(); } },
  };
  const env = nodeGenerationEnv();
  const ctx = nodeExecutionContext();
  initLogger(env.pseudointelekt_logs_db, ctx, env.WORKER_ID);
  void generateAndPublish(
    env,
    controller,
    undefined,
    { source: 'selfhosted-sse', sessionId: sessionId(request) },
    {
      initialTopic: url.searchParams.get('topic')?.trim() || undefined,
      initialSourceUrl: url.searchParams.get('sourceUrl')?.trim() || undefined,
    },
  ).catch(error => {
    controller.enqueue(`data: ${JSON.stringify({ failed: true, error: error instanceof Error ? error.message : String(error) })}\n\n`);
    controller.close();
  });

  return new Response(stream.readable, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' },
  });
};
