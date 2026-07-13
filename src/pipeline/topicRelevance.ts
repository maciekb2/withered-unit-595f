import type { HotTopic } from '../utils/hotTopics';

const EDITORIAL_TERMS = [
  'politic', 'government', 'minister', 'president', 'parliament', 'election', 'vote',
  'eu ', 'european union', 'nato', 'kremlin', 'russia', 'ukraine', 'china', 'beijing',
  'trump', 'white house', 'congress', 'sanction', 'tariff', 'trade', 'econom',
  'market', 'bank', 'inflation', 'energy', 'oil', 'gas', 'nuclear', 'defence',
  'defense', 'security', 'military', 'war', 'ceasefire', 'diplomat', 'summit',
  'technology', 'artificial intelligence', 'semiconductor', 'cyber', 'space',
  'rząd', 'minister', 'prezydent', 'parlament', 'wybor', 'unia europejska', 'nato',
  'rosj', 'ukrain', 'chiny', 'sankcj', 'cł', 'handel', 'gospodar', 'rynek', 'bank',
  'inflac', 'energi', 'ropa', 'gaz', 'atom', 'obron', 'bezpieczeń', 'wojn',
  'dyplomac', 'szczyt', 'technolog', 'sztuczna inteligencja', 'cyber', 'kosmos',
];

const EXCLUDED_TERMS = [
  'actor', 'actress', 'celebrity', 'hollywood', 'blockbuster', 'arthouse', 'film',
  'movie', 'cinema', 'music', 'singer', 'album', 'concert', 'tv show', 'fashion',
  'football', 'soccer', 'tennis', 'cricket', 'sport', 'match', 'tournament',
  'aktor', 'aktorka', 'celebryt', 'kino', 'film', 'muzyk', 'piosenkar', 'album',
  'koncert', 'serial', 'moda', 'piłk', 'tenis', 'sport', 'mecz', 'turniej',
];

const ISOLATED_INCIDENT_TERMS = [
  'fire', 'crash', 'accident', 'murder', 'killed', 'missing person', 'pożar',
  'wypadek', 'katastrofa', 'zabój', 'morder', 'zagin',
];

export interface TopicRelevance {
  eligible: boolean;
  score: number;
  reasons: string[];
}

export function assessTopicRelevance(topic: Pick<HotTopic, 'title' | 'description'>): TopicRelevance {
  const haystack = normalize(`${topic.title} ${topic.description || ''}`);
  const editorialHits = EDITORIAL_TERMS.filter(term => haystack.includes(normalize(term)));
  const excludedHits = EXCLUDED_TERMS.filter(term => haystack.includes(normalize(term)));
  const incidentHits = ISOLATED_INCIDENT_TERMS.filter(term => haystack.includes(normalize(term)));
  const score = Math.min(8, editorialHits.length * 2) - excludedHits.length * 3 - incidentHits.length * 2;
  const reasons = [
    editorialHits.length ? `editorial:${editorialHits.slice(0, 4).join(',')}` : 'no-editorial-signal',
    ...(excludedHits.length ? [`excluded:${excludedHits.slice(0, 3).join(',')}`] : []),
    ...(incidentHits.length ? [`isolated-incident:${incidentHits.slice(0, 3).join(',')}`] : []),
  ];
  return {
    eligible: editorialHits.length > 0 && score >= 2 && excludedHits.length === 0 && incidentHits.length === 0,
    score,
    reasons,
  };
}

export function filterEditorialTopics<T extends HotTopic>(topics: T[]): T[] {
  return topics
    .map((topic, index) => ({ topic, index, assessment: assessTopicRelevance(topic) }))
    .filter(item => item.assessment.eligible)
    .sort((left, right) => right.assessment.score - left.assessment.score || left.index - right.index)
    .map(item => item.topic);
}

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
