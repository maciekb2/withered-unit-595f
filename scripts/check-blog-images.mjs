import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Check references, not just files present in the build context: Flux may
// already have excluded an image before Docker or Astro sees the sources.
export async function checkBlogImages(assetRoot = 'public', blogDir = 'src/content/blog') {
const root = path.resolve(assetRoot);
let checked = 0;
const missing = [];
for (const file of await readdir(blogDir)) {
  if (!/\.mdx?$/.test(file)) continue;
  const text = await readFile(path.join(blogDir, file), 'utf8');
  const frontmatter = text.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] || '';
  const image = frontmatter.match(/^heroImage:\s*['"]?(\/[^'"\s]+)['"]?\s*$/m)?.[1];
  if (!image) continue;
  checked++;
  const target = path.resolve(root, `.${image}`);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error(`Invalid image path in ${file}`);
  const info = await stat(target).catch(() => null);
  if (!info?.isFile() || info.size === 0) missing.push(`${file}: ${image}`);
}
if (!checked) throw new Error('No local article image references checked');
if (missing.length) throw new Error(`Missing article images in ${root}:\n${missing.join('\n')}`);
return checked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = process.argv[2] || 'public';
  console.log(`Verified ${await checkBlogImages(root)} article image references in ${path.resolve(root)}`);
}
