import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/components/BaseHead.astro', import.meta.url), 'utf8');
function extract(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a);
  return source.slice(a, b);
}
test('stored grants require the current version, actual boolean, finite nonfuture timestamp and maximum age', () => {
  const read = value => runInNewContext(extract('  function readConsent()', '\n  function saveConsent') + '\nreadConsent()', {
    localStorage: { getItem: () => JSON.stringify(value) }, consentKey: 'test', consentVersion: 2,
  });
  const now = Date.now();
  const record = { version: 2, analytics: true, updatedAt: new Date(now - 1000).toISOString() };
  assert.equal(read(record).analytics, true);
  for (const bad of [{...record,analytics:'true'}, {...record,version:1}, {...record,updatedAt:'bad'},
    {...record,updatedAt:new Date(now+60000).toISOString()}, {...record,updatedAt:new Date(now-181*86400000).toISOString()}]) {
    assert.equal(read(bad), null);
  }
});
test('withdrawal disables the Google runtime, clears cookies and signals the article observer', () => {
  const calls=[], events=[];
  const context={ga4Id:'G-LOCAL123', analyticsGranted:true,
    document:{documentElement:{dataset:{}},cookie:'_ga=test; _ga_LOCAL=test'},
    window:{gtag:(...args)=>calls.push(args),dispatchEvent:event=>events.push(event.type)},
    loadGa4:()=>assert.fail('withdrawal must not load Google'),Event:class {constructor(type){this.type=type;}}};
  runInNewContext(extract('  function applyConsent(consent)', "  window.addEventListener('storage'")+'\napplyConsent({analytics:false});',context);
  assert.equal(context.analyticsGranted,false);
  assert.equal(context.window['ga-disable-G-LOCAL123'],true);
  assert.equal(context.document.documentElement.dataset.analyticsConsent,'denied');
  assert.deepEqual(events,['pseudointelekt:analytics-consent']);
  assert.equal(calls[0][2].analytics_storage,'denied');
  assert.match(context.document.cookie,/Max-Age=0/);
});
test('custom events cannot leak URL queries, fragments or raw referrers and tag failure is harmless', () => {
  const calls=[];
  const context={analyticsGranted:false,hasGa4:true,
    document:{body:{dataset:{pageSection:'article'}}},location:{origin:'https://pseudointelekt.pl',pathname:'/blog/example/',search:'?token=private',hash:'#private'},
    safeReferrer:()=>'',window:{gtag:(...args)=>calls.push(args)}};
  runInNewContext(extract('  window.pseudointelektTrack =', "  window.gtag('consent', 'default'"),context);
  context.window.pseudointelektTrack('article_read_start');
  assert.equal(calls.length,0);
  context.analyticsGranted=true;
  context.window.pseudointelektTrack('article_read_start');
  assert.equal(calls.length,1);
  assert.equal(calls[0][2].measurement_schema,'private_sites_v1');
  assert.doesNotMatch(JSON.stringify(calls),/token=|#private/);
  context.window.gtag=()=>{throw new Error('blocked');};
  assert.doesNotThrow(()=>context.window.pseudointelektTrack('article_read_start'));
});
