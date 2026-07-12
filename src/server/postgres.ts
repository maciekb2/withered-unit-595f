import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for the self-hosted runtime');
  }
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return pool;
}

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export function slugFrom(params: Record<string, string | undefined>): string {
  const slug = (params.slug || '').trim();
  if (!slug || slug.length > 180 || !/^[a-z0-9][a-z0-9-]*$/i.test(slug)) {
    throw new Error('Invalid slug');
  }
  return slug;
}

export function sessionId(request: Request): string {
  const match = request.headers.get('cookie')?.match(/(?:^|; )pi_session=([^;]+)/);
  return match?.[1] || crypto.randomUUID();
}

export function withSession(response: Response, session: string): Response {
  if (response.headers.has('set-cookie')) return response;
  response.headers.set('set-cookie', `pi_session=${session}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`);
  return response;
}
