import type { HotTopic } from '../utils/hotTopics';

export interface TopicContext {
  title: string;
  url?: string;
  published?: string;
  source?: string;
  description?: string;
}

export interface BuildContextPackOptions {
  selectedTopic: TopicContext;
  hotTopics: HotTopic[];
}

function clamp(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

export function buildContextPack({
  selectedTopic,
  hotTopics,
}: BuildContextPackOptions): string {
  const pack = {
    selectedTopic: {
      title: clamp(selectedTopic.title, 220),
      url: clamp(selectedTopic.url, 500),
      source: clamp(selectedTopic.source, 80),
      published: clamp(selectedTopic.published, 40),
      description: clamp(selectedTopic.description, 500),
    },
    leadSourceUrl: clamp(selectedTopic.url, 500),
    hotTopics: hotTopics.slice(0, 6).map(t => ({
      title: clamp(t.title, 220),
      url: clamp(t.url, 500),
      source: clamp(t.source, 80),
      published: clamp(t.published, 40),
      description: clamp(t.description, 320),
    })),
  };

  return JSON.stringify(pack, null, 2);
}
