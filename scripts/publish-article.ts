import { generateArticle } from '../src/modules/articleGenerator';
import { generateHeroImage } from '../src/modules/heroImageGenerator';
import { assembleArticle } from '../src/modules/articleAssembler';
import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';

async function main() {
  const articlePrompt = await fs.readFile('src/prompt/article-content.txt', 'utf8');
  const heroPromptTemplate = await fs.readFile('src/prompt/hero-image.txt', 'utf8');

  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }

  const article = await generateArticle({ apiKey, prompt: articlePrompt });
  const heroPrompt = heroPromptTemplate.replace('{title}', article.title);
  const heroImage = await generateHeroImage({ apiKey, prompt: heroPrompt });

  const { postPath, imagePath } = await assembleArticle({ article, heroImage });

  execSync(`git add ${postPath} ${imagePath}`);
  execSync(`git commit -m "Add generated article: ${article.title}"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
