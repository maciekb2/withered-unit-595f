import server from './_worker.js';
import cron from './cron-worker';
import { generateAndPublish } from './modules/generateAndPublish';
import { createDeferred } from './utils/deferred';
import { initLogger, logRequest, logEvent, logError } from './utils/logger';
import { getSessionInfo, appendSessionCookie } from './utils/session';
import writeTemplate from './prompt/article-write.txt?raw';
import { getRecentTitlesFromGitHub } from './utils/recentTitlesGitHub';

const pendingPrompts = new Map<
  string,
  (data: { topic: string }) => void
>();

async function handleContact(request: Request, env: Env) {
  logEvent({ type: 'contact-start' });
  const data = await request.formData();
  const name = (data.get('name') || '').toString().trim();
  const email = (data.get('email') || '').toString().trim();
  const message = (data.get('message') || '').toString().trim();

  if (!name || !email || !message || !/^\S+@\S+\.\S+$/.test(email)) {
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
  const key = `view-${slug}`;
  let value = await env.pseudointelekt_views.get(key);
  if (value == null) {
    await env.pseudointelekt_views.put(key, '0');
    value = '0';
  }
  const current = parseInt(value);
  const updated = current + 1;
  await env.pseudointelekt_views.put(key, updated.toString());
  return new Response(JSON.stringify({ views: updated }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleInitView(request: Request, env: Env, slug: string) {
  const url = new URL(request.url);
  const initial = parseInt(url.searchParams.get('value') || '0');
  const key = `view-${slug}`;
  const existing = await env.pseudointelekt_views.get(key);
  if (!existing) {
    await env.pseudointelekt_views.put(key, initial.toString());
    return new Response(JSON.stringify({ views: initial }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const current = parseInt(existing);
  return new Response(JSON.stringify({ views: current }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGetView(env: Env, slug: string) {
  const key = `view-${slug}`;
  let value = await env.pseudointelekt_views.get(key);
  if (value == null) {
    await env.pseudointelekt_views.put(key, '0');
    value = '0';
  }
  const current = parseInt(value);
  return new Response(JSON.stringify({ views: current }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGetViews(env: Env) {
  const list = await env.pseudointelekt_views.list();
  const data: Record<string, number> = {};
  for (const { name } of list.keys) {
    const value = await env.pseudointelekt_views.get(name);
    if (value) {
      const slug = name.replace(/^view-/, '');
      data[slug] = parseInt(value);
    }
  }
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
  const key = `like-${slug}`;
  let value = await env.pseudointelekt_likes.get(key);
  if (value == null) {
    await env.pseudointelekt_likes.put(key, '0');
    value = '0';
  }

  const sessionKey = `liked-${sessionId}-${slug}`;
  const alreadyLiked = await env.pseudointelekt_likes.get(sessionKey);
  const current = parseInt(value);
  if (alreadyLiked) {
    return new Response(JSON.stringify({ likes: current }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updated = current + 1;
  await env.pseudointelekt_likes.put(key, updated.toString());
  await env.pseudointelekt_likes.put(sessionKey, '1');
  return new Response(JSON.stringify({ likes: updated }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGetLikes(env: Env, slugs: string[] = []) {
  const list = await env.pseudointelekt_likes.list({ prefix: 'like-' });
  const data: Record<string, number> = {};

  for (const { name } of list.keys) {
    const value = await env.pseudointelekt_likes.get(name);
    if (value) {
      const slug = name.replace(/^like-/, '');
      data[slug] = parseInt(value);
    }
  }

  for (const slug of slugs) {
    if (data[slug] == null) {
      await env.pseudointelekt_likes.put(`like-${slug}`, '0');
      data[slug] = 0;
    }
  }

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGetPrompt(env: Env) {
  logEvent({ type: 'get-prompt' });
  const recent = await getRecentTitlesFromGitHub(env.GITHUB_REPO, env.GITHUB_TOKEN);
  const prompt = writeTemplate.replace(
    '{recent_titles}',
    recent.map((t, i) => `${i + 1}. ${t}`).join('\n')
  );
  return new Response(JSON.stringify({ prompt }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleClientLog(request: Request, sessionId: string) {
  try {
    const data = (await request.json()) as Record<string, unknown>;
    logEvent({ type: 'client-log', sessionId, ...data });
    return new Response('OK');
  } catch (err) {
    logError(err, { type: 'client-log-error' });
    return new Response('Bad Request', { status: 400 });
  }
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
      let response: Response;
      if (request.method === 'POST' && url.pathname === '/api/contact') {
        response = await handleContact(request, env);
      } else if (
        request.method === 'GET' &&
        url.pathname === '/api/generate-stream'
      ) {
        logEvent({ type: 'generate-stream-start', sessionId: session.id });
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const ctrl = {
          enqueue: (chunk: string) => writer.write(new TextEncoder().encode(chunk)),
          close: () => writer.close(),
        };
        const deferred = createDeferred<{ topic: string }>();
        pendingPrompts.set(session.id, deferred.resolve);
        ctx.waitUntil(
          generateAndPublish(env, ctrl, deferred.promise)
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
        response = await handleClientLog(request, session.id);
      } else if (
        request.method === 'POST' &&
        url.pathname === '/api/update-prompt'
      ) {
        const resolver = pendingPrompts.get(session.id);
        if (!resolver) {
          logEvent({ type: 'update-prompt-missing', sessionId: session.id });
          response = new Response('No pending prompt', { status: 400 });
        } else {
          const data = await request.json();
          const topic = (data as any).topic ?? '';
          logEvent({ type: 'update-prompt', sessionId: session.id });
          resolver({ topic: String(topic) });
          response = new Response('OK');
        }
      } else if (
        request.method === 'GET' &&
        url.pathname === '/api/get-prompt'
      ) {
        response = await handleGetPrompt(env);
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
      const errorResponse = {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      };
      return new Response(JSON.stringify(errorResponse, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
  scheduled: cron.scheduled,
};
