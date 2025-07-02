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
      return await server.fetch(request, env, ctx);
    } catch (err) {
      logError(err, { type: 'fetch-error', path: url.pathname });
      throw err;
    }
  },
  scheduled: cron.scheduled,
};
