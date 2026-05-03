export interface WorkerErrorReportContext {
  request?: Request;
  transaction?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export async function reportWorkerError(
  env: Env,
  error: unknown,
  context: WorkerErrorReportContext = {},
): Promise<{ ok: boolean; status?: number; body?: string; reason?: string }> {
  const dsn = env.SENTRY_DSN || env.GLITCHTIP_SENTRY_DSN;
  if (!dsn) return { ok: false, reason: 'missing_dsn' };

  let dsnUrl: URL;
  try {
    dsnUrl = new URL(dsn);
  } catch {
    return { ok: false, reason: 'invalid_dsn' };
  }

  const publicKey = dsnUrl.username;
  const projectId = dsnUrl.pathname.replace(/^\/+/, '');
  if (!projectId || !publicKey) return { ok: false, reason: 'invalid_dsn' };

  const request = context.request;
  const requestUrl = request ? new URL(request.url) : undefined;
  const eventId = crypto.randomUUID().replace(/-/g, '');
  const err = error instanceof Error ? error : new Error(String(error));
  const event = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    logger: 'cloudflare-worker',
    level: 'error',
    environment: env.SENTRY_ENVIRONMENT || 'production',
    release: env.SENTRY_RELEASE || env.WORKER_ID || 'pseudointelekt-worker',
    transaction:
      context.transaction ||
      (request && requestUrl ? `${request.method} ${requestUrl.pathname}` : 'scheduled'),
    exception: {
      values: [
        {
          type: err.name || 'Error',
          value: err.message || String(error),
        },
      ],
    },
    request: request
      ? {
          url: request.url,
          method: request.method,
        }
      : undefined,
    tags: {
      component: 'cloudflare-worker',
      worker: env.WORKER_ID || 'pseudointelekt2137-blog',
      route: requestUrl?.pathname || context.transaction || 'scheduled',
      ...context.tags,
    },
    extra: {
      stack: err.stack,
      ...context.extra,
    },
  };
  const envelope = [
    JSON.stringify({ event_id: eventId, dsn, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n');

  const response = await fetch(`${dsnUrl.origin}/api/${projectId}/envelope/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-sentry-envelope',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=ssn-cf-worker/1.0`,
    },
    body: envelope,
  });
  const body = response.ok ? undefined : await response.text().catch(() => '');
  return { ok: response.ok, status: response.status, body };
}
