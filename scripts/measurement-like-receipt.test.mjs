import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
function harness(allowed = true) {
  const source=readFileSync(new URL('../src/layouts/BlogPost.astro',import.meta.url),'utf8');
  const a=source.indexOf("                        likeBtn?.addEventListener('click', async () => {");
  const b=source.indexOf("                        document.querySelectorAll('.post-nav a')",a);
  assert.ok(a>=0 && b>a);
  const events=[],requests=[],stored=[],pending=[];
  let click;
  const button={disabled:false,querySelector:()=>({textContent:''}),classList:{add(){},remove(){}},addEventListener(name,fn){if(name==='click')click=fn;}};
  const doc={documentElement:{dataset:{analyticsConsent:allowed?'granted':'denied'}},getElementById:()=>({textContent:''})};
  runInNewContext(source.slice(a,b),{likeBtn:button,currentSlug:'example',likeStorageKey:'liked-example',articleParams:{article_slug:'example'},
    document:doc,sessionStorage:{setItem:(...args)=>stored.push(args)},window:{pseudointelektTrack:(...args)=>events.push(args)},
    fetch:(...args)=>{requests.push(args);return new Promise(resolve=>pending.push(resolve));}});
  return {events,requests,stored,pending,button,doc,click};
}
test('loading does not like; repeated pending clicks send one request and one receipt',async()=>{
  const h=harness();assert.equal(h.requests.length,0);
  const first=h.click();await h.click();assert.equal(h.requests.length,1);
  h.pending[0]({ok:true,json:async()=>({likes:3})});await first;
  assert.equal(h.events.length,1);assert.equal(h.stored.length,1);assert.equal(h.button.disabled,true);
});
test('failed or malformed responses never count as a like',async()=>{
  for(const response of [{ok:false},{ok:true,json:async()=>({error:'failed'})}]){
    const h=harness();const click=h.click();h.pending[0](response);await click;
    assert.equal(h.events.length,0);assert.equal(h.stored.length,0);assert.equal(h.button.disabled,false);
  }
});
test('consent granted while a like is pending does not replay the earlier action',async()=>{
  const h=harness(false);const click=h.click();h.doc.documentElement.dataset.analyticsConsent='granted';
  h.pending[0]({ok:true,json:async()=>({likes:3})});await click;
  assert.equal(h.events.length,0);assert.equal(h.stored.length,1);
});
