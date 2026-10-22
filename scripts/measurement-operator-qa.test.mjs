import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../src/components/BaseHead.astro',import.meta.url),'utf8');
const declaration=source.slice(source.indexOf('  const hasGa4 ='),source.indexOf('  window.dataLayer ='));
const loader=source.slice(source.indexOf('  function loadGa4()'),source.indexOf('  function createButton('));
function fixture(url) {
 const parsed=new URL(url),calls=[],scripts=[];let queryReads=0;
 const location={protocol:parsed.protocol,hostname:parsed.hostname,origin:parsed.origin,pathname:parsed.pathname,
  get search(){queryReads++;return parsed.search;}};
 const context={ga4Id:'G-WTSC0BFN20',location,URLSearchParams,
  document:{querySelector:()=>scripts.length?scripts[0]:null,createElement:()=>({dataset:{}}),head:{appendChild:s=>scripts.push(s)}},
  window:{gtag:(...args)=>calls.push(args)},safeReferrer:()=>''};
 runInNewContext(declaration+loader+'\nthis.load=loadGa4;this.grant=()=>{analyticsGranted=true;};',context);
 return {context,calls,scripts,queryReads:()=>queryReads,config:()=>calls.find(x=>x[0]==='config')?.[2]};
}
test('explicit operator QA waits for consent and sends only sanitized location',()=>{
 const f=fixture('https://pseudointelekt.pl/blog/example/?measurement_test=1&token=private#secret');
 f.context.load();assert.equal(f.queryReads(),0);assert.equal(f.scripts.length,0);assert.equal(f.calls.length,0);
 f.context.grant();f.context.load();assert.equal(f.scripts.length,1);assert.equal(f.config().debug_mode,true);
 assert.equal(f.config().page_location,'https://pseudointelekt.pl/blog/example/');
 assert.doesNotMatch(JSON.stringify(f.calls),/measurement_test|token|private|#secret/);
 f.context.load();assert.equal(f.queryReads(),1);assert.equal(f.scripts.length,1);
});
test('ordinary or nonexact flags remain ordinary, including a fresh document after QA',()=>{
 for(const query of ['', '?measurement_test=0','?measurement_test=true','?measurement_test=1x','?measurement_test']) {
  const f=fixture('https://pseudointelekt.pl/blog/example/'+query);f.context.grant();f.context.load();
  assert.equal(f.scripts.length,1);assert.ok(!Object.hasOwn(f.config(),'debug_mode'));
 }
 const qa=fixture('https://www.pseudointelekt.pl/?measurement_test=1');qa.context.grant();qa.context.load();assert.equal(qa.config().debug_mode,true);
 const ordinary=fixture('https://www.pseudointelekt.pl/');ordinary.context.grant();ordinary.context.load();assert.ok(!Object.hasOwn(ordinary.config(),'debug_mode'));
});
test('production Google is refused on DEV, HTTP and lookalike origins even with consent and QA',()=>{
 for(const origin of ['http://127.0.0.1:18205','http://pseudointelekt.pl','https://preview.pseudointelekt.pl','https://pseudointelekt.pl.evil.test']) {
  const f=fixture(origin+'/?measurement_test=1');f.context.grant();f.context.load();
  assert.equal(f.scripts.length,0);assert.equal(f.calls.length,0);assert.equal(f.queryReads(),0);
 }
});
