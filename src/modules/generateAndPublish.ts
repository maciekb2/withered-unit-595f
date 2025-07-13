import { generateArticleAssets } from './generateArticleAssets';
import { publishArticleToGitHub } from './githubPublisher';
import { sendSlackMessage } from '../utils/slack';
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
  const prUrl = await publishArticleToGitHub({ env, article, heroImage });
  const snippet = article.content.slice(0, 300);
  await sendSlackMessage(
    env.SLACK_WEBHOOK_URL,
    `Nowy artykuł: ${article.title}\n${snippet}...\n${prUrl}`
  );
  return { article, slug: slugify(article.title) };
}
