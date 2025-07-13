import { generateArticle } from './articleGenerator';
import { generateHeroImage } from './heroImageGenerator';
import type { ArticleResult } from './articleGenerator';

export interface GenerateArticleAssetsOptions {
  apiKey: string;
  articleTemplate: string;
  heroTemplate: string;
  recentTitles: string[];
  maxTokens?: number;
}

export interface GenerateArticleAssetsResult {
  article: ArticleResult;
  heroImage: Buffer;
}

export async function generateArticleAssets({
  apiKey,
  articleTemplate,
  heroTemplate,
  recentTitles,
  maxTokens,
}: GenerateArticleAssetsOptions): Promise<GenerateArticleAssetsResult> {
  const article = await generateArticle({
    apiKey,
    prompt: articleTemplate,
    recentTitles,
    maxTokens,
  });
  const heroPrompt = heroTemplate.replace('{title}', article.title);
  const heroImage = await generateHeroImage({ apiKey, prompt: heroPrompt });
  return { article, heroImage };
}
