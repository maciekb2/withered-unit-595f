import type { HotTopic } from '../utils/hotTopics';
import type { RecentPostSample } from '../utils/recentPostsGitHub';

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
  recentPostSamples?: RecentPostSample[];
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
  recentPostSamples = [],
}: BuildContextPackOptions): string {
  const pack = {
    selectedTopic: {
      title: clamp(selectedTopic.title, 220),
      url: clamp(selectedTopic.url, 500),
      source: clamp(selectedTopic.source, 80),
      published: clamp(selectedTopic.published, 40),
      description: clamp(selectedTopic.description, 500),
    },
    hotTopics: hotTopics.slice(0, 6).map(t => ({
      title: clamp(t.title, 220),
      url: clamp(t.url, 500),
      source: clamp(t.source, 80),
      published: clamp(t.published, 40),
      description: clamp(t.description, 320),
    })),
    styleSamples: recentPostSamples.slice(0, 2).map(p => ({
      title: clamp(p.title, 220),
      excerpt: clamp(p.excerpt, 1200),
    })),
    styleRules: [
      'Satyryczny, ironiczny ton; PL-patriotyczny, centro-prawicowy; profesjonalny styl.',
      'Trzymaj jeden główny wątek; bez skakania po tematach.',
      'Jeśli zdanie ma liczbę/datę/raport/statystykę → ten sam wers zawiera pełny URL http(s)://...; inaczej usuń konkrety lub użyj [[TODO-CLAIM]] w szkicu.',
    ],
  };

  return JSON.stringify(pack, null, 2);
}
