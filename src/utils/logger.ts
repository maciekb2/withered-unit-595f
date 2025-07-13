let logsKv: KVNamespace | undefined;
let execCtx: ExecutionContext | undefined;

export function initLogger(kv?: KVNamespace, ctx?: ExecutionContext): void {
  logsKv = kv;
  execCtx = ctx;
}

function storeLog(entry: Record<string, unknown>): void {
  if (!logsKv) return;
  const type = typeof entry.type === 'string' ? entry.type : 'log';
  const date = new Date().toISOString().split('T')[0];
  const key = `${date}/${type}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const promise = logsKv.put(key, JSON.stringify(entry));
  if (execCtx) {
    execCtx.waitUntil(promise);
  }
}

export function logRequest(request: Request): void {
  const url = new URL(request.url);
  const headers = request.headers;
  const ip =
    headers.get('CF-Connecting-IP') ||
    headers.get('X-Forwarded-For') ||
    'unknown';
  const cf = (request as any).cf || {};
  const country = cf.country || headers.get('CF-IPCountry') || 'unknown';
  const ua = headers.get('User-Agent') || 'unknown';
  const referer = headers.get('Referer') || '';
  const host = headers.get('Host') || url.hostname;
  const entry = {
    time: new Date().toISOString(),
    type: 'request',
    method: request.method,
    path: url.pathname + url.search,
    host,
    ip,
    country,
    userAgent: ua,
    referer,
  };
  console.log(JSON.stringify(entry));
  storeLog(entry);
}

export function logEvent(event: Record<string, unknown>): void {
  const entry = {
    time: new Date().toISOString(),
    type: 'event',
    ...event,
  };
  console.log(JSON.stringify(entry));
  storeLog(entry);
}

export function logError(error: unknown, context: Record<string, unknown> = {}): void {
  const entry = {
    time: new Date().toISOString(),
    type: 'error',
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  };
  console.error(JSON.stringify(entry));
  storeLog(entry);
}
