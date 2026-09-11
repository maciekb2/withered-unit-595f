import assert from 'node:assert/strict';
import { parse } from 'node-html-parser';
import { XMLParser } from 'fast-xml-parser';

// Read-only public acceptance. No likes, views, contact submissions or generation.
const base = new URL(process.argv[2] || 'http://127.0.0.1:3100');
const delay = base.hostname === '127.0.0.1' || base.hostname === 'localhost' ? 0 : 1100;
let requests = 0;
async function get(path, expected = 200, method = 'GET') {
  if (delay) await new Promise(resolve => setTimeout(resolve, delay));
  const response = await fetch(new URL(path, base), { method, redirect: 'manual', signal: AbortSignal.timeout(30000) });
  requests++;
  assert.equal(response.status, expected, `${method} ${path}`);
  return response;
}
for (const route of ['/', '/blog/', '/blog/2/', '/tematy/', '/about/', '/contact/', '/privacy/', ...['geopolityka', 'technologia-i-cyber', 'europa-i-unia', 'gospodarka-i-energia', 'polityka-i-media'].map(topic => `/tematy/${topic}/`)]) {
  const html = parse(await (await get(route)).text());
  assert.equal(html.querySelector('html')?.getAttribute('lang'), 'pl', route);
  assert.ok(html.querySelector('h1'), `Missing H1: ${route}`);
}
const xml = new XMLParser().parse(await (await get('/rss.xml')).text());
const items = [].concat(xml.rss?.channel?.item || []);
assert.ok(items.length > 0, 'RSS has no articles');
for (const [index, item] of items.entries()) {
  const pathname = new URL(item.link).pathname;
  const html = parse(await (await get(pathname)).text());
  assert.equal(html.querySelector('h1')?.textContent.trim(), item.title.trim(), pathname);
  const image = html.querySelector('img[src^="/blog-images/"]')?.getAttribute('src');
  assert.ok(image, `Missing article image: ${pathname}`);
  assert.match(image, /[?&]v=[a-f0-9]{16}/, `Unversioned article image: ${pathname}`);
  const asset = await get(image, 200, 'HEAD');
  assert.match(asset.headers.get('content-type') || '', /^image\//, image);
  assert.ok(Number(asset.headers.get('content-length')) > 0, image);
  if ((index + 1) % 25 === 0) console.log(`Verified ${index + 1}/${items.length} articles and images`);
}
for (const route of ['/robots.txt', '/sitemap-index.xml', '/sitemap-0.xml']) await get(route);
await get('/blog/this-article-does-not-exist/', 404);
const health = await (await get('/api/health')).json();
assert.equal(health.ok, true);
assert.equal(health.runtime, 'node');
console.log(`PASS: ${items.length} articles/images, navigation, topics, SEO, 404 and health (${requests} requests)`);
