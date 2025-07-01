import fs from 'node:fs/promises';
import path from 'node:path';
import { slugify } from '../utils/slugify';
import { logEvent, logError } from '../utils/logger';
import type { ArticleResult } from './articleGenerator';

export interface AssembleOptions {
  article: ArticleResult;
  heroImage: Buffer;
  blogDir?: string;
  publicDir?: string;
  date?: string;
}

export async function assembleArticle({
  article,
  heroImage,
  blogDir = 'src/content/blog',
  publicDir = 'public/blog-images',
  date,
}: AssembleOptions): Promise<{ postPath: string; imagePath: string }> {
  logEvent({ type: 'assemble-start', title: article.title });
  const postDate = date || new Date().toISOString().split('T')[0];
  const slug = slugify(article.title);

  await fs.mkdir(publicDir, { recursive: true });
  await fs.mkdir(blogDir, { recursive: true });

  const imageName = `${postDate}-${slug}.png`;
  const imagePath = path.join(publicDir, imageName);
  await fs.writeFile(imagePath, heroImage);

  const fm = [
    '---',
    `title: "${article.title}"`,
    `description: "${article.description}"`,
    `pubDate: "${postDate}"`,
    `heroImage: "/blog-images/${imageName}"`,
    '---',
    '',
  ].join('\n');

  const postName = `${postDate}-${slug}.md`;
  const postPath = path.join(blogDir, postName);
  try {
    await fs.writeFile(postPath, fm + article.content);
    logEvent({ type: 'assemble-complete', postPath, imagePath });
    return { postPath, imagePath };
  } catch (err) {
    logError(err, { type: 'assemble-error' });
    throw err;
  }
}
