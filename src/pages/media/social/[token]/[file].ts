import type { APIRoute } from 'astro';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { getPool } from '../../../../server/postgres';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const token = params.token || '';
  const file = params.file || '';
  if (!/^[0-9a-f-]{36}$/i.test(token) || !/^[a-z0-9._-]{3,120}$/i.test(file)) return new Response('Not found', { status: 404 });
  const result = await getPool().query<{ path: string; expires_at: Date }>(
    'SELECT path, expires_at FROM social_assets WHERE public_token = $1 AND expires_at > now()', [token],
  );
  const asset = result.rows[0];
  if (!asset) return new Response('Not found', { status: 404 });
  const root = path.resolve(process.env.SOCIAL_MEDIA_DIR || '/data/social');
  const absolute = path.resolve(asset.path);
  if (!absolute.startsWith(`${root}${path.sep}`) || path.basename(absolute) !== file) return new Response('Not found', { status: 404 });
  try {
    const info = await stat(absolute);
    const stream = Readable.toWeb(createReadStream(absolute)) as ReadableStream;
    return new Response(stream, {
      headers: {
        'content-type': file.endsWith('.mp4') ? 'video/mp4' : 'image/png',
        'content-length': String(info.size),
        'cache-control': 'public, max-age=86400, immutable',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch { return new Response('Not found', { status: 404 }); }
};
