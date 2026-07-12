import type { APIRoute } from 'astro';
import { getPool, sessionId, withSession } from '../../server/postgres';

const limits = { name: 120, email: 254, message: 6000 };
const notificationTimeoutMs = 5000;

async function notifySlack(name: string, email: string, message: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `Nowa wiadomość od ${name} <${email}>:\n${message}` }),
      signal: AbortSignal.timeout(notificationTimeoutMs),
    });
    if (!response.ok) {
      console.error('Contact Slack notification failed', { status: response.status });
    }
  } catch (error) {
    console.error('Contact Slack notification failed', {
      error: error instanceof Error ? error.message : 'unknown error',
    });
  }
}

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
  await notifySlack(name, email, message);
  return withSession(new Response('OK', {
    status: 201,
    headers: { 'cache-control': 'no-store' },
  }), sessionId(request));
};
