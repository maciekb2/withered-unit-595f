import server from './_worker.js';
import cron from './cron-worker';

async function handleContact(request: Request, env: Env, ip: string) {
  const data = await request.formData();
  const name = (data.get('name') || '').toString().trim();
  const email = (data.get('email') || '').toString().trim();
  const message = (data.get('message') || '').toString().trim();

  if (!name || !email || !message || !/^\S+@\S+\.\S+$/.test(email)) {
    console.warn(`Invalid contact form input from ${ip}`);
    return new Response('Invalid input', { status: 400 });
  }

  const payload = {
    name,
    email,
    message,
    date: new Date().toISOString(),
  };

  try {
    const res = await fetch(env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Nowa wiadomość od ${name} <${email}>:\n${message}`,
      }),
    });
    if (!res.ok) {
      console.error(`Slack webhook returned ${res.status}`);
    }
  } catch (err) {
    console.error('Slack webhook error', err);
  }

  try {
    await env.pseudointelekt_contact_form.put(`msg-${Date.now()}`, JSON.stringify(payload));
  } catch (err) {
    console.error('KV store error', err);
  }

  return new Response('OK', { status: 200 });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    console.log(`Visit ${url.pathname} from ${ip}`);

    try {
      if (request.method === 'POST' && url.pathname === '/api/contact') {
        const res = await handleContact(request, env, ip);
        if (res.status >= 400) {
          console.warn(`Contact form error ${res.status} from ${ip}`);
        }
        return res;
      }

      const response = await server.fetch(request, env, ctx);
      if (response.status === 404) {
        console.warn(`Not found ${url.pathname} from ${ip}`);
      } else if (response.status >= 500) {
        console.error(`Server error ${response.status} on ${url.pathname} from ${ip}`);
      }
      return response;
    } catch (err) {
      console.error(`Unhandled exception for ${url.pathname} from ${ip}`, err);
      return new Response('Internal Error', { status: 500 });
    }
  },
  scheduled: cron.scheduled,
};
