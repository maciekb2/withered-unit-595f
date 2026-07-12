import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import { logError, logEvent } from './logger';

interface AccessPayload {
  email?: string;
  sub?: string;
  aud?: string | string[];
}

export interface CloudflareAccessIdentity {
  email?: string;
  sub?: string;
  aud?: string;
  method?: 'user' | 'service-token' | 'local-dev' | 'unknown';
  serviceTokenClientIdSuffix?: string;
}

export interface CloudflareAccessResult {
  response?: Response;
  identity?: CloudflareAccessIdentity;
}

const GENERATION_PATHS = new Set([
  '/generuj',
  '/generuj.html',
  '/api/generate-stream',
  '/api/update-prompt',
  '/api/get-prompt',
  '/api/client-log',
  '/api/sentry-test',
]);

let jwksCache: JWTVerifyGetKey | undefined;
let jwksIssuer: string | undefined;

export function isGenerationPath(pathname: string): boolean {
  return GENERATION_PATHS.has(pathname);
}

export function setCloudflareAccessJwksForTesting(
  jwks: JWTVerifyGetKey | undefined,
  issuer?: string,
): void {
  jwksCache = jwks;
  jwksIssuer = issuer;
}

function normalizeIssuer(teamDomain: string): string {
  const trimmed = teamDomain.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
}

function parseAllowedEmails(value?: string): Set<string> {
  return new Set(
    (value || '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function parseAudiences(value?: string): string[] {
  return (value || '')
    .split(',')
    .map(audience => audience.trim())
    .filter(Boolean);
}

function isLocalDevelopmentRequest(request: Request): boolean {
  const url = new URL(request.url);
  return (
    process.env.NODE_ENV !== 'production' &&
    ['localhost', '127.0.0.1', '::1'].includes(url.hostname) &&
    !request.headers.has('cf-ray')
  );
}

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
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function forbidden(request: Request, message = 'Forbidden'): Response {
  return new Response(message, {
    status: 403,
    headers: new Headers({
      'Content-Type': 'text/plain; charset=utf-8',
      ...Object.fromEntries(generationCorsHeaders(request)),
    }),
  });
}

export async function requireCloudflareAccess(
  request: Request,
  env: Env,
): Promise<CloudflareAccessResult> {
  if (isLocalDevelopmentRequest(request)) {
    return { identity: { email: 'local-dev', sub: 'local-dev', method: 'local-dev' } };
  }

  const issuer = normalizeIssuer(env.CF_ACCESS_TEAM_DOMAIN || '');
  const audiences = parseAudiences(env.CF_ACCESS_AUD);

  if (!issuer || audiences.length === 0) {
    logEvent({ type: 'access-auth-misconfigured' });
    return {
      response: forbidden(request, 'Cloudflare Access is not configured for this endpoint'),
    };
  }

  const token = request.headers.get('cf-access-jwt-assertion');
  const serviceTokenClientId = request.headers.get('cf-access-client-id') || '';
  if (!token) {
    logEvent({ type: 'access-auth-missing-token' });
    return { response: forbidden(request, 'Missing Cloudflare Access token') };
  }

  try {
    if (!jwksCache || jwksIssuer !== issuer) {
      jwksCache = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
      jwksIssuer = issuer;
    }

    const { payload } = await jwtVerify(token, jwksCache, {
      issuer,
      audience: audiences,
    });

    const accessPayload = payload as AccessPayload;
    const email = accessPayload.email?.toLowerCase();
    const aud = Array.isArray(accessPayload.aud)
      ? accessPayload.aud.join(',')
      : accessPayload.aud;
    const allowedEmails = parseAllowedEmails(env.CF_ACCESS_ALLOWED_EMAILS);

    if (
      allowedEmails.size > 0 &&
      !serviceTokenClientId &&
      (!email || !allowedEmails.has(email))
    ) {
      logEvent({
        type: 'access-auth-email-denied',
        email: email || 'unknown',
      });
      return { response: forbidden(request) };
    }

    const method: CloudflareAccessIdentity['method'] = email
      ? 'user'
      : serviceTokenClientId
        ? 'service-token'
        : 'unknown';
    const identity = {
      email: email || 'unknown',
      sub: accessPayload.sub || 'unknown',
      aud: aud || 'unknown',
      method,
      serviceTokenClientIdSuffix: serviceTokenClientId
        ? serviceTokenClientId.slice(-12)
        : undefined,
    };
    logEvent({
      type: 'access-auth-ok',
      email: identity.email,
      sub: identity.sub,
      aud: identity.aud,
      method: identity.method,
      serviceTokenClientIdSuffix: identity.serviceTokenClientIdSuffix,
    });
    return { identity };
  } catch (err) {
    logError(err, { type: 'access-auth-invalid-token' });
    return { response: forbidden(request, 'Invalid Cloudflare Access token') };
  }
}
