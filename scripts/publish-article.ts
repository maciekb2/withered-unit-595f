import { generateArticleAssets } from '../src/modules/generateArticleAssets';
import { assembleArticle } from '../src/modules/articleAssembler';
import { logEvent, logError } from '../src/utils/logger';
import { getRecentTitlesFS } from '../src/utils/recentTitlesFs';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { publicationInput } from './publication-input';

async function main() {
  logEvent({ type: 'cli-start' });
  const input = publicationInput(process.env);
  // Never commit unrelated staged work along with an automatically generated article.
  if (execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' }).trim()) {
    throw new Error('The Git index must be empty before article generation');
  }
  const writeTemplate = await fs.readFile('src/prompt/article-write.txt', 'utf8');
  const repairTemplate = await fs.readFile('src/prompt/article-repair.txt', 'utf8');
  const styleGuide = await fs.readFile('src/prompt/style-guide.txt', 'utf8');
  const heroPromptTemplate = await fs.readFile('src/prompt/hero-image.txt', 'utf8');

  const recent = await getRecentTitlesFS();

  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }

  const { article, heroImage } = await generateArticleAssets({
    apiKey,
    writeTemplate,
    repairTemplate,
    styleGuide,
    heroTemplate: heroPromptTemplate,
    recentTitles: recent,
    baseTopic: input.baseTopic,
    leadSourceUrl: input.leadSourceUrl,
    topicDescription: input.topicDescription,
    imageModel: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
    imageSize: (process.env.OPENAI_IMAGE_SIZE as any) || '1536x1024',
    imageStyle: (process.env.OPENAI_IMAGE_STYLE as any) || 'natural',
    imageQuality: (process.env.OPENAI_IMAGE_QUALITY as any) || 'medium',
    maxTokens: 7200,
  });

  try {
    article.tags = [input.topic];
    const { postPath, imagePath } = await assembleArticle({ article, heroImage, date: input.date });

    execFileSync('git', ['add', '--', postPath, imagePath]);
    execFileSync('git', ['commit', '-m', `Add generated article: ${article.title}`, '--', postPath, imagePath]);
    logEvent({ type: 'cli-complete', postPath, imagePath });
  } catch (err) {
    logError(err, { type: 'cli-error' });
    throw err;
  }
}

main().catch((err) => {
  logError(err, { type: 'cli-unhandled' });
  process.exit(1);
});
