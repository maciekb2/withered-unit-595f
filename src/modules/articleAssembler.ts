import fs from 'node:fs/promises';
import path from 'node:path';
import { slugify } from '../utils/slugify';
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
  await fs.writeFile(postPath, fm + article.content);

  return { postPath, imagePath };
}
