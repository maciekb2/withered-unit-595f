import { defineMiddleware } from 'astro:middleware';
import { getCollection } from 'astro:content';
import { httpMetrics, startObservability } from './server/observability';

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) return next();
  startObservability(() => getCollection('blog'));
  const start = performance.now();
  let status = 500;
  try { const response = await next(); status = response.status; return response; }
  finally {
    // Raw URLs, query strings, user agents, IPs and IDs never become labels.
    // Probe classification is informational, not a security or billing boundary.
    const agent = context.request.headers.get('user-agent') || '';
    httpMetrics.observe(context.url.pathname, context.request.method, status, (performance.now()-start)/1000,
      agent.startsWith('kube-probe/') || agent === 'pseudointelekt-internal-probe/1');
  }
});
