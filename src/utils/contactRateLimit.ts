import { logEvent } from './logger';

export const CONTACT_LIMITS = {
  maxNameLength: 120,
  maxEmailLength: 254,
  maxMessageLength: 4000,
  sessionWindowSeconds: 10 * 60,
  sessionMax: 3,
  ipWindowSeconds: 60 * 60,
  ipMax: 10,
} as const;

export async function shortHash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .slice(0, 12)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export async function incrementRateLimit(
  namespace: KVNamespace,
  key: string,
  limit: number,
  ttlSeconds: number,
): Promise<boolean> {
  const raw = await namespace.get(key);
  const current = raw ? Number.parseInt(raw, 10) || 0 : 0;
  if (current >= limit) return false;
  await namespace.put(key, String(current + 1), {
    expirationTtl: ttlSeconds,
  });
  return true;
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function checkContactRateLimit(
  request: Request,
  env: Pick<Env, 'pseudointelekt_contact_form'>,
  sessionId: string,
): Promise<Response | null> {
  const [sessionHash, ipHash] = await Promise.all([
    shortHash(sessionId),
    shortHash(getClientIp(request)),
  ]);

  const allowedBySession = await incrementRateLimit(
    env.pseudointelekt_contact_form,
    `rate:contact:session:${sessionHash}`,
    CONTACT_LIMITS.sessionMax,
    CONTACT_LIMITS.sessionWindowSeconds,
  );

  if (!allowedBySession) {
    logEvent({ type: 'contact-rate-limit-session', sessionHash });
    return jsonResponse({ message: 'Too many messages. Try again later.' }, 429);
  }

  const allowedByIp = await incrementRateLimit(
    env.pseudointelekt_contact_form,
    `rate:contact:ip:${ipHash}`,
    CONTACT_LIMITS.ipMax,
    CONTACT_LIMITS.ipWindowSeconds,
  );

  if (!allowedByIp) {
    logEvent({ type: 'contact-rate-limit-ip', ipHash });
    return jsonResponse({ message: 'Too many messages. Try again later.' }, 429);
  }

  return null;
}
