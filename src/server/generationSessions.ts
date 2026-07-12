const pending = new Map<string, (topic: string) => void>();

export function waitForTopic(session: string): Promise<{ topic: string }> {
  return new Promise(resolve => pending.set(session, topic => resolve({ topic })));
}

export function resolveTopic(session: string, topic: string): boolean {
  const resolver = pending.get(session);
  if (!resolver) return false;
  pending.delete(session);
  resolver(topic);
  return true;
}

export function clearTopic(session: string): void {
  pending.delete(session);
}
