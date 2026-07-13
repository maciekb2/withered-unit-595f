const DEFAULT_TOPIC_TIMEOUT_MS = 10 * 60 * 1000;

interface PendingTopic {
  resolve: (topic: string) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, PendingTopic>();

export function waitForTopic(
  session: string,
  timeoutMs = DEFAULT_TOPIC_TIMEOUT_MS,
): Promise<{ topic: string }> {
  clearTopic(session, 'Topic selection was replaced by a newer request');
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(session);
      reject(new Error('Topic selection timed out'));
    }, Math.max(1, timeoutMs));
    pending.set(session, {
      resolve: topic => resolve({ topic }),
      reject,
      timeout,
    });
  });
}

export function resolveTopic(session: string, topic: string): boolean {
  const entry = pending.get(session);
  if (!entry) return false;
  pending.delete(session);
  clearTimeout(entry.timeout);
  entry.resolve(topic);
  return true;
}

export function clearTopic(session: string, reason = 'Topic selection cancelled'): void {
  const entry = pending.get(session);
  if (!entry) return;
  pending.delete(session);
  clearTimeout(entry.timeout);
  entry.reject(new Error(reason));
}
