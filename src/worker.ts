import server from './_worker.js';
import cron from './cron-worker';

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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/contact') {
      return handleContact(request, env);
    }
    return server.fetch(request, env, ctx);
  },
  scheduled: cron.scheduled,
};
