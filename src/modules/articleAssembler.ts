import fs from 'node:fs/promises';
import path from 'node:path';
import { slugify } from '../utils/slugify';
import { logEvent, logError } from '../utils/logger';
import type { FinalJson } from '../pipeline/types';
import { validateFinalJson, yamlEscape } from '../utils/validators';

export interface AssembleOptions {
  article: FinalJson;
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
  logEvent({ type: 'assemble-paths', blogDir, publicDir });
  const validation = validateFinalJson(article);
  if (!validation.ok) {
    logError(new Error('Final JSON validation failed'), {
      type: 'assemble-validate-error',
      errors: validation.errs,
    });
    throw new Error('Final JSON validation failed: ' + validation.errs.join('; '));
  }
  const postDate = date || new Date().toISOString().split('T')[0];
  const slug = slugify(article.title);

  await fs.mkdir(publicDir, { recursive: true });
  await fs.mkdir(blogDir, { recursive: true });
  logEvent({ type: 'assemble-dirs-ready' });

  const imageName = `${postDate}-${slug}.png`;
  const imagePath = path.join(publicDir, imageName);
  await fs.writeFile(imagePath, heroImage);

  const fm = [
    '---',
    `title: "${yamlEscape(article.title)}"`,
    `description: "${yamlEscape(article.description)}"`,
    `pubDate: "${postDate}"`,
    `heroImage: "/blog-images/${imageName}"`,
    'views: 0',
    'likes: 0',
    '---',
    '',
  ].join('\n');

  const postName = `${postDate}-${slug}.md`;
  const postPath = path.join(blogDir, postName);
  try {
    await fs.writeFile(postPath, fm + article.content);
    logEvent({ type: 'assemble-files-written', postPath, imagePath });
    logEvent({ type: 'assemble-complete', postPath, imagePath });
    return { postPath, imagePath };
  } catch (err) {
    logError(err, { type: 'assemble-error' });
    throw err;
  }
}
