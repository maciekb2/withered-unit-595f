import server from './_worker.js';
import cron from './cron-worker';
import { generateAndPublish } from './modules/generateAndPublish';
import { createDeferred } from './utils/deferred';
import { initLogger, logRequest, logEvent, logError } from './utils/logger';
import { getSessionInfo, appendSessionCookie } from './utils/session';
import writeTemplate from './prompt/article-write.txt?raw';
import { getRecentTitlesFromGitHub } from './utils/recentTitlesGitHub';
import {
  isGenerationPath,
  requireCloudflareAccess,
  type CloudflareAccessIdentity,
} from './utils/accessAuth';
import {
  ensureCounter,
  getCounter,
  getCounters,
  hasLikeSession,
  incrementCounter,
  markLikeIfFirst,
} from './utils/engagementCounters';

const pendingPrompts = new Map<
  string,
  (data: { topic: string }) => void
>();

const CONTACT_LIMITS = {
  maxNameLength: 120,
  maxEmailLength: 254,
  maxMessageLength: 4000,
  sessionWindowSeconds: 10 * 60,
  sessionMax: 3,
  ipWindowSeconds: 60 * 60,
  ipMax: 10,
} as const;

const LIKE_LIMITS = {
  sessionWindowSeconds: 60 * 60,
  sessionMax: 20,
  ipWindowSeconds: 60 * 60,
  ipMax: 40,
  ipSlugWindowSeconds: 24 * 60 * 60,
  ipSlugMax: 3,
} as const;

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function shortHash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .slice(0, 12)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getClientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

async function incrementRateLimit(
  namespace: KVNamespace,
  key: string,
  limit: number,
  ttlSeconds: number,
): Promise<boolean> {
  const raw = await namespace.get(key);
  const current = raw ? Number.parseInt(raw, 10) || 0 : 0;
  if (current >= limit) return false;
  await namespace.put(key, String(current + 1), {
    expirationTtl: ttlSeconds,
  });
  return true;
}

async function checkContactRateLimit(
  request: Request,
  env: Env,
  sessionId: string,
): Promise<Response | null> {
  const [sessionHash, ipHash] = await Promise.all([
    shortHash(sessionId),
    shortHash(getClientIp(request)),
  ]);

  const allowedBySession = await incrementRateLimit(
    env.pseudointelekt_contact_form,
    `rate:contact:session:${sessionHash}`,
    CONTACT_LIMITS.sessionMax,
    CONTACT_LIMITS.sessionWindowSeconds,
  );

  if (!allowedBySession) {
    logEvent({ type: 'contact-rate-limit-session', sessionHash });
    return jsonResponse({ message: 'Too many messages. Try again later.' }, 429);
  }

  const allowedByIp = await incrementRateLimit(
    env.pseudointelekt_contact_form,
    `rate:contact:ip:${ipHash}`,
    CONTACT_LIMITS.ipMax,
    CONTACT_LIMITS.ipWindowSeconds,
  );

  if (!allowedByIp) {
    logEvent({ type: 'contact-rate-limit-ip', ipHash });
    return jsonResponse({ message: 'Too many messages. Try again later.' }, 429);
  }

  return null;
}

async function checkLikeRateLimit(
  request: Request,
  env: Env,
  sessionId: string,
  slug: string,
  currentLikes: number,
): Promise<Response | null> {
  const ip = getClientIp(request);
  const [sessionHash, ipHash, ipSlugHash] = await Promise.all([
    shortHash(sessionId),
    shortHash(ip),
    shortHash(`${ip}:${slug}`),
  ]);

  const allowedBySession = await incrementRateLimit(
    env.pseudointelekt_likes,
    `rate:like:session:${sessionHash}`,
    LIKE_LIMITS.sessionMax,
    LIKE_LIMITS.sessionWindowSeconds,
  );

  if (!allowedBySession) {
    logEvent({ type: 'like-rate-limit-session', sessionHash, slug });
    return jsonResponse({ likes: currentLikes, rateLimited: true }, 429);
  }

  const allowedByIp = await incrementRateLimit(
    env.pseudointelekt_likes,
    `rate:like:ip:${ipHash}`,
    LIKE_LIMITS.ipMax,
    LIKE_LIMITS.ipWindowSeconds,
  );

  if (!allowedByIp) {
    logEvent({ type: 'like-rate-limit-ip', ipHash });
    return jsonResponse({ likes: currentLikes, rateLimited: true }, 429);
  }

  const allowedByIpSlug = await incrementRateLimit(
    env.pseudointelekt_likes,
    `rate:like:ip-slug:${ipSlugHash}`,
    LIKE_LIMITS.ipSlugMax,
    LIKE_LIMITS.ipSlugWindowSeconds,
  );

  if (!allowedByIpSlug) {
    logEvent({ type: 'like-rate-limit-ip-slug', ipSlugHash, slug });
    return jsonResponse({ likes: currentLikes, rateLimited: true }, 429);
  }

  return null;
}

async function handleContact(request: Request, env: Env, sessionId: string) {
  logEvent({ type: 'contact-start' });
  const rateLimitResponse = await checkContactRateLimit(request, env, sessionId);
  if (rateLimitResponse) return rateLimitResponse;

  const data = await request.formData();
  const name = (data.get('name') || '').toString().trim();
  const email = (data.get('email') || '').toString().trim();
  const message = (data.get('message') || '').toString().trim();

  if (
    !name ||
    !email ||
    !message ||
    name.length > CONTACT_LIMITS.maxNameLength ||
    email.length > CONTACT_LIMITS.maxEmailLength ||
    message.length > CONTACT_LIMITS.maxMessageLength ||
    !/^\S+@\S+\.\S+$/.test(email)
  ) {
    return new Response('Invalid input', { status: 400 });
  }

  const payload = {
    name,
    email,
    message,
    date: new Date().toISOString(),
  };

  try {
    await fetch(env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Nowa wiadomość od ${name} <${email}>:\n${message}`,
      }),
    });

    await env.pseudointelekt_contact_form.put(`msg-${Date.now()}`, JSON.stringify(payload));

    logEvent({ type: 'contact-complete', name, email });
    return new Response('OK', { status: 200 });
  } catch (err) {
    logError(err, { type: 'contact-error' });
    throw err;
  }
}

async function handleView(request: Request, env: Env, slug: string) {
  const updated = await incrementCounter(env, 'view', slug);
  return new Response(JSON.stringify({ views: updated }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleInitView(request: Request, env: Env, slug: string) {
  const url = new URL(request.url);
  const initial = parseInt(url.searchParams.get('value') || '0');
  const current = await ensureCounter(env, 'view', slug, initial);
  return new Response(JSON.stringify({ views: current }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGetView(env: Env, slug: string) {
  const current = await ensureCounter(env, 'view', slug);
  return new Response(JSON.stringify({ views: current }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGetViews(env: Env) {
  const data = await getCounters(env, 'view');
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleLike(
  request: Request,
  env: Env,
  slug: string,
  sessionId: string,
) {
  const current = await ensureCounter(env, 'like', slug);
  const legacySessionKey = `liked-${sessionId}-${slug}`;
  const legacyAlreadyLiked = await env.pseudointelekt_likes.get(legacySessionKey);
  if (legacyAlreadyLiked) {
    return new Response(JSON.stringify({ likes: current }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (await hasLikeSession(env, slug, sessionId)) {
    return new Response(JSON.stringify({ likes: current }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rateLimitResponse = await checkLikeRateLimit(
    request,
    env,
    sessionId,
    slug,
    current,
  );
  if (rateLimitResponse) return rateLimitResponse;

  const firstLike = await markLikeIfFirst(env, slug, sessionId);
  if (!firstLike) {
    const updatedCurrent = await getCounter(env, 'like', slug);
    return new Response(JSON.stringify({ likes: updatedCurrent }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updated = await incrementCounter(env, 'like', slug);
  return new Response(JSON.stringify({ likes: updated }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGetLikes(env: Env, slugs: string[] = []) {
  const data = await getCounters(env, 'like', slugs);

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGetPrompt(
  env: Env,
  auditContext: Record<string, unknown> = {},
) {
  logEvent({ type: 'get-prompt', ...auditContext });
  const recent = await getRecentTitlesFromGitHub(env.GITHUB_REPO, env.GITHUB_TOKEN);
  const prompt = writeTemplate.replace(
    '{recent_titles}',
    recent.map((t, i) => `${i + 1}. ${t}`).join('\n')
  );
  return new Response(JSON.stringify({ prompt }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleClientLog(
  request: Request,
  sessionId: string,
  auditContext: Record<string, unknown> = {},
) {
  try {
    const data = (await request.json()) as Record<string, unknown>;
    logEvent({ type: 'client-log', sessionId, ...auditContext, ...data });
    return new Response('OK');
  } catch (err) {
    logError(err, { type: 'client-log-error', sessionId, ...auditContext });
    return new Response('Bad Request', { status: 400 });
  }
}

function buildAccessAuditContext(
  sessionId: string,
  identity?: CloudflareAccessIdentity,
): Record<string, unknown> {
  return {
    sessionId,
    accessEmail: identity?.email || 'unknown',
    accessSub: identity?.sub || 'unknown',
    accessAud: identity?.aud || 'unknown',
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    initLogger(env.pseudointelekt_logs_db, ctx, env.WORKER_ID);
    const session = getSessionInfo(request);
    logRequest(request, session.id);
    if (session.isNew) {
      logEvent({ type: 'session-start', sessionId: session.id });
    }
    const url = new URL(request.url);
    try {
      let accessIdentity: CloudflareAccessIdentity | undefined;
      if (isGenerationPath(url.pathname)) {
        const authResult = await requireCloudflareAccess(request, env);
        if (authResult.response) return authResult.response;
        accessIdentity = authResult.identity;
      }
      const accessAuditContext = buildAccessAuditContext(session.id, accessIdentity);

      let response: Response;
      if (request.method === 'POST' && url.pathname === '/api/contact') {
        response = await handleContact(request, env, session.id);
      } else if (
        request.method === 'GET' &&
        url.pathname === '/api/generate-stream'
      ) {
        logEvent({ type: 'generate-stream-start', ...accessAuditContext });
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const ctrl = {
          enqueue: (chunk: string) => writer.write(new TextEncoder().encode(chunk)),
          close: () => writer.close(),
        };
        const deferred = createDeferred<{ topic: string }>();
        pendingPrompts.set(session.id, deferred.resolve);
        ctx.waitUntil(
          generateAndPublish(env, ctrl, deferred.promise, {
            source: 'manual-sse',
            ...accessAuditContext,
          })
            .catch(err => {
              console.error('Błąd w tle:', err);
              const msg = JSON.stringify({ log: `❌ KRYTYCZNY BŁĄD: ${err.message}` });
              ctrl.enqueue(`data: ${msg}\n\n`);
              ctrl.close();
            })
            .finally(() => pendingPrompts.delete(session.id))
        );
        response = new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      } else if (
        request.method === 'POST' &&
        url.pathname === '/api/client-log'
      ) {
        response = await handleClientLog(request, session.id, accessAuditContext);
      } else if (
        request.method === 'POST' &&
        url.pathname === '/api/update-prompt'
      ) {
        const resolver = pendingPrompts.get(session.id);
        if (!resolver) {
          logEvent({ type: 'update-prompt-missing', ...accessAuditContext });
          response = new Response('No pending prompt', { status: 400 });
        } else {
          const data = await request.json();
          const topic = (data as any).topic ?? '';
          logEvent({ type: 'update-prompt', ...accessAuditContext, topic });
          resolver({ topic: String(topic) });
          response = new Response('OK');
        }
      } else if (
        request.method === 'GET' &&
        url.pathname === '/api/get-prompt'
      ) {
        response = await handleGetPrompt(env, accessAuditContext);
      } else if (
        request.method === 'POST' &&
        url.pathname.startsWith('/api/views-init/')
      ) {
        const slug = url.pathname.substring('/api/views-init/'.length);
        response = await handleInitView(request, env, slug);
      } else if (url.pathname.startsWith('/api/views/')) {
        const slug = url.pathname.substring('/api/views/'.length);
        if (request.method === 'POST') {
          response = await handleView(request, env, slug);
        } else if (request.method === 'GET') {
          response = await handleGetView(env, slug);
        } else {
          response = new Response('Method Not Allowed', { status: 405 });
        }
      } else if (request.method === 'GET' && url.pathname === '/api/views') {
        response = await handleGetViews(env);
      } else if (
        request.method === 'POST' &&
        url.pathname.startsWith('/api/likes/')
      ) {
        const slug = url.pathname.substring('/api/likes/'.length);
        response = await handleLike(request, env, slug, session.id);
      } else if (request.method === 'GET' && url.pathname === '/api/likes') {
        const slugsParam = url.searchParams.get('slugs');
        const slugs = slugsParam ? slugsParam.split(',').filter(Boolean) : [];
        response = await handleGetLikes(env, slugs);
      } else {
        response = await server.fetch(request, env, ctx);
      }
      if (session.isNew) {
        appendSessionCookie(response, session.id);
      }
      return response;
    } catch (err) {
      logError(err, { type: 'fetch-error', path: url.pathname });
      return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
  scheduled: cron.scheduled,
};
