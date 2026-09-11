import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateArticleQuality, TARGET_ARTICLE_WORDS } from '../src/pipeline/validators/quality.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const blog = path.join(root, 'src/content/blog');
const dates = Array.from({ length: 11 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
const files = fs.readdirSync(blog).filter(file => dates.some(date => file.startsWith(`${date}-`)));
const canonicalTags = new Set(['geopolityka', 'technologia-i-cyber', 'europa-i-unia', 'gospodarka-i-energia', 'polityka-i-media']);

function readArticle(file) {
  const text = fs.readFileSync(path.join(blog, file), 'utf8');
  const match = text.match(/^---\n([\s\S]+?)\n---\n\n([\s\S]+)$/);
  assert.ok(match, `${file}: frontmatter and body`);
  const value = key => {
    const line = match[1].split('\n').find(line => line.startsWith(`${key}: `));
    assert.ok(line, `${file}: ${key}`);
    return JSON.parse(line.slice(key.length + 2));
  };
  return { value, content: match[2] };
}

test('September backfill has exactly one article per requested date and unique titles/images', () => {
  assert.equal(files.length, dates.length);
  const articles = files.map(readArticle);
  assert.deepEqual(articles.map(({ value }) => value('pubDate')).sort(), dates);
  for (const key of ['title', 'heroImage']) {
    assert.equal(new Set(articles.map(({ value }) => value(key))).size, dates.length, key);
  }
});

for (const date of dates) {
  test(`${date}: editorial guardrails and landscape PNG metadata`, () => {
    const matching = files.filter(file => file.startsWith(`${date}-`));
    assert.equal(matching.length, 1);
    const file = matching[0];
    const { value, content } = readArticle(file);
    const title = value('title');
    const description = value('description');
    assert.ok(title.length > 0 && title.length <= 100);
    assert.ok(description.length > 0 && description.length <= 200);
    assert.doesNotMatch(title + description, /[*#\[\]`]/);
    const source = new URL(value('sourceUrl'));
    assert.equal(source.protocol, 'https:');
    assert.equal(source.username + source.password, '');
    assert.doesNotMatch(source.hostname, /(^|\.)example\./);
    const tags = value('tags');
    assert.equal(tags.length, 1);
    assert.ok(canonicalTags.has(tags[0]));
    assert.equal(value('pubDate'), date);
    assert.match(content, /^## /);
    assert.doesNotMatch(content, /https?:\/\/|\bTODO\b|\bTBD\b/);
    assert.equal([...content.matchAll(/^## /gm)].length, 3);
    const quality = validateArticleQuality({ title, description, content }, { sections: [{}, {}, {}] });
    assert.deepEqual(quality.errors, []);
    assert.deepEqual(quality.warnings, []);
    assert.ok(quality.stats.words >= TARGET_ARTICLE_WORDS);
    const hero = value('heroImage');
    assert.equal(hero, `/blog-images/${file.replace(/\.md$/, '.png')}`);
    const image = fs.readFileSync(path.join(root, 'public', hero));
    assert.deepEqual(image.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.equal(image.toString('ascii', 12, 16), 'IHDR');
    assert.equal(image.readUInt32BE(16), 1536);
    assert.equal(image.readUInt32BE(20), 1024);
    assert.ok(image.length > 10_000);
  });
}
