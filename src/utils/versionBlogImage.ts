import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Build-time cache identity: repaired/replaced assets must not reuse cached errors. */
export function versionBlogImage(image: string, publicRoot = 'public'): string {
  if (!image.startsWith('/blog-images/')) return image;
  const url = new URL(image, 'https://pseudointelekt.invalid');
  if (!url.pathname.startsWith('/blog-images/')) throw new Error('Invalid blog image path');
  const root = path.resolve(publicRoot);
  const target = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
  if (!target.startsWith(`${root}${path.sep}blog-images${path.sep}`)) throw new Error('Invalid blog image path');
  const digest = createHash('sha256').update(readFileSync(target)).digest('hex').slice(0, 16);
  url.searchParams.set('v', digest);
  return `${url.pathname}${url.search}${url.hash}`;
}
