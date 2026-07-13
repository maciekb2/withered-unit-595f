#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { parseSsePayloads, readSchedulerState, shouldRetry, summarizeGenerationEvents, writeSchedulerState } from './selfhosted-scheduler-lib.mjs';

const appUrl = (process.env.SCHEDULER_APP_URL || 'http://app:3000').replace(/\/$/, '');
const token = process.env.GENERATOR_PRIVATE_TOKEN;
const enabled = process.env.SCHEDULER_ENABLED !== 'false';
const hour = Number.parseInt(process.env.SCHEDULER_RUN_HOUR || '10', 10);
const minute = Number.parseInt(process.env.SCHEDULER_RUN_MINUTE || '0', 10);
const timeZone = process.env.SCHEDULER_TIME_ZONE || 'Europe/Warsaw';
const retryDelayMs = Number.parseInt(process.env.SCHEDULER_RETRY_DELAY_MS || '3600000', 10);
const maxAttempts = Number.parseInt(process.env.SCHEDULER_MAX_ATTEMPTS || '2', 10);
const statePath = process.env.SCHEDULER_STATE_FILE || '/state/scheduler.json';
const metricsPath = process.env.SCHEDULER_METRICS_FILE || '/metrics/pseudointelekt_generation.prom';
const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 }) : null;
let running = false;
let stopped = false;

function nextRunDelay() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

async function recordRun(run) {
  if (!pool) return;
  await pool.query(`INSERT INTO generation_runs
    (id, status, attempt, started_at, finished_at, stage, topic, pr_url, error_code, error_message)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, finished_at=EXCLUDED.finished_at,
      stage=EXCLUDED.stage, topic=EXCLUDED.topic, pr_url=EXCLUDED.pr_url,
      error_code=EXCLUDED.error_code, error_message=EXCLUDED.error_message`,
  [run.id, run.status, run.attempt, run.startedAt, run.finishedAt || null, run.stage || null,
    run.topic || null, run.prUrl || null, run.errorCode || null, run.error || null]);
}

async function runAttempt(attempt) {
  const startedAt = new Date().toISOString();
  const run = { id: randomUUID(), status: 'running', attempt, startedAt };
  const previous = await readSchedulerState(statePath);
  await writeSchedulerState(statePath, metricsPath, { ...previous, status: 'running', attempt, lastRunAt: startedAt });
  await recordRun(run);
  console.log(JSON.stringify({ type: 'scheduler-start', started: startedAt, attempt, timeZone }));
  try {
    const response = await fetch(`${appUrl}/api/generate-stream?interactive=0`, {
      headers: { 'x-generator-private-token': token },
      signal: AbortSignal.timeout(Number(process.env.SCHEDULER_TIMEOUT_MS || 900000)),
    });
    if (!response.ok || !response.body) throw new Error(`generation endpoint returned HTTP ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const events = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() || '';
      for (const chunk of chunks) {
        console.log(chunk);
        events.push(...parseSsePayloads(`${chunk}\n\n`));
      }
    }
    events.push(...parseSsePayloads(buffer));
    const result = summarizeGenerationEvents(events);
    if (!result.ok) return await finish(run, result);
    return await finish(run, { ...result, ok: true });
  } catch (error) {
    return await finish(run, { ok: false, retryable: true, error: error instanceof Error ? error.message : String(error) });
  }
}

async function finish(run, result) {
  const finishedAt = new Date().toISOString();
  const status = result.ok ? 'succeeded' : 'failed';
  Object.assign(run, result, { status, finishedAt });
  await recordRun(run);
  const previous = await readSchedulerState(statePath);
  await writeSchedulerState(statePath, metricsPath, {
    ...previous, status, attempt: run.attempt, lastRunAt: run.startedAt,
    lastSuccessAt: result.ok ? finishedAt : previous.lastSuccessAt,
    stage: result.stage || null, errorCode: result.errorCode || null,
  });
  const method = result.ok ? 'log' : 'error';
  console[method](JSON.stringify({ type: result.ok ? 'scheduler-complete' : 'scheduler-error', ...run }));
  return result;
}

async function runWithRetry() {
  if (running || !enabled || !token) {
    if (!token) console.error('[scheduler] GENERATOR_PRIVATE_TOKEN is missing');
    return;
  }
  running = true;
  try {
    for (let attempt = 1; attempt <= maxAttempts && !stopped; attempt += 1) {
      const result = await runAttempt(attempt);
      if (!shouldRetry(result, attempt, maxAttempts)) break;
      console.log(JSON.stringify({ type: 'scheduler-retry-scheduled', attempt: attempt + 1, delayMs: retryDelayMs }));
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  } finally { running = false; }
}

async function loop() {
  if (!enabled) console.log('[scheduler] disabled by SCHEDULER_ENABLED=false');
  if (process.env.SCHEDULER_RUN_NOW === 'true') {
    await runWithRetry();
    if (process.env.SCHEDULER_EXIT_AFTER_RUN === 'true') return;
  }
  while (!stopped) {
    const delay = nextRunDelay();
    console.log(JSON.stringify({ type: 'scheduler-next-run', delayMs: delay, runHour: hour, runMinute: minute, timeZone }));
    await new Promise(resolve => setTimeout(resolve, delay));
    if (!stopped) await runWithRetry();
  }
  await pool?.end();
}

for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { stopped = true; });
void loop();
