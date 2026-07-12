import type { APIRoute } from 'astro';
import { getPool, json, sessionId, withSession } from '../../server/postgres';

const limits = { name: 120, email: 254, message: 6000 };

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const name = String(form.get('name') || '').trim();
  const email = String(form.get('email') || '').trim();
  const message = String(form.get('message') || '').trim();
  if (!name || !message || !/^\S+@\S+\.\S+$/.test(email) || name.length > limits.name || email.length > limits.email || message.length > limits.message) {
    return new Response('Invalid input', { status: 400 });
  }
  await getPool().query(
    'INSERT INTO contact_messages (name, email, message, expires_at) VALUES ($1, $2, $3, now() + interval \'365 days\')',
    [name, email, message],
  );
  if (process.env.SLACK_WEBHOOK_URL) {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `Nowa wiadomość od ${name} <${email}>:\n${message}` }),
    });
  }
  return withSession(new Response('OK'), sessionId(request));
};
