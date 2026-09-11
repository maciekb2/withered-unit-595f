import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpMetrics, routeGroup } from './httpMetrics';

test('route labels are bounded and never contain private paths or query strings', () => {
  assert.equal(routeGroup('/blog/a-secret-title/'), 'article');
  assert.equal(routeGroup('/blog/2/'), 'archive');
  assert.equal(routeGroup('/api/contact'), 'contact_api');
  const metrics = new HttpMetrics();
  for (let i=0; i<1000; i++) metrics.observe('/api/secret-' + i, 'CUSTOM-' + i, 500, 0.2, false);
  const text = metrics.render();
  assert.doesNotMatch(text, /secret|CUSTOM/);
  assert.match(text, /route="other_api",method="OTHER",status="5xx",traffic="request"} 1000/);
  assert.equal(text.split('\n').filter(line => line.startsWith('pseudointelekt_http_requests_total')).length, 1);
});
test('histogram buckets are cumulative and distinguish probes from requests', () => {
  const metrics = new HttpMetrics();
  metrics.observe('/', 'GET', 200, 0.03, false);
  metrics.observe('/', 'GET', 503, 3, true);
  const text = metrics.render();
  assert.match(text, /traffic="request",le="0.025"} 0/);
  assert.match(text, /traffic="request",le="0.05"} 1/);
  assert.match(text, /traffic="probe",le="2.5"} 0/);
  assert.match(text, /traffic="probe",le="5"} 1/);
  assert.doesNotMatch(text, /NaN|undefined/);
});
