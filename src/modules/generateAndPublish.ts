import { generateArticle } from './articleGenerator';
import { generateHeroImage } from './heroImageGenerator';
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
  const recentList = recent.map((t, i) => `${i + 1}. ${t}`).join('\n');
  const articlePrompt = articleTemplate.replace('{recent_titles}', recentList);
  const article = await generateArticle({
    apiKey: env.OPENAI_API_KEY,
    prompt: articlePrompt,
    maxTokens: 7200,
  });
  const heroPrompt = heroTemplate.replace('{title}', article.title);
  const heroImage = await generateHeroImage({ apiKey: env.OPENAI_API_KEY, prompt: heroPrompt });
  await publishArticleToGitHub({ env, article, heroImage });
  return { article, slug: slugify(article.title) };
}
