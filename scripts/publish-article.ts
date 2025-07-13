import { generateArticleAssets } from '../src/modules/generateArticleAssets';
import { assembleArticle } from '../src/modules/articleAssembler';
import { logEvent, logError } from '../src/utils/logger';
import { getRecentTitlesFS } from '../src/utils/recentTitlesFs';
import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';

async function main() {
  logEvent({ type: 'cli-start' });
  const articleTemplate = await fs.readFile('src/prompt/article-content.txt', 'utf8');
  const heroPromptTemplate = await fs.readFile('src/prompt/hero-image.txt', 'utf8');

  const recent = await getRecentTitlesFS();

  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }

  const { article, heroImage } = await generateArticleAssets({
    apiKey,
    articleTemplate,
    heroTemplate: heroPromptTemplate,
    recentTitles: recent,
    maxTokens: 7200,
  });

  try {
    const { postPath, imagePath } = await assembleArticle({ article, heroImage });

    execSync(`git add ${postPath} ${imagePath}`);
    execSync(`git commit -m "Add generated article: ${article.title}"`);
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
