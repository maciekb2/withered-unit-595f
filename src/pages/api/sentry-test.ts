import type { APIRoute } from 'astro';
import { reportWorkerError } from '../../utils/glitchtip';
import { nodeGenerationEnv } from '../../server/nodeEnv';

export const GET: APIRoute = async ({ request, url }) => {
  if (process.env.SENTRY_TEST_ENDPOINT !== 'enabled') return new Response('Not Found', { status: 404 });
  const expected = process.env.SENTRY_TEST_TOKEN;
  if (!expected || url.searchParams.get('token') !== expected) return new Response('Forbidden', { status: 403 });
  const error = new Error('Controlled Pseudointelekt Node GlitchTip test');
  error.name = 'PseudointelektNodeGlitchTipTestError';
  const report = await reportWorkerError(nodeGenerationEnv(), error, {
    request,
    transaction: 'node glitchtip test',
    tags: { runtime: 'node-selfhosted', probe: 'manual' },
  });
  return new Response(JSON.stringify({ ok: report.ok, status: report.status }), {
    status: report.ok ? 200 : 502,
    headers: { 'content-type': 'application/json' },
  });
};
