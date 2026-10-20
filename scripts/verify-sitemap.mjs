import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { parse } from 'node-html-parser';

async function files(root) {
  const result=[];
  for(const entry of await readdir(root,{withFileTypes:true})) {
    const file=path.join(root,entry.name);
    if(entry.isDirectory()) result.push(...await files(file)); else result.push(file);
  }
  return result;
}
const root=path.resolve('dist/client');
const source=(await files('src/content/blog')).filter(file=>/\.(md|mdx)$/.test(file));
const parser=new XMLParser();
const index=parser.parse(await readFile(path.join(root,'sitemap-index.xml'),'utf8'));
const maps=[index.sitemapindex.sitemap].flat().map(item=>new URL(item.loc));
const urls=new Set();
for(const map of maps) {
  assert.equal(map.origin,'https://pseudointelekt.pl');
  assert.match(map.pathname,/^\/sitemap-\d+\.xml$/);
  const sitemap=parser.parse(await readFile(path.join(root,path.basename(map.pathname)),'utf8'));
  for(const entry of [sitemap.urlset.url].flat()) urls.add(entry.loc);
}
let articleCount=0;
for(const file of (await files(root)).filter(file=>file.endsWith('.html') && file.includes(path.sep+'blog'+path.sep))) {
  const page=parse(await readFile(file,'utf8'));
  if(!page.querySelector('[data-article-page]')) continue;
  articleCount++;
  const canonical=page.querySelector('link[rel=canonical]')?.getAttribute('href');
  assert.ok(canonical,`${file}: missing canonical`);
  assert.ok(urls.has(canonical),`${file}: article missing from sitemap: ${canonical}`);
  assert.ok(!page.querySelector('meta[name=robots]')?.getAttribute('content')?.includes('noindex'),`${file}: indexable article marked noindex`);
}
assert.equal(articleCount,source.length,'Every committed article must render and appear in the sitemap');
assert.ok(articleCount>0,'No articles checked');
console.log(`PASS sitemap: ${articleCount} committed articles rendered, canonical and included; ${urls.size} URLs total`);
