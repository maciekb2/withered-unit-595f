export interface HotTopic {
  title: string;
  url: string;
  published: string;
  source: string;
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
  },
  {
    title: 'Sample fallback topic 2',
    url: 'https://example.com/fallback-2',
    published: new Date().toISOString(),
    source: 'fallback',
  },
  {
    title: 'Sample fallback topic 3',
    url: 'https://example.com/fallback-3',
    published: new Date().toISOString(),
    source: 'fallback',
  },
];

function parseItems(source: string, xml: string): HotTopic[] {
  const items: HotTopic[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml))) {
    const item = match[1];
    const titleMatch =
      /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/.exec(item);
    const linkMatch = /<link>(.*?)<\/link>/.exec(item);
    const dateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(item);
    const title = titleMatch?.[1] || titleMatch?.[2] || '';
    const url = linkMatch?.[1]?.trim() || '';
    const publishedRaw = dateMatch?.[1];
    const published = publishedRaw ? new Date(publishedRaw).toISOString() : '';
    if (title && url && published) {
      items.push({ title, url, published, source });
    }
  }
  return items;
}

export async function getHotTopics(limit = 8): Promise<HotTopic[]> {
  const allItems: HotTopic[] = [];
  await Promise.all(
    RSS_FEEDS.map(async feed => {
      try {
        const res = await fetch(feed.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();
        allItems.push(...parseItems(feed.source, xml));
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
