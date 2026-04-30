import { XMLParser } from 'fast-xml-parser';

export interface HotTopic {
  title: string;
  url: string;
  published: string;
  source: string;
  description?: string;
}

const RSS_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC World' },
  { url: 'https://www.politico.com/rss/politics-news.xml', source: 'Politico' },
  { url: 'https://www.pap.pl/rss.xml', source: 'PAP' },
  { url: 'https://feeds.reuters.com/Reuters/worldNews', source: 'Reuters World' },
  { url: 'https://feeds.reuters.com/Reuters/europeNews', source: 'Reuters Europe' },
  { url: 'https://feeds.reuters.com/Reuters/politicsNews', source: 'Reuters Politics' },
] as const;

const FALLBACK_TOPICS: HotTopic[] = [
  {
    title: 'Sample fallback topic 1',
    url: 'https://example.com/fallback-1',
    published: new Date().toISOString(),
    source: 'fallback',
    description: 'Fallback topic (no RSS description available).',
  },
  {
    title: 'Sample fallback topic 2',
    url: 'https://example.com/fallback-2',
    published: new Date().toISOString(),
    source: 'fallback',
    description: 'Fallback topic (no RSS description available).',
  },
  {
    title: 'Sample fallback topic 3',
    url: 'https://example.com/fallback-3',
    published: new Date().toISOString(),
    source: 'fallback',
    description: 'Fallback topic (no RSS description available).',
  },
];

function stripHtml(s: string): string {
  return decodeEntities(s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  cdataPropName: '#cdata',
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value: unknown): string {
  if (typeof value === 'string') return decodeEntities(value).trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return textValue(record['#cdata'] || record['#text'] || record.value || '');
  }
  return '';
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function linkValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    const alternate = value.find(item => {
      const rel = (item as Record<string, unknown>)?.['@_rel'];
      return rel == null || rel === 'alternate';
    });
    return linkValue(alternate || value[0]);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return textValue(record['@_href'] || record['#text'] || record['#cdata'] || '');
  }
  return '';
}

function toIsoDate(value: string): string {
  if (!value) return '';
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
}

function itemToHotTopic(source: string, item: Record<string, unknown>): HotTopic | null {
  const title = textValue(item.title);
  const url = linkValue(item.link || item.guid);
  const published = toIsoDate(
    textValue(item.pubDate || item.published || item.updated || item['dc:date']),
  );
  const descRaw = textValue(
    item.description || item.summary || item.content || item['content:encoded'],
  );
  const description = descRaw ? stripHtml(descRaw).slice(0, 420) : undefined;

  if (!title || !url || !published) return null;
  return { title, url, published, source, description };
}

export function parseHotTopicsFromXml(source: string, xml: string): HotTopic[] {
  const parsed = xmlParser.parse(xml) as Record<string, unknown>;
  const rss = parsed.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  const feed = parsed.feed as Record<string, unknown> | undefined;
  const rssItems = asArray(channel?.item as Record<string, unknown> | Record<string, unknown>[] | undefined);
  const atomEntries = asArray(feed?.entry as Record<string, unknown> | Record<string, unknown>[] | undefined);

  return [...rssItems, ...atomEntries]
    .map(item => itemToHotTopic(source, item))
    .filter((item): item is HotTopic => item !== null);
}

export async function getHotTopics(limit = 8): Promise<HotTopic[]> {
  const allItems: HotTopic[] = [];
  await Promise.all(
    RSS_FEEDS.map(async feed => {
      try {
        const res = await fetch(feed.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();
        allItems.push(...parseHotTopicsFromXml(feed.source, xml));
      } catch (err) {
        try {
          const loggerPath = './logger.js';
          const logger = await import(loggerPath);
          (logger as any).logError?.(err, { feed: feed.url });
        } catch {
          console.error(err);
        }
      }
    })
  );
  if (allItems.length === 0) {
    return FALLBACK_TOPICS.slice(0, limit);
  }
  allItems.sort(
    (a, b) => new Date(b.published).getTime() - new Date(a.published).getTime()
  );
  return allItems.slice(0, limit);
}
