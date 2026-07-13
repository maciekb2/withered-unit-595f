import type { FinalJson } from '../pipeline/types';

export interface SocialSource {
  slug: string;
  title: string;
  lead: string;
  summaryPoints: string[];
  punchline: string;
  tags: string[];
  heroUrl: string;
  articleUrl: string;
  sourceUrl?: string;
  publishedAt: string;
}

export interface SocialScore {
  topicality: number;
  recognizability: number;
  ironyPotential: number;
  clarity: number;
  hookStrength: number;
  total: number;
}

export interface SocialPackage {
  score: SocialScore;
  hook: string;
  instagramCaption: string;
  youtubeTitle: string;
  youtubeDescription: string;
  scenes: string[];
  hashtags: string[];
  staticPost?: boolean;
  carousel?: boolean;
  imagePrompt: string;
  contentKind: 'current' | 'evergreen';
  experiment: string;
  template: 'situation-room-v2';
}

const clean = (value: string) => value.replace(/\s+/g, ' ').replace(/[*_`#>]/g, '').trim();

export function buildSocialSource(article: FinalJson, slug: string, publishedAt = new Date().toISOString()): SocialSource {
  const articleId = `${publishedAt.slice(0, 10)}-${slug}`;
  const articleUrl = `https://pseudointelekt.pl/blog/${articleId}/`;
  const paragraphs = article.content
    .split(/\n{2,}/)
    .map(clean)
    .filter(value => value.length >= 80 && !/^https?:\/\//.test(value));
  const summaryPoints = paragraphs.slice(0, 5).map(value => value.slice(0, 320));
  return {
    slug: articleId,
    title: clean(article.title),
    lead: clean(article.description),
    summaryPoints,
    punchline: summaryPoints.at(-1) || clean(article.description),
    tags: (article.tags || []).slice(0, 6),
    heroUrl: `https://pseudointelekt.pl/blog-images/${articleId}.png`,
    articleUrl,
    sourceUrl: article.sourceUrl,
    publishedAt,
  };
}

export function validateSocialSource(source: SocialSource): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9][a-z0-9-]{2,179}$/.test(source.slug)) errors.push('invalid slug');
  if (source.title.length < 20 || source.title.length > 180) errors.push('invalid title length');
  if (source.lead.length < 40 || source.lead.length > 500) errors.push('invalid lead length');
  if (source.summaryPoints.length < 3 || source.summaryPoints.length > 6) errors.push('summaryPoints must contain 3-6 items');
  for (const url of [source.heroUrl, source.articleUrl]) {
    try { if (new URL(url).protocol !== 'https:') errors.push('media URLs must use https'); } catch { errors.push('invalid URL'); }
  }
  return errors;
}
