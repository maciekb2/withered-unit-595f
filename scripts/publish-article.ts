import { generateArticle } from '../src/modules/articleGenerator';
import { generateHeroImage } from '../src/modules/heroImageGenerator';
import { assembleArticle } from '../src/modules/articleAssembler';
import { logEvent, logError } from '../src/utils/logger';
import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';

async function main() {
  logEvent({ type: 'cli-start' });
  const articlePrompt = await fs.readFile('src/prompt/article-content.txt', 'utf8');
  const heroPromptTemplate = await fs.readFile('src/prompt/hero-image.txt', 'utf8');

  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }

  const article = await generateArticle({ apiKey, prompt: articlePrompt });
  const heroPrompt = heroPromptTemplate.replace('{title}', article.title);
  const heroImage = await generateHeroImage({ apiKey, prompt: heroPrompt });

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
