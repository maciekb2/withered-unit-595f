import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assembleArticle } from './articleAssembler.js';

const article = {
  title: 'Polska flaga na kablu: cyberpożar po awariach',
  description: 'Państwo mówi "sprawdzam", gdy infrastruktura przestaje odpowiadać.',
  content: 'Treść redakcyjna bez powtórzeń. '.repeat(40),
  sourceUrl: 'https://example.com/source',
  tags: ['technologia-i-cyber'],
};

test('assembleArticle writes matching markdown and hero files with safe frontmatter', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pseudointelekt-assemble-'));
  const blogDir = path.join(root, 'blog');
  const publicDir = path.join(root, 'images');

  try {
    const result = await assembleArticle({
      article,
      heroImage: Buffer.from('image-bytes'),
      blogDir,
      publicDir,
      date: '2026-07-13',
    });
    const markdown = await fs.readFile(result.postPath, 'utf8');

    assert.match(path.basename(result.postPath), /^2026-07-13-.*\.md$/);
    assert.match(path.basename(result.imagePath), /^2026-07-13-.*\.png$/);
    assert.match(markdown, /description: "Państwo mówi \\"sprawdzam\\"/);
    assert.match(markdown, /sourceUrl: "https:\/\/example\.com\/source"/);
    assert.match(markdown, /tags: \["technologia-i-cyber"\]/);
    assert.deepEqual(await fs.readFile(result.imagePath), Buffer.from('image-bytes'));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('assembleArticle rejects invalid content before writing article assets', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pseudointelekt-invalid-'));
  const blogDir = path.join(root, 'blog');
  const publicDir = path.join(root, 'images');

  try {
    await assert.rejects(
      assembleArticle({
        article: { ...article, content: 'za krótko' },
        heroImage: Buffer.from('image-bytes'),
        blogDir,
        publicDir,
      }),
      /Final JSON validation failed/,
    );
    await assert.rejects(fs.access(blogDir));
    await assert.rejects(fs.access(publicDir));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('assembleArticle removes an orphan hero when markdown persistence fails', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pseudointelekt-rollback-'));
  const blogDir = path.join(root, 'blog');
  const publicDir = path.join(root, 'images');
  await fs.mkdir(blogDir, { recursive: true });
  await fs.mkdir(publicDir, { recursive: true });
  const expectedPost = path.join(blogDir, '2026-07-13-polska-flaga-na-kablu-cyberpoar-po-awariach.md');
  await fs.mkdir(expectedPost);

  try {
    await assert.rejects(assembleArticle({
      article,
      heroImage: Buffer.from('image-bytes'),
      blogDir,
      publicDir,
      date: '2026-07-13',
    }));
    assert.deepEqual(await fs.readdir(publicDir), []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('assembleArticle never overwrites an existing article or image', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pseudointelekt-collision-'));
  const options = { article, heroImage: Buffer.from('original'), blogDir: path.join(root, 'blog'), publicDir: path.join(root, 'images'), date: '2026-09-01' };
  try {
    const result = await assembleArticle(options);
    const originalPost = await fs.readFile(result.postPath, 'utf8');
    await assert.rejects(assembleArticle({ ...options, heroImage: Buffer.from('replacement') }), /EEXIST/);
    assert.equal(await fs.readFile(result.imagePath, 'utf8'), 'original');
    assert.equal(await fs.readFile(result.postPath, 'utf8'), originalPost);
    // Even if the old image is absent, the article is preserved and the new orphan removed.
    await fs.rm(result.imagePath);
    await assert.rejects(assembleArticle(options), /EEXIST/);
    assert.equal(await fs.readFile(result.postPath, 'utf8'), originalPost);
    assert.deepEqual(await fs.readdir(options.publicDir), []);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('assembleArticle rejects unsafe dates and empty images before creating directories', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pseudointelekt-unsafe-'));
  const options = { article, heroImage: Buffer.from('image'), blogDir: path.join(root, 'blog'), publicDir: path.join(root, 'images') };
  try {
    await assert.rejects(assembleArticle({ ...options, date: '../outside' }), /date/i);
    await assert.rejects(assembleArticle({ ...options, heroImage: Buffer.alloc(0) }), /empty/);
    assert.deepEqual(await fs.readdir(root), []);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
