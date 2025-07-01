export function logRequest(request: Request): void {
  const url = new URL(request.url);
  const headers = request.headers;
  const ip =
    headers.get('CF-Connecting-IP') ||
    headers.get('X-Forwarded-For') ||
    'unknown';
  const ua = headers.get('User-Agent') || 'unknown';
  const referer = headers.get('Referer') || '';
  const host = headers.get('Host') || url.hostname;
  console.log(
    JSON.stringify({
      time: new Date().toISOString(),
      type: 'request',
      method: request.method,
      path: url.pathname + url.search,
      host,
      ip,
      userAgent: ua,
      referer,
    })
  );
}

export function logEvent(event: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      time: new Date().toISOString(),
      ...event,
    })
  );
}

export function logError(error: unknown, context: Record<string, unknown> = {}): void {
  console.error(
    JSON.stringify({
      time: new Date().toISOString(),
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
    })
  );
}
