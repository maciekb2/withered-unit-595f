import server from './_worker.js';
import cron from './cron-worker';
import { generateArticle } from './modules/articleGenerator';
import { generateHeroImage } from './modules/heroImageGenerator';
import { publishArticleToGitHub } from './modules/githubPublisher';
import articlePrompt from './prompt/article-content.txt?raw';
import heroTemplate from './prompt/hero-image.txt?raw';
import { logRequest, logEvent, logError } from './utils/logger';

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

async function handleGenerateArticle(request: Request, env: Env) {
  logEvent({ type: 'generate-article-endpoint-start' });
  logEvent({ type: 'endpoint-request-id', id: crypto.randomUUID() });
  try {
    const article = await generateArticle({ apiKey: env.OPENAI_API_KEY, prompt: articlePrompt });
    const heroPrompt = heroTemplate.replace('{title}', article.title);
    const heroImage = await generateHeroImage({ apiKey: env.OPENAI_API_KEY, prompt: heroPrompt });
    await publishArticleToGitHub({ env, article, heroImage });
    logEvent({ type: 'generate-article-endpoint-complete', title: article.title });
    return new Response(JSON.stringify(article), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logError(err, { type: 'generate-article-endpoint-error' });
    throw err;
  }
}

async function handleView(request: Request, env: Env, slug: string) {
  const key = `view-${slug}`;
  const current = parseInt((await env.pseudointelekt_views.get(key)) || '0');
  const updated = current + 1;
  await env.pseudointelekt_views.put(key, updated.toString());
  return new Response(JSON.stringify({ views: updated }), {
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

async function handleLike(request: Request, env: Env, slug: string) {
  const key = `like-${slug}`;
  const current = parseInt((await env.pseudointelekt_likes.get(key)) || '0');
  const updated = current + 1;
  await env.pseudointelekt_likes.put(key, updated.toString());
  return new Response(JSON.stringify({ likes: updated }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGetLikes(env: Env, slugs: string[] = []) {
  const list = await env.pseudointelekt_likes.list();
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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    logRequest(request);
    const url = new URL(request.url);
    try {
      if (request.method === 'POST' && url.pathname === '/api/contact') {
        return await handleContact(request, env);
      }
      if (request.method === 'GET' && url.pathname === '/api/generate-article') {
        return await handleGenerateArticle(request, env);
      }
      if (request.method === 'POST' && url.pathname.startsWith('/api/views/')) {
        const slug = url.pathname.substring('/api/views/'.length);
        return await handleView(request, env, slug);
      }
      if (request.method === 'GET' && url.pathname === '/api/views') {
        return await handleGetViews(env);
      }
      if (request.method === 'POST' && url.pathname.startsWith('/api/likes/')) {
        const slug = url.pathname.substring('/api/likes/'.length);
        return await handleLike(request, env, slug);
      }
      if (request.method === 'GET' && url.pathname === '/api/likes') {
        const slugsParam = url.searchParams.get('slugs');
        const slugs = slugsParam ? slugsParam.split(',').filter(Boolean) : [];
        return await handleGetLikes(env, slugs);
      }
      return await server.fetch(request, env, ctx);
    } catch (err) {
      logError(err, { type: 'fetch-error', path: url.pathname });
      throw err;
    }
  },
  scheduled: cron.scheduled,
};
