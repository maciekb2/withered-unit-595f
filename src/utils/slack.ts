import { retryFetch } from './retryFetch';
import { logEvent, logError } from './logger';

export async function sendSlackMessage(webhook: string, text: string): Promise<void> {
  logEvent({ type: 'slack-send-start' });
  try {
    const res = await retryFetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      retries: 2,
      retryDelayMs: 1000,
    });
    logEvent({ type: 'slack-send-status', status: res.status });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Slack webhook failed: ${res.status} ${msg}`);
    }
    logEvent({ type: 'slack-send-complete' });
  } catch (err) {
    logError(err, { type: 'slack-send-error' });
  }
}
