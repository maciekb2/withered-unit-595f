import type { APIRoute } from 'astro';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getPool, json } from '../../../server/postgres';
import { isPrivateGeneratorRequest } from '../../../server/generatorAuth';

export const prerender = false;
const allowedTypes = new Map([['image/png','.png'],['image/jpeg','.jpg'],['image/webp','.webp']]);

export const POST: APIRoute = async ({ request }) => {
  if (!await isPrivateGeneratorRequest(request)) return json({ error: 'Forbidden' }, 403);
  const form = await request.formData();
  const runId = String(form.get('runId') || '');
  const jobId = String(form.get('jobId') || '');
  const file = form.get('file');
  if (!/^[0-9a-f-]{36}$/i.test(runId) || !/^[0-9a-f-]{36}$/i.test(jobId) || !(file instanceof File)) {
    return json({ error: 'Invalid upload' }, 400);
  }
  const extension = allowedTypes.get(file.type);
  if (!extension || file.size < 10_000 || file.size > 12 * 1024 * 1024) return json({ error: 'Unsupported image' }, 400);
  const exists = await getPool().query('SELECT 1 FROM social_jobs WHERE id=$1 AND run_id=$2 AND status=$3', [jobId, runId, 'selected']);
  if (!exists.rowCount) return json({ error: 'Unknown run item' }, 404);
  const root = path.resolve(process.env.SOCIAL_MEDIA_DIR || '/data/social');
  const directory = path.join(root, 'weekly', runId);
  await mkdir(directory, { recursive: true });
  const destination = path.join(directory, `${jobId}-master${extension}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const validMagic = file.type === 'image/png'
    ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : file.type === 'image/jpeg'
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9
      : bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!validMagic) return json({ error: 'Image signature does not match content type' }, 400);
  await writeFile(destination, bytes, { mode: 0o640 });
  await getPool().query('UPDATE social_jobs SET master_image_path=$2,updated_at=now() WHERE id=$1', [jobId, destination]);
  return json({ ok: true, jobId });
};
