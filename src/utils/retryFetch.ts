export interface RetryFetchOptions extends RequestInit {
  retries?: number;
  retryDelayMs?: number;
}

import { logEvent } from './logger';

export async function retryFetch(
  url: RequestInfo | URL,
  options: RetryFetchOptions = {}
): Promise<Response> {
  const { retries = 3, retryDelayMs = 500, ...init } = options;

  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const res = await fetch(url, init);
      if (res.ok || !(res.status === 429 || res.status >= 500)) {
        return res;
      }
      if (attempt > retries) {
        return res;
      }
      logEvent({ type: 'retry-fetch', url: String(url), attempt, status: res.status });
    } catch (err) {
      if (attempt > retries) {
        throw err;
      }
      logEvent({ type: 'retry-fetch-error', url: String(url), attempt, error: err instanceof Error ? err.message : String(err) });
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
}
