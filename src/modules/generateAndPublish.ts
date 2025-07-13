import { generateArticleAssets } from './generateArticleAssets';
import { publishArticleToGitHub } from './githubPublisher';
import articleTemplate from '../prompt/article-content.txt?raw';
import heroTemplate from '../prompt/hero-image.txt?raw';
import { getRecentTitlesFromGitHub } from '../utils/recentTitlesGitHub';
import { slugify } from '../utils/slugify';
import type { ArticleResult } from './articleGenerator';

export interface GenerateAndPublishResult {
  article: ArticleResult;
  slug: string;
}

export async function generateAndPublish(env: Env): Promise<GenerateAndPublishResult> {
  const recent = await getRecentTitlesFromGitHub(env.GITHUB_REPO, env.GITHUB_TOKEN);
  const { article, heroImage } = await generateArticleAssets({
    apiKey: env.OPENAI_API_KEY,
    articleTemplate,
    heroTemplate,
    recentTitles: recent,
    maxTokens: 7200,
  });
  await publishArticleToGitHub({ env, article, heroImage });
  return { article, slug: slugify(article.title) };
}
