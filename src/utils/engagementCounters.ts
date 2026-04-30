type CounterKind = 'view' | 'like';

const COUNTER_TABLE = 'engagement_counters';
const legacyHydratedKinds = new Set<CounterKind>();

function now(): string {
  return new Date().toISOString();
}

function parseCounter(value: string | null): number {
  if (value == null) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function getLegacyCounter(
  namespace: KVNamespace,
  key: string,
): Promise<number> {
  return parseCounter(await namespace.get(key));
}

function getLegacyNamespace(env: Env, kind: CounterKind): KVNamespace {
  return kind === 'view' ? env.pseudointelekt_views : env.pseudointelekt_likes;
}

async function getLegacyBaseline(
  env: Env,
  kind: CounterKind,
  slug: string,
  minimum = 0,
): Promise<number> {
  const legacy = await getLegacyCounter(getLegacyNamespace(env, kind), `${kind}-${slug}`);
  return Math.max(legacy, minimum);
}

export async function incrementCounter(
  env: Env,
  kind: CounterKind,
  slug: string,
  baseline = 0,
): Promise<number> {
  const legacyBaseline = await getLegacyBaseline(env, kind, slug, baseline);
  const row = await env.pseudointelekt_logs_db
    .prepare(
      `INSERT INTO ${COUNTER_TABLE} (kind, slug, value, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?4)
       ON CONFLICT(kind, slug) DO UPDATE SET
         value = value + 1,
         updated_at = excluded.updated_at
       RETURNING value`,
    )
    .bind(kind, slug, legacyBaseline + 1, now())
    .first<{ value: number }>();

  return Number(row?.value ?? legacyBaseline + 1);
}

export async function ensureCounter(
  env: Env,
  kind: CounterKind,
  slug: string,
  baseline = 0,
): Promise<number> {
  const legacyBaseline = await getLegacyBaseline(env, kind, slug, baseline);
  const timestamp = now();
  await env.pseudointelekt_logs_db
    .prepare(
      `INSERT INTO ${COUNTER_TABLE} (kind, slug, value, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?4)
       ON CONFLICT(kind, slug) DO NOTHING`,
    )
    .bind(kind, slug, legacyBaseline, timestamp)
    .run();

  return getCounter(env, kind, slug);
}

export async function getCounter(
  env: Env,
  kind: CounterKind,
  slug: string,
): Promise<number> {
  const row = await env.pseudointelekt_logs_db
    .prepare(`SELECT value FROM ${COUNTER_TABLE} WHERE kind = ?1 AND slug = ?2`)
    .bind(kind, slug)
    .first<{ value: number }>();

  return Number(row?.value ?? 0);
}

export async function getCounters(
  env: Env,
  kind: CounterKind,
  slugs: string[] = [],
): Promise<Record<string, number>> {
  if (!legacyHydratedKinds.has(kind)) {
    const legacy = await getLegacyCounters(env, kind);
    for (const [slug, value] of Object.entries(legacy)) {
      await ensureCounter(env, kind, slug, value);
    }
    legacyHydratedKinds.add(kind);
  }

  for (const slug of slugs) {
    await ensureCounter(env, kind, slug);
  }

  const rows = await env.pseudointelekt_logs_db
    .prepare(`SELECT slug, value FROM ${COUNTER_TABLE} WHERE kind = ?1`)
    .bind(kind)
    .all<{ slug: string; value: number }>();

  const data: Record<string, number> = {};
  for (const row of rows.results || []) {
    data[row.slug] = Number(row.value || 0);
  }
  return data;
}

async function getLegacyCounters(
  env: Env,
  kind: CounterKind,
): Promise<Record<string, number>> {
  const namespace = getLegacyNamespace(env, kind);
  const prefix = `${kind}-`;
  const data: Record<string, number> = {};
  let cursor: string | undefined;

  do {
    const list = await namespace.list({ prefix, cursor });
    for (const { name } of list.keys) {
      const value = await namespace.get(name);
      if (value) {
        data[name.replace(prefix, '')] = parseCounter(value);
      }
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return data;
}

export async function markLikeIfFirst(
  env: Env,
  slug: string,
  sessionId: string,
): Promise<boolean> {
  const result = await env.pseudointelekt_logs_db
    .prepare(
      `INSERT OR IGNORE INTO engagement_like_sessions (slug, session_id, created_at)
       VALUES (?1, ?2, ?3)`,
    )
    .bind(slug, sessionId, now())
    .run();

  return Boolean(result.meta.changes);
}
