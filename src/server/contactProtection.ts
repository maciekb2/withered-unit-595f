import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

export const MAX_CONTACT_BYTES = 65536;
export function sameOrigin(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  return origin !== null && origin === new URL(request.url).origin;
}
export class ContactRequestError extends Error {
  status: number;
  constructor(status: number) { super('Invalid contact request'); this.status = status; }
}
export async function readContactForm(request: Request): Promise<FormData> {
  const type = request.headers.get('content-type') || '';
  if (!/^(application\/x-www-form-urlencoded|multipart\/form-data)(;|$)/i.test(type)) throw new ContactRequestError(415);
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_CONTACT_BYTES)) throw new ContactRequestError(413);
  const reader = request.body?.getReader();
  if (!reader) throw new ContactRequestError(400);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > MAX_CONTACT_BYTES) throw new ContactRequestError(413);
          chunks.push(value);
        }
        const body = new Uint8Array(bytes);
        let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
        return await new Request(request.url, { method: 'POST', headers: { 'content-type': type }, body }).formData();
      })(),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new ContactRequestError(408)), 5000); }),
    ]);
  } finally {
    clearTimeout(timeout);
    void reader.cancel().catch(() => {});
  }
}
// Enable only behind the private edge that overwrites CF-Connecting-IP.
export function contactClientKey(request: Request, address: string): string {
  const edgeIp = request.headers.get('cf-connecting-ip') || '';
  const trusted = process.env.CONTACT_TRUST_CF_IP === 'true';
  const ip = trusted && isIP(edgeIp) ? edgeIp : (isIP(address) ? address : 'unknown');
  return hashContactKey(ip);
}
export function hashContactKey(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
