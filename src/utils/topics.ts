import type { CollectionEntry } from 'astro:content';

export type BlogPostEntry = CollectionEntry<'blog'>;

export type TopicDefinition = {
  slug: string;
  name: string;
  description: string;
  lens: string;
  context: string;
  keywords: string[];
};

export type TopicSummary = TopicDefinition & {
  posts: BlogPostEntry[];
};

export const TOPICS: TopicDefinition[] = [
  {
    slug: 'geopolityka',
    name: 'Geopolityka',
    description: 'Teksty o państwach, sojuszach, granicach i interesach, które rządzą komunikatami dnia.',
    lens: 'Granice, sojusze i infrastruktura, która decyduje o realnym zasięgu państw.',
    context: 'Śledzimy tu decyzje państw i bloków politycznych przez ich wykonanie: dostęp do szlaków, zdolność do działania i cenę utrzymania wpływu.',
    keywords: [
      'geopolityka',
      'sojusz',
      'granica',
      'dyplomacja',
      'kreml',
      'rosja',
      'ukraina',
      'chiny',
      'usa',
      'europa',
      'nato',
      'wojna',
      'pekin',
      'waszyngton',
    ],
  },
  {
    slug: 'technologia-i-cyber',
    name: 'Technologia i cyber',
    description: 'Cyfrowe awarie, algorytmy, chipy i infrastruktura, czyli polityka tam, gdzie kończy się wygodny interfejs.',
    lens: 'Technologia jako infrastruktura władzy, a nie wyłącznie kolejna aplikacja.',
    context: 'Ten dział dotyczy systemów, których zwykle nie widać do chwili awarii: sieci, chipów, algorytmów i zależności dostawców.',
    keywords: [
      'cyber',
      'algorytm',
      'technologia',
      'chip',
      'ai',
      'sztuczna inteligencja',
      'cyfrow',
      'router',
      'firewall',
      'awaria',
      'internet',
      'aplikac',
    ],
  },
  {
    slug: 'europa-i-unia',
    name: 'Europa i Unia',
    description: 'Unijne deklaracje, europejskie spory i rachunki, które zwykle wracają w najmniej wygodnym momencie.',
    lens: 'Europejskie kompromisy, ich koszt i granice wspólnego działania.',
    context: 'Czytamy europejską politykę przez wdrożenie: co ustalono, kto finansuje zmianę i gdzie kończy się deklarowana wspólnota interesów.',
    keywords: [
      'unia',
      'ue',
      'europa',
      'europejsk',
      'bruksela',
      'berlin',
      'francja',
      'niemcy',
      'brexit',
      'eurostar',
      'kontynent',
    ],
  },
  {
    slug: 'gospodarka-i-energia',
    name: 'Gospodarka i energia',
    description: 'Ropa, energia, kredyty, taryfy i inne narzędzia, którymi wielka polityka udaje arkusz kalkulacyjny.',
    lens: 'Energia, pieniądz i handel jako najtrwalsze narzędzia polityki.',
    context: 'W tym dossier decyzje polityczne spotykają rachunek: ceny energii, przepływy kapitału, taryfy oraz koszty ponoszone poza salą konferencyjną.',
    keywords: [
      'energia',
      'ropa',
      'gaz',
      'kredyt',
      'bank',
      'taryfa',
      'clo',
      'podatek',
      'rynek',
      'finans',
      'pieniadz',
      'gospodark',
      'zielon',
    ],
  },
  {
    slug: 'polityka-i-media',
    name: 'Polityka i media',
    description: 'Spektakle, narracje, celebryci, wybory i wszystkie chwile, w których kamera zaczyna pisać program.',
    lens: 'Narracje, kampanie i medialne skróty, które zmieniają odbiór decyzji.',
    context: 'Przyglądamy się temu, jak obraz wydarzenia wpływa na jego polityczny skutek: kto ustawia temat, co znika z kadru i komu służy skrót.',
    keywords: [
      'polityka',
      'media',
      'wybory',
      'trump',
      'celebryt',
      'kamera',
      'telewizja',
      'narracja',
      'demokrac',
      'cenzur',
      'glos',
      'komunikat',
    ],
  },
];

export function sortPostsByDate(posts: BlogPostEntry[]): BlogPostEntry[] {
  return [...posts].sort((a, b) => {
    const dateDiff = b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
    return dateDiff === 0 ? b.id.localeCompare(a.id) : dateDiff;
  });
}

export function inferPostTopics(post: BlogPostEntry): TopicDefinition[] {
  const frontmatterTopics = topicsFromTags(post.data.tags || []);
  if (frontmatterTopics.length > 0) return frontmatterTopics;
  return inferTopicsForText(post.data.title, post.data.description);
}

export function topicsFromTags(tags: string[] = []): TopicDefinition[] {
  const tagSet = new Set(tags.map((tag) => tag.toLocaleLowerCase('pl-PL')));
  return TOPICS.filter((topic) => tagSet.has(topic.slug));
}

export function inferTopicsForText(title: string, description = ''): TopicDefinition[] {
  const haystack = `${title} ${description}`.toLocaleLowerCase('pl-PL');
  const matched = TOPICS.filter((topic) =>
    topic.keywords.some((keyword) => haystack.includes(keyword.toLocaleLowerCase('pl-PL'))),
  );

  return matched.length ? matched.slice(0, 3) : [TOPICS[0]];
}

export function tagsForArticle(title: string, description = ''): string[] {
  return inferTopicsForText(title, description).map((topic) => topic.slug);
}

export function buildTopicIndex(posts: BlogPostEntry[]): TopicSummary[] {
  const sortedPosts = sortPostsByDate(posts);
  return TOPICS.map((topic) => ({
    ...topic,
    posts: sortedPosts.filter((post) =>
      inferPostTopics(post).some((matchedTopic) => matchedTopic.slug === topic.slug),
    ),
  })).filter((topic) => topic.posts.length > 0);
}

export function getTopicBySlug(slug: string): TopicDefinition | undefined {
  return TOPICS.find((topic) => topic.slug === slug);
}

export function getRelatedPosts(
  currentPost: BlogPostEntry,
  posts: BlogPostEntry[],
  limit = 3,
): BlogPostEntry[] {
  const currentTopics = new Set(inferPostTopics(currentPost).map((topic) => topic.slug));

  return sortPostsByDate(posts)
    .filter((post) => post.id !== currentPost.id)
    .map((post) => {
      const sharedTopicCount = inferPostTopics(post)
        .filter((topic) => currentTopics.has(topic.slug)).length;
      const daysApart = Math.abs(
        post.data.pubDate.valueOf() - currentPost.data.pubDate.valueOf(),
      ) / 86400000;

      return {
        post,
        score: sharedTopicCount * 1000 - Math.min(daysApart, 365),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.post);
}
