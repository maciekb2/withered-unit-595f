export const LATENCY_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
export function routeGroup(path: string): string {
  if (path === '/') return 'home';
  if (/^\/blog(?:\/\d+)?\/?$/.test(path)) return 'archive';
  if (path.startsWith('/blog/')) return 'article';
  if (path.startsWith('/tematy')) return 'topics';
  if (/^\/(contact|about|privacy)\/?$/.test(path)) return path.split('/')[1];
  if (path === '/api/contact') return 'contact_api';
  if (/^\/api\/(likes|views)(?:\/|$)/.test(path)) return path.split('/')[2];
  if (path === '/api/health') return 'health';
  if (path === '/rss.xml') return 'rss';
  if (path.startsWith('/api/')) return 'other_api';
  return 'other';
}
type Series = { route: string; method: string; status: string; traffic: string; count: number; sum: number; buckets: number[] };
export class HttpMetrics {
  private series = new Map<string, Series>();
  observe(path: string, method: string, status: number, seconds: number, probe: boolean): void {
    const labels = { route: routeGroup(path), method: ['GET', 'POST', 'HEAD', 'OPTIONS'].includes(method) ? method : 'OTHER',
      status: status >= 100 && status < 600 ? `${Math.floor(status / 100)}xx` : 'other', traffic: probe ? 'probe' : 'request' };
    const key = JSON.stringify(labels);
    const metric = this.series.get(key) || { ...labels, count: 0, sum: 0, buckets: LATENCY_BUCKETS.map(() => 0) };
    const duration = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    metric.count++; metric.sum += duration;
    LATENCY_BUCKETS.forEach((bound, index) => { if (duration <= bound) metric.buckets[index]++; });
    this.series.set(key, metric);
  }
  render(): string {
    const lines = [
      '# HELP pseudointelekt_http_requests_total SSR requests; not unique visitors; static assets bypass middleware.',
      '# TYPE pseudointelekt_http_requests_total counter',
      '# HELP pseudointelekt_http_duration_seconds Time until SSR response is returned, excluding body transfer.',
      '# TYPE pseudointelekt_http_duration_seconds histogram',
    ];
    for (const metric of this.series.values()) {
      const labels = `route="${metric.route}",method="${metric.method}",status="${metric.status}",traffic="${metric.traffic}"`;
      lines.push(`pseudointelekt_http_requests_total{${labels}} ${metric.count}`);
      LATENCY_BUCKETS.forEach((bound, index) => lines.push(`pseudointelekt_http_duration_seconds_bucket{${labels},le="${bound}"} ${metric.buckets[index]}`));
      lines.push(`pseudointelekt_http_duration_seconds_bucket{${labels},le="+Inf"} ${metric.count}`,
        `pseudointelekt_http_duration_seconds_count{${labels}} ${metric.count}`,
        `pseudointelekt_http_duration_seconds_sum{${labels}} ${metric.sum}`);
    }
    return lines.join('\n') + '\n';
  }
}
