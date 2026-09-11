import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { versionBlogImage } from './versionBlogImage';

test('blog image URLs are stable for identical bytes and change after replacement', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pseudointelekt-image-version-'));
  try {
    await fs.mkdir(path.join(root, 'blog-images'));
    const target = path.join(root, 'blog-images', 'hero.png');
    await fs.writeFile(target, 'first');
    const first = versionBlogImage('/blog-images/hero.png', root);
    assert.match(first, /^\/blog-images\/hero.png\?v=[a-f0-9]{16}$/);
    assert.equal(versionBlogImage(first, root), first);
    await fs.writeFile(target, 'second');
    assert.notEqual(versionBlogImage('/blog-images/hero.png', root), first);
    assert.match(versionBlogImage('/blog-images/hero.png?size=large#hero', root), /\?size=large&v=[a-f0-9]{16}#hero$/);
    assert.throws(() => versionBlogImage('/blog-images/../outside.png', root), /Invalid/);
    assert.throws(() => versionBlogImage('/blog-images/%2e%2e%2foutside.png', root), /Invalid/);
    assert.throws(() => versionBlogImage('/blog-images/missing.png', root), /ENOENT/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('non-blog assets and external images keep their existing URL', () => {
  for (const image of ['/about-editorial.webp', 'https://example.org/hero.png']) assert.equal(versionBlogImage(image), image);
});
