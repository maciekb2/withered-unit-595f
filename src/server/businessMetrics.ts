import pg from 'pg';

export function createMetricsPool(connectionString: string | undefined): pg.Pool {
  const pool = new pg.Pool({
    connectionString, max: 1, connectionTimeoutMillis: 2000, query_timeout: 2500, idleTimeoutMillis: 10000,
    application_name: 'pseudointelekt-monitoring',
    options: '-c default_transaction_read_only=on -c statement_timeout=2000 -c lock_timeout=500',
  });
  pool.on('error', () => {}); // A failed read exposes database_up=0; never log credentials.
  return pool;
}

export const metric = (name: string, value: unknown, labels = '') => {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('Non-finite metric');
  return `pseudointelekt_${name}${labels ? `{${labels}}` : ''} ${number}\n`;
};
export const GAUGES = [
  'database_up','database_query_duration_seconds','collector_up','engagement_count',
  'contact_messages_window','contact_messages_expired','social_jobs','social_oldest_timestamp_seconds',
  'generation_runs_7d','generation_latest_timestamp_seconds','articles_published',
  'article_latest_timestamp_seconds','articles_published_7d','probe_success','probe_duration_seconds',
  'probe_status_code','probe_last_failure_timestamp_seconds','event_loop_delay_p99_seconds',
  'collection_last_success_timestamp_seconds','process_resident_memory_bytes',
  'process_heap_used_bytes','process_uptime_seconds',
];
export const metricTypes = () => GAUGES.map(name => `# HELP pseudointelekt_${name} Aggregate ${name.replaceAll('_',' ')}.\n# TYPE pseudointelekt_${name} gauge\n`).join('') +
  '# HELP pseudointelekt_process_cpu_seconds_total CPU time consumed by the application process.\n# TYPE pseudointelekt_process_cpu_seconds_total counter\n';
export const BUSINESS_QUERIES = {
  engagement: "SELECT kind, sum(value)::float8 AS value FROM engagement_counters GROUP BY kind",
  contact: "SELECT count(*) FILTER (WHERE created_at > now()-interval '24 hours')::float8 AS day, count(*) FILTER (WHERE created_at > now()-interval '7 days')::float8 AS week, count(*) FILTER (WHERE expires_at < now())::float8 AS expired FROM contact_messages",
  social: "SELECT status, count(*)::float8 AS value, COALESCE(extract(epoch FROM min(CASE WHEN status='queued' THEN COALESCE(scheduled_for,updated_at) ELSE updated_at END)),0)::float8 AS oldest FROM social_jobs GROUP BY status",
  generation: "SELECT status, count(*)::float8 AS value, COALESCE(extract(epoch FROM max(started_at)),0)::float8 AS latest FROM generation_runs WHERE started_at > now()-interval '7 days' GROUP BY status",
} as const;
export async function collectBusiness(pool: Pick<pg.Pool, 'query'>): Promise<string> {
  let output = '';
  const started = performance.now();
  try { await pool.query('SELECT 1'); output += metric('database_up', 1); }
  catch { return metric('database_up', 0); }
  output += metric('database_query_duration_seconds', (performance.now() - started) / 1000);
  for (const [collector, query] of Object.entries(BUSINESS_QUERIES)) {
    try {
      const { rows } = await pool.query(query);
      if (collector === 'engagement') {
        for (const kind of ['view', 'like']) output += metric('engagement_count', rows.find(row => row.kind === kind)?.value || 0, `kind="${kind}"`);
      } else if (collector === 'contact') {
        output += metric('contact_messages_window', rows[0].day, 'window="24h"') + metric('contact_messages_window', rows[0].week, 'window="7d"') + metric('contact_messages_expired', rows[0].expired);
      } else if (collector === 'social') {
        for (const status of ['candidate','selected','ready','generating','review','queued','published','failed','skipped','waiting_article','eligible']) {
          const row = rows.find(row => row.status === status);
          output += metric('social_jobs', row?.value || 0, `status="${status}"`);
          if (['ready','generating','queued'].includes(status)) output += metric('social_oldest_timestamp_seconds', row?.oldest || 0, `status="${status}"`);
        }
      } else {
        for (const status of ['running','succeeded','failed','skipped']) {
          const row = rows.find(row => row.status === status);
          output += metric('generation_runs_7d', row?.value || 0, `status="${status}"`) + metric('generation_latest_timestamp_seconds', row?.latest || 0, `status="${status}"`);
        }
      }
      output += metric('collector_up', 1, `collector="${collector}"`);
    } catch { output += metric('collector_up', 0, `collector="${collector}"`); }
  }
  return output;
}
