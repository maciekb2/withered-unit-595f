#!/usr/bin/env node
const appUrl = (process.env.SCHEDULER_APP_URL || 'http://app:3000').replace(/\/$/, '');
const token = process.env.GENERATOR_PRIVATE_TOKEN;
const enabled = process.env.SCHEDULER_ENABLED !== 'false';
const hour = Number.parseInt(process.env.SCHEDULER_RUN_HOUR || '10', 10);
const minute = Number.parseInt(process.env.SCHEDULER_RUN_MINUTE || '0', 10);
const timeZone = process.env.SCHEDULER_TIME_ZONE || 'Europe/Warsaw';
let running = false;
let stopped = false;

function nextRunDelay() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

async function runOnce() {
  if (running || !enabled || !token) {
    if (!token) console.error('[scheduler] GENERATOR_PRIVATE_TOKEN is missing');
    return;
  }
  running = true;
  const started = new Date().toISOString();
  console.log(JSON.stringify({ type: 'scheduler-start', started, timeZone }));
  try {
    const response = await fetch(`${appUrl}/api/generate-stream?interactive=0`, {
      headers: { 'x-generator-private-token': token },
      signal: AbortSignal.timeout(Number(process.env.SCHEDULER_TIMEOUT_MS || 900000)),
    });
    if (!response.ok || !response.body) throw new Error(`generation endpoint returned HTTP ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const event of events) {
        const line = event.split('\n').find(item => item.startsWith('data: '));
        if (line) console.log(line.slice(6));
      }
    }
    console.log(JSON.stringify({ type: 'scheduler-complete', started, finished: new Date().toISOString() }));
  } catch (error) {
    console.error(JSON.stringify({ type: 'scheduler-error', error: error instanceof Error ? error.message : String(error) }));
  } finally {
    running = false;
  }
}

async function loop() {
  if (!enabled) console.log('[scheduler] disabled by SCHEDULER_ENABLED=false');
  if (process.env.SCHEDULER_RUN_NOW === 'true') {
    await runOnce();
    if (process.env.SCHEDULER_EXIT_AFTER_RUN === 'true') return;
  }
  while (!stopped) {
    const delay = nextRunDelay();
    console.log(JSON.stringify({ type: 'scheduler-next-run', delayMs: delay, runHour: hour, runMinute: minute, timeZone }));
    await new Promise(resolve => setTimeout(resolve, delay));
    if (!stopped) await runOnce();
  }
}

for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { stopped = true; });
void loop();
