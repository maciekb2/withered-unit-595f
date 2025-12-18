import { generateArticleAssets } from '../src/modules/generateArticleAssets';
import { assembleArticle } from '../src/modules/articleAssembler';
import { logEvent, logError } from '../src/utils/logger';
import { getRecentTitlesFS } from '../src/utils/recentTitlesFs';
import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';

async function main() {
  logEvent({ type: 'cli-start' });
  const writeTemplate = await fs.readFile('src/prompt/article-write.txt', 'utf8');
  const repairTemplate = await fs.readFile('src/prompt/article-repair.txt', 'utf8');
  const styleGuide = await fs.readFile('src/prompt/style-guide.txt', 'utf8');
  const heroPromptTemplate = await fs.readFile('src/prompt/hero-image.txt', 'utf8');

  const recent = await getRecentTitlesFS();

  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }

  const baseTopic = process.env.BASE_TOPIC || 'Aktualny temat';
  const leadSourceUrl = process.env.LEAD_SOURCE_URL;

  const { article, heroImage } = await generateArticleAssets({
    apiKey,
    writeTemplate,
    repairTemplate,
    styleGuide,
    heroTemplate: heroPromptTemplate,
    recentTitles: recent,
    baseTopic,
    leadSourceUrl,
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
