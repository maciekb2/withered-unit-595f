import assert from 'node:assert/strict';
import test from 'node:test';
import { articleMeasurement } from './articleMeasurement.js';

function harness() {
  const events: Array<{name: string; extra?: Record<string, number>}> = [];
  const sample = articleMeasurement((name, extra) => events.push({name, extra}));
  return { events, sample };
}
test('a grant made on the current article starts measurement without replaying earlier scroll', () => {
  const h = harness();
  h.sample({now:0,allowed:false,visible:true,progress:95,scrolled:true});
  h.sample({now:60000,allowed:true,visible:true,progress:95});
  assert.deepEqual(h.events.map(e=>e.name), ['article_read_start']);
  h.sample({now:90000,allowed:true,visible:true,progress:95});
  assert.deepEqual(h.events.map(e=>e.name), ['article_read_start']);
});
test('completion needs thirty seconds of visible article content and ninety percent article progress', () => {
  const h=harness();
  h.sample({now:0,allowed:true,visible:true,progress:10});
  h.sample({now:1000,allowed:true,visible:true,progress:95,scrolled:true});
  assert.equal(h.events.filter(e=>e.name==='article_read_complete').length,0);
  h.sample({now:30000,allowed:true,visible:true,progress:95});
  h.sample({now:60000,allowed:true,visible:true,progress:95,scrolled:true});
  assert.equal(h.events.filter(e=>e.name==='article_read_complete').length,1);
  assert.deepEqual(h.events.filter(e=>e.name==='article_scroll_depth').map(e=>e.extra?.scroll_percent),[25,50,75,90]);
});
test('hidden or withdrawn intervals cannot count towards completion', () => {
  const h=harness();
  h.sample({now:0,allowed:true,visible:true,progress:10});
  h.sample({now:10000,allowed:true,visible:true,progress:95,scrolled:true});
  h.sample({now:11000,allowed:true,visible:false,progress:95});
  h.sample({now:90000,allowed:true,visible:true,progress:95});
  assert.equal(h.events.filter(e=>e.name==='article_read_complete').length,0);
  h.sample({now:91000,allowed:false,visible:true,progress:95});
  h.sample({now:200000,allowed:false,visible:true,progress:95,scrolled:true});
  const count=h.events.length;
  h.sample({now:210000,allowed:true,visible:true,progress:95});
  assert.equal(h.events.length,count);
});
test('an article that fits entirely in the viewport can complete after visible dwell time', () => {
  const h=harness();
  h.sample({now:0,allowed:true,visible:true,progress:100,fullyVisible:true});
  h.sample({now:30000,allowed:true,visible:true,progress:100,fullyVisible:true});
  assert.equal(h.events.filter(e=>e.name==='article_read_complete').length,1);
});
