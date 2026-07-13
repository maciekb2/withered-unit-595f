const DEFAULT_TOPIC_TIMEOUT_MS = 10 * 60 * 1000;

export class TopicSelectionError extends Error {
  readonly code: 'TOPIC_TIMEOUT' | 'TOPIC_CANCELLED' | 'TOPIC_REPLACED';

  constructor(
    message: string,
    code: 'TOPIC_TIMEOUT' | 'TOPIC_CANCELLED' | 'TOPIC_REPLACED',
  ) {
    super(message);
    this.name = 'TopicSelectionError';
    this.code = code;
  }
}

export function isTopicSelectionError(error: unknown): error is TopicSelectionError {
  return error instanceof TopicSelectionError;
}

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
  clearTopic(
    session,
    new TopicSelectionError('Topic selection was replaced by a newer request', 'TOPIC_REPLACED'),
  );
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(session);
      reject(new TopicSelectionError('Topic selection timed out', 'TOPIC_TIMEOUT'));
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

export function clearTopic(
  session: string,
  reason: Error = new TopicSelectionError('Topic selection cancelled', 'TOPIC_CANCELLED'),
): void {
  const entry = pending.get(session);
  if (!entry) return;
  pending.delete(session);
  clearTimeout(entry.timeout);
  entry.reject(reason);
}
