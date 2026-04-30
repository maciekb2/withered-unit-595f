import { createRemoteJWKSet, jwtVerify } from 'jose';
import { logError, logEvent } from './logger';

interface AccessPayload {
  email?: string;
  sub?: string;
}

const GENERATION_PATHS = new Set([
  '/generuj',
  '/generuj.html',
  '/api/generate-stream',
  '/api/update-prompt',
  '/api/get-prompt',
  '/api/client-log',
]);

let jwksCache: ReturnType<typeof createRemoteJWKSet> | undefined;
let jwksIssuer: string | undefined;

export function isGenerationPath(pathname: string): boolean {
  return GENERATION_PATHS.has(pathname);
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
    ['localhost', '127.0.0.1', '::1'].includes(url.hostname) &&
    !request.headers.has('cf-ray')
  );
}

function forbidden(message = 'Forbidden'): Response {
  return new Response(message, {
    status: 403,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export async function requireCloudflareAccess(
  request: Request,
  env: Env,
): Promise<Response | null> {
  if (isLocalDevelopmentRequest(request)) {
    return null;
  }

  const issuer = normalizeIssuer(env.CF_ACCESS_TEAM_DOMAIN || '');
  const audiences = parseAudiences(env.CF_ACCESS_AUD);

  if (!issuer || audiences.length === 0) {
    logEvent({ type: 'access-auth-misconfigured' });
    return forbidden('Cloudflare Access is not configured for this endpoint');
  }

  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) {
    logEvent({ type: 'access-auth-missing-token' });
    return forbidden('Missing Cloudflare Access token');
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
    const allowedEmails = parseAllowedEmails(env.CF_ACCESS_ALLOWED_EMAILS);

    if (allowedEmails.size > 0 && (!email || !allowedEmails.has(email))) {
      logEvent({
        type: 'access-auth-email-denied',
        email: email || 'unknown',
      });
      return forbidden();
    }

    logEvent({
      type: 'access-auth-ok',
      email: email || 'unknown',
      sub: accessPayload.sub || 'unknown',
    });
    return null;
  } catch (err) {
    logError(err, { type: 'access-auth-invalid-token' });
    return forbidden('Invalid Cloudflare Access token');
  }
}
