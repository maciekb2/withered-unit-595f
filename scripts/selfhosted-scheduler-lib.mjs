import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export function parseSsePayloads(text) {
  return text.split('\n\n').flatMap(event => event.split('\n'))
    .filter(line => line.startsWith('data: '))
    .map(line => {
      try { return JSON.parse(line.slice(6)); } catch { return null; }
    })
    .filter(Boolean);
}

export function summarizeGenerationEvents(events) {
  const failed = [...events].reverse().find(event => event.failed === true);
  const completed = [...events].reverse().find(event => event.prUrl || event.articleTitle);
  return {
    ok: !failed,
    retryable: failed?.retryable !== false,
    stage: failed?.stage || completed?.stage || null,
    errorCode: failed?.code || null,
    error: failed?.error || null,
    topic: completed?.baseTopic || completed?.articleTitle || null,
    prUrl: completed?.prUrl || null,
  };
}

export function shouldRetry(result, attempt, maxAttempts = 2) {
  return !result.ok && result.retryable !== false && attempt < maxAttempts;
}

export function renderSchedulerMetrics(state) {
  const status = state.status === 'succeeded' ? 1 : state.status === 'running' ? 0.5 : 0;
  return [
    '# HELP pseudointelekt_generation_last_run_timestamp_seconds Last scheduler attempt start.',
    '# TYPE pseudointelekt_generation_last_run_timestamp_seconds gauge',
    `pseudointelekt_generation_last_run_timestamp_seconds ${toSeconds(state.lastRunAt)}`,
    '# HELP pseudointelekt_generation_last_success_timestamp_seconds Last successful article generation.',
    '# TYPE pseudointelekt_generation_last_success_timestamp_seconds gauge',
    `pseudointelekt_generation_last_success_timestamp_seconds ${toSeconds(state.lastSuccessAt)}`,
    '# HELP pseudointelekt_generation_status Current scheduler status: 1 success, 0.5 running, 0 failure.',
    '# TYPE pseudointelekt_generation_status gauge',
    `pseudointelekt_generation_status ${status}`,
    '# HELP pseudointelekt_generation_last_attempt Last attempt number.',
    '# TYPE pseudointelekt_generation_last_attempt gauge',
    `pseudointelekt_generation_last_attempt ${Number(state.attempt || 0)}`,
    '',
  ].join('\n');
}

export async function readSchedulerState(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return {}; }
}

export async function writeSchedulerState(statePath, metricsPath, state) {
  await atomicWrite(statePath, `${JSON.stringify(state, null, 2)}\n`);
  await atomicWrite(metricsPath, renderSchedulerMetrics(state));
}

async function atomicWrite(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, value, 'utf8');
  await rename(temporary, path);
}

function toSeconds(value) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0;
}
