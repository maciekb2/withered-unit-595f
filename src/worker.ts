import server from './_worker.js';
import cron from './cron-worker';
import { generateArticle } from './modules/articleGenerator';
import { generateHeroImage } from './modules/heroImageGenerator';
import { publishArticleToGitHub } from './modules/githubPublisher';
import articlePrompt from './prompt/article-content.txt?raw';
import heroTemplate from './prompt/hero-image.txt?raw';

async function handleContact(request: Request, env: Env) {
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

  await fetch(env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `Nowa wiadomość od ${name} <${email}>:\n${message}`,
    }),
  });

  await env.pseudointelekt_contact_form.put(`msg-${Date.now()}`, JSON.stringify(payload));

  return new Response('OK', { status: 200 });
}

async function handleGenerateArticle(env: Env) {
  const article = await generateArticle({ apiKey: env.OPENAI_API_KEY, prompt: articlePrompt });
  const heroPrompt = heroTemplate.replace('{title}', article.title);
  const heroImage = await generateHeroImage({ apiKey: env.OPENAI_API_KEY, prompt: heroPrompt });
  await publishArticleToGitHub({ env, article, heroImage });
  return new Response(JSON.stringify(article), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/contact') {
      return handleContact(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/api/generate-article') {
      return handleGenerateArticle(env);
    }
    return server.fetch(request, env, ctx);
  },
  scheduled: cron.scheduled,
};
