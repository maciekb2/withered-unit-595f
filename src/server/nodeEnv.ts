import { getPool } from './postgres';
import type pg from 'pg';

type Query = { sql: string; values: unknown[] };

function translate(sql: string, values: unknown[]): Query {
  return { sql: sql.replace(/\?(\d+)/g, (_, n) => `$${n}`), values };
}

class PgStatement {
  constructor(private readonly sql: string, private readonly values: unknown[] = []) {}
  bind(...values: unknown[]): PgStatement { return new PgStatement(this.sql, values); }
  async first<T extends pg.QueryResultRow>(): Promise<T | null> {
    const result = await getPool().query<T>(...Object.values(translate(this.sql, this.values)) as [string, unknown[]]);
    return result.rows[0] || null;
  }
  async all<T extends pg.QueryResultRow>(): Promise<{ results: T[] }> {
    const result = await getPool().query<T>(...Object.values(translate(this.sql, this.values)) as [string, unknown[]]);
    return { results: result.rows };
  }
  async run(): Promise<{ meta: { changes: number } }> {
    const result = await getPool().query(...Object.values(translate(this.sql, this.values)) as [string, unknown[]]);
    return { meta: { changes: result.rowCount || 0 } };
  }
}

export function postgresD1Compat() {
  return {
    prepare(sql: string) { return new PgStatement(sql); },
    async exec(sql: string) { await getPool().query(sql); },
  } as unknown as D1Database;
}

export function nodeGenerationEnv(): Env {
  const env = process.env;
  return {
    ...env,
    ASSETS: undefined,
    AI: undefined,
    WORKER_ID: env.WORKER_ID || 'pseudointelekt-selfhosted',
    OPENAI_API_KEY: env.OPENAI_API_KEY || '',
    GITHUB_TOKEN: env.GITHUB_TOKEN || '',
    GITHUB_REPO: env.GITHUB_REPO || 'maciekb2/withered-unit-595f',
    SLACK_WEBHOOK_URL: env.SLACK_WEBHOOK_URL || '',
    pseudointelekt_logs_db: postgresD1Compat(),
  } as unknown as Env;
}

export function nodeExecutionContext() {
  return { waitUntil(promise: Promise<unknown>) { void promise.catch(console.error); } } as unknown as ExecutionContext;
}
