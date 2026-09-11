import { createServer } from 'node:http';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { collectBusiness, createMetricsPool, metric, metricTypes } from './businessMetrics';
import { HttpMetrics } from './httpMetrics';

type Article = { id: string; data: { pubDate: Date; heroImage?: string } };
export const httpMetrics = new HttpMetrics();
let started = false;
const MAX_PROBE_BYTES = 512 * 1024;

export async function probe(url: URL, method = 'GET', expected = '<h1', headers: Record<string, string> = {}): Promise<{ ok: number; seconds: number; status: number }> {
  const start = performance.now();
  let status = 0;
  try {
    const response = await fetch(url, { method, redirect: 'manual', headers: { ...headers, 'user-agent': 'pseudointelekt-internal-probe/1' }, signal: AbortSignal.timeout(3000) });
    status = response.status;
    if (status !== 200) { await response.body?.cancel(); return { ok: 0, seconds: (performance.now()-start)/1000, status }; }
    if (method === 'HEAD') return { ok: Number((response.headers.get('content-type') || '').startsWith('image/') && Number(response.headers.get('content-length')) > 0), seconds: (performance.now()-start)/1000, status };
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Missing body');
    let text = '', bytes = 0;
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > MAX_PROBE_BYTES) throw new Error('Oversized probe body');
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally { void reader.cancel().catch(() => {}); }
    return { ok: Number(text.includes(expected)), seconds: (performance.now()-start)/1000, status };
  } catch { return { ok: 0, seconds: (performance.now()-start)/1000, status }; }
}

// No public Astro route. This opt-in listener is reached only through a private
// ClusterIP and an ingress policy restricted to the monitoring namespace.
export function startObservability(getArticles: () => Promise<Article[]>): void {
  const port = Number(process.env.METRICS_PORT || 0);
  if (!port || started) return;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    started = true; console.error('Private metrics port is invalid'); return;
  }
  started = true;
  const eventLoop = monitorEventLoopDelay({ resolution: 20 }); eventLoop.enable();
  const pool = createMetricsPool(process.env.DATABASE_URL);
  let snapshot = metric('collection_last_success_timestamp_seconds', 0);
  let collecting = false;
  let rotatingArticle = 0;
  const lastProbeFailure = new Map<string, number>();
  const collect = async () => {
    if (collecting) return;
    collecting = true;
    let output = '';
    try {
      output += await collectBusiness(pool);
      const articles = (await getArticles()).filter(post => post.data.pubDate.getTime() <= Date.now()).sort((a,b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
      output += metric('articles_published', articles.length);
      output += metric('article_latest_timestamp_seconds', articles[0] ? articles[0].data.pubDate.getTime()/1000 : 0);
      output += metric('articles_published_7d', articles.filter(post => Date.now()-post.data.pubDate.getTime() <= 7*86400000).length);
      const targets: Array<{ name: string; path: string; method?: string; expected?: string }> = [
        { name:'home',path:'/' }, { name:'archive',path:'/blog/' }, { name:'topics',path:'/tematy/' },
        { name:'contact',path:'/contact/' }, { name:'health',path:'/api/health',expected:'"ok":true' },
        { name:'rss',path:'/rss.xml',expected:'<rss' },
      ];
      const latest = articles[0], sampled = articles[rotatingArticle++ % Math.max(1, articles.length)];
      if (latest) targets.push({ name:'latest_article',path:`/blog/${latest.id}/` });
      if (latest?.data.heroImage?.startsWith('/blog-images/')) targets.push({ name:'latest_image',path:latest.data.heroImage,method:'HEAD' });
      else output += metric('probe_success', 0, 'route="latest_image"');
      if (sampled) {
        targets.push({ name:'sampled_article',path:`/blog/${sampled.id}/` });
        if (sampled.data.heroImage?.startsWith('/blog-images/')) targets.push({ name:'sampled_image',path:sampled.data.heroImage,method:'HEAD' });
        else output += metric('probe_success', 0, 'route="sampled_image"');
      } else output += metric('probe_success', 0, 'route="latest_article"');
      // Two bounded requests at a time, once a minute; never submit a form,
      // increment engagement explicitly, generate content or call a provider.
      const base = new URL(process.env.PROBE_BASE_URL || `http://127.0.0.1:${Number(process.env.PORT || 3000)}`);
      for (let i = 0; i < targets.length; i += 2) {
        const rows = await Promise.all(targets.slice(i, i+2).map(async target => ({ target, result: await probe(new URL(target.path, base), target.method, target.expected) })));
        for (const { target, result } of rows) {
          if (!result.ok) lastProbeFailure.set(target.name, Date.now()/1000);
          output += metric('probe_success', result.ok, `route="${target.name}"`) + metric('probe_duration_seconds', result.seconds, `route="${target.name}"`) + metric('probe_status_code', result.status, `route="${target.name}"`) + metric('probe_last_failure_timestamp_seconds', lastProbeFailure.get(target.name) || 0, `route="${target.name}"`);
        }
      }
      if (process.env.PROBE_GATEWAY_URL) {
        const result = await probe(new URL(process.env.PROBE_GATEWAY_URL), 'GET', '<h1', { Host: 'pseudointelekt.pl' });
        output += metric('probe_success', result.ok, 'route="gateway_home"') + metric('probe_duration_seconds', result.seconds, 'route="gateway_home"');
      }
      output += metric('event_loop_delay_p99_seconds', Number.isFinite(eventLoop.percentile(99)) ? eventLoop.percentile(99)/1e9 : 0);
      eventLoop.reset();
      output += metric('collection_last_success_timestamp_seconds', Date.now()/1000);
      snapshot = output;
    } catch { /* Keep last snapshot; collection age alerts expose a stalled collector. */ }
    finally { collecting = false; }
  };
  const server = createServer((request, response) => {
    if (request.url !== '/metrics' || request.method !== 'GET') { response.writeHead(404); response.end(); return; }
    const memory = process.memoryUsage(), cpu = process.cpuUsage();
    response.writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8', 'cache-control': 'no-store' });
    response.end(metricTypes() + httpMetrics.render() + snapshot +
      metric('process_resident_memory_bytes', memory.rss) + metric('process_heap_used_bytes', memory.heapUsed) +
      metric('process_cpu_seconds_total', (cpu.user+cpu.system)/1e6) + metric('process_uptime_seconds', process.uptime()));
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000; server.maxConnections = 8;
  server.on('error', () => { console.error('Private metrics listener unavailable'); });
  server.listen(port, process.env.METRICS_HOST || '0.0.0.0');
  server.unref();
  const timer = setInterval(() => { void collect(); }, 60000); timer.unref();
  // The first readiness request initializes middleware after the app listener exists.
  const initial = setTimeout(() => { void collect(); }, 1000); initial.unref();
}
