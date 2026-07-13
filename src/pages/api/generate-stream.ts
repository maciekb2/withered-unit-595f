import type { APIRoute } from 'astro';
import { generateAndPublish } from '../../modules/generateAndPublish';
import { nodeExecutionContext, nodeGenerationEnv } from '../../server/nodeEnv';
import { sessionId, withSession } from '../../server/postgres';
import { initLogger } from '../../utils/logger';
import { waitForTopic, clearTopic, isTopicSelectionError, TopicSelectionError } from '../../server/generationSessions';
import { isPrivateGeneratorRequest } from '../../server/generatorAuth';
import { reportWorkerError } from '../../utils/glitchtip';
import { generationCorsHeaders, withGenerationCors } from '../../server/generationCors';
import { createSseController } from '../../server/sseController';

export const OPTIONS: APIRoute = ({ request }) => new Response(null, {
  status: 204,
  headers: generationCorsHeaders(request),
});

export const GET: APIRoute = async ({ request, url }) => {
  if (!await isPrivateGeneratorRequest(request)) return new Response('Generator unavailable', { status: 403 });

  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const controller = createSseController(stream.writable);
  const env = nodeGenerationEnv();
  const ctx = nodeExecutionContext();
  initLogger(env.pseudointelekt_logs_db, ctx, env.WORKER_ID, env.RUNTIME_PLATFORM);
  const session = sessionId(request);
  const initialTopic = url.searchParams.get('topic')?.trim() || '';
  const interactive = url.searchParams.get('interactive') === '1';
  const promptPromise = initialTopic || !interactive ? undefined : waitForTopic(session);
  const onDisconnect = () => {
    clearTopic(
      session,
      new TopicSelectionError('Generation stream disconnected', 'TOPIC_CANCELLED'),
    );
    controller.close();
  };
  if (request.signal.aborted) onDisconnect();
  else request.signal.addEventListener('abort', onDisconnect, { once: true });
  void generateAndPublish(
    env,
    controller,
    promptPromise,
    { source: 'selfhosted-sse', sessionId: session },
    {
      initialTopic: initialTopic || undefined,
      initialSourceUrl: url.searchParams.get('sourceUrl')?.trim() || undefined,
    },
  ).catch(error => {
    if (isTopicSelectionError(error)) {
      controller.close();
      return;
    }
    void reportWorkerError(env, error, {
      request,
      transaction: 'selfhosted article generation',
      tags: { runtime: 'node-selfhosted', trigger: 'sse' },
      extra: { sessionId: session },
    }).catch(() => undefined);
    controller.enqueue(`data: ${JSON.stringify({ failed: true, error: error instanceof Error ? error.message : String(error) })}\n\n`);
    controller.close();
  }).finally(() => {
    request.signal.removeEventListener('abort', onDisconnect);
    clearTopic(session);
  });

  return withSession(withGenerationCors(new Response(stream.readable, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' },
  }), request), session);
};
