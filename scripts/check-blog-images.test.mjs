import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkBlogImages } from './check-blog-images.mjs';

for (const scenario of ['present', 'missing', 'empty', 'directory', 'traversal', 'no-reference']) {
  test(`article image delivery gate: ${scenario}`, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pseudointelekt-images-'));
    const blog = path.join(root, 'blog');
    const assets = path.join(root, 'public');
    try {
      await fs.mkdir(blog); await fs.mkdir(assets);
      const reference = scenario === 'traversal' ? '/../outside.png' : '/hero.png';
      await fs.writeFile(path.join(blog, 'article.md'), scenario === 'no-reference' ? '---\ntitle: test\n---' : `---\nheroImage: "${reference}"\n---\nBody`);
      if (scenario === 'present') await fs.writeFile(path.join(assets, 'hero.png'), 'image');
      if (scenario === 'empty') await fs.writeFile(path.join(assets, 'hero.png'), '');
      if (scenario === 'directory') await fs.mkdir(path.join(assets, 'hero.png'));
      if (scenario === 'present') assert.equal(await checkBlogImages(assets, blog), 1);
      else await assert.rejects(checkBlogImages(assets, blog), /Missing article images|Invalid image path|No local article image/);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
}
