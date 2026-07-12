export function generationCorsHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get('Origin');
  const requestOrigin = new URL(request.url).origin;
  if (origin && origin !== requestOrigin) return headers;
  headers.set('Access-Control-Allow-Origin', origin || requestOrigin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, CF-Access-JWT-Assertion');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Max-Age', '600');
  headers.set('Vary', 'Origin');
  return headers;
}

export function withGenerationCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of generationCorsHeaders(request)) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
