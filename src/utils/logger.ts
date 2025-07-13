let logsDb: D1Database | undefined;
let execCtx: ExecutionContext | undefined;
let workerId: string | undefined;

export function initLogger(
  db?: D1Database,
  ctx?: ExecutionContext,
  id?: string
): void {
  logsDb = db;
  execCtx = ctx;
  workerId = id;
}

function storeLog(entry: Record<string, unknown>): void {
  if (!logsDb) return;
  const promise = (async () => {
    await logsDb.exec(
      'CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, time TEXT, worker_id TEXT, data TEXT)'
    );
    return logsDb
      .prepare(
        'INSERT INTO logs (time, worker_id, data) VALUES (?1, ?2, ?3)'
      )
      .bind(new Date().toISOString(), workerId || 'unknown', JSON.stringify(entry))
      .run();
  })();
  if (execCtx) {
    execCtx.waitUntil(promise);
  }
}

export function logRequest(request: Request, sessionId?: string): void {
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
    sessionId,
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
