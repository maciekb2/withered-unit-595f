import type { APIRoute } from 'astro';
import { getPool } from '../../server/postgres';
import { validateContact } from '../../utils/contactValidation';
import { ContactRequestError, contactClientKey, hashContactKey, readContactForm, sameOrigin } from '../../server/contactProtection';

const reply = (status: number, message: string, extra = {}, headers = {}) => new Response(JSON.stringify({ message, ...extra }), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});
async function notifySlack(name: string, email: string, message: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  const text = `${name} <${email}>\n${message}`;
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Nowa wiadomość z formularza Pseudointelektu', blocks: [
        { type: 'section', text: { type: 'plain_text', text: text.slice(0, 2800), emoji: false } },
        ...(text.length > 2800 ? [{ type: 'section', text: { type: 'plain_text', text: text.slice(2800), emoji: false } }] : []),
      ] }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.error('Contact notification failed', { status: response.status });
  } catch { console.error('Contact notification unavailable'); }
}

export const POST: APIRoute = async (context) => {
  const { request } = context;
  if (!sameOrigin(request)) return reply(403, 'Otwórz formularz na stronie i spróbuj ponownie.');
  let form: FormData;
  try { form = await readContactForm(request); }
  catch (error) { return reply(error instanceof ContactRequestError ? error.status : 400, 'Nie udało się odczytać formularza.'); }
  const values: Record<string, string> = {};
  for (const field of ['name', 'email', 'message', 'submissionId', 'website']) {
    const entries = form.getAll(field);
    if (entries.length > 1 || entries.some(value => typeof value !== 'string')) return reply(400, 'Nieprawidłowy formularz.');
    values[field] = String(entries[0] || '').trim();
  }
  if (values.website) return reply(202, 'Dziękuję. Wiadomość została przyjęta.');
  const { name, email, message, submissionId } = values;
  const errors = validateContact({ name, email, message });
  if (Object.keys(errors).length) return reply(400, 'Sprawdź zaznaczone pola.', { errors });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) return reply(400, 'Odśwież stronę formularza i spróbuj ponownie.');
  let address = 'unknown';
  try { address = context.clientAddress || 'unknown'; } catch { /* Adapter without a client address. */ }
  let client;
  try {
    client = await getPool().connect();
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`contact:${submissionId}`]);
    const previous = await client.query('SELECT name, email, message FROM contact_messages WHERE submission_id=$1', [submissionId]);
    if (previous.rowCount) {
      await client.query('ROLLBACK');
      const saved = previous.rows[0];
      return saved.name === name && saved.email === email && saved.message === message
        ? reply(200, 'Dziękuję. Wiadomość została przyjęta.') : reply(409, 'Formularz został już wysłany. Odśwież stronę przed napisaniem kolejnej wiadomości.');
    }
    await client.query('DELETE FROM contact_rate_limits WHERE expires_at <= now()');
    const buckets = [
      { key: `ip:${contactClientKey(request, address)}`, limit: 10, seconds: 3600 },
      { key: `email:${hashContactKey(email.toLowerCase())}`, limit: 3, seconds: 600 },
      { key: 'global', limit: 30, seconds: 60 },
    ];
    for (const bucket of buckets) {
      const accepted = await client.query(`INSERT INTO contact_rate_limits (bucket, hits, expires_at)
        VALUES ($1, 1, now() + $2 * interval '1 second') ON CONFLICT (bucket) DO UPDATE
        SET hits = contact_rate_limits.hits + 1 WHERE contact_rate_limits.hits < $3 RETURNING hits`, [bucket.key, bucket.seconds, bucket.limit]);
      if (!accepted.rowCount) {
        await client.query('ROLLBACK');
        return reply(429, 'Zbyt wiele wiadomości w krótkim czasie. Spróbuj później lub napisz e-mail.', {}, { 'retry-after': String(bucket.seconds) });
      }
    }
    await client.query("INSERT INTO contact_messages (name, email, message, submission_id, expires_at) VALUES ($1, $2, $3, $4, now() + interval '365 days')", [name, email, message, submissionId]);
    await client.query('COMMIT');
  } catch {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Contact persistence unavailable');
    return reply(503, 'Formularz jest chwilowo niedostępny. Zachowaj treść i spróbuj ponownie lub napisz e-mail.');
  } finally { client?.release(); }
  await notifySlack(name, email, message);
  return reply(201, 'Dziękuję. Wiadomość została przyjęta.');
};
