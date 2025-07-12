import { slugify } from '../utils/slugify';
import { logEvent, logError } from '../utils/logger';
import { retryFetch } from '../utils/retryFetch';
import type { ArticleResult } from './articleGenerator';

export interface PublishOptions {
  env: Env;
  article: ArticleResult;
  heroImage: Buffer;
  date?: string;
}

export async function publishArticleToGitHub({ env, article, heroImage, date }: PublishOptions): Promise<void> {
  logEvent({ type: 'github-publish-start', title: article.title });
  const postDate = date || new Date().toISOString().split('T')[0];
  const slug = slugify(article.title);
  const repoUrl = `https://api.github.com/repos/${env.GITHUB_REPO}`;
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    'User-Agent': 'article-publisher',
    'Content-Type': 'application/json',
  };
  logEvent({ type: 'github-request-repo' });
  const repoRes = await retryFetch(repoUrl, { headers, retries: 2, retryDelayMs: 1000 });
  const repo: any = await repoRes.json();
  logEvent({ type: 'github-response-repo', status: repoRes.status });

  const refRes = await fetch(`${repoUrl}/git/ref/heads/${repo.default_branch}`, {
    headers,
  });
  const refData: any = await refRes.json();
  const branch = `auto-${postDate.replace(/-/g, '')}`;

  const imageName = `${postDate}-${slug}.png`;
  const postName = `${postDate}-${slug}.md`;
  const markdown = [
    '---',
    `title: "${article.title}"`,
    `description: "${article.description}"`,
    `pubDate: "${postDate}"`,
    `heroImage: "/blog-images/${imageName}"`,
    '---',
    '',
    article.content,
  ].join('\n');

  try {
    logEvent({ type: 'github-create-branch', branch });
    await fetch(`${repoUrl}/git/refs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: refData.object.sha }),
    });

    logEvent({ type: 'github-upload-post', file: postName });
    await retryFetch(`${repoUrl}/contents/${encodeURIComponent(`src/content/blog/${postName}`)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Add post for ${postDate}`,
        content: btoa(markdown),
        branch,
      }),
      retries: 2,
      retryDelayMs: 1000,
    });

  const heroBase64 = heroImage.toString('base64');
    logEvent({ type: 'github-upload-image', file: imageName });
    await retryFetch(`${repoUrl}/contents/${encodeURIComponent(`public/blog-images/${imageName}`)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Add hero image for ${postDate}`,
        content: heroBase64,
        branch,
      }),
      retries: 2,
      retryDelayMs: 1000,
    });

    await fetch(`${repoUrl}/pulls`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: `Automated post for ${postDate}`,
        head: branch,
        base: repo.default_branch,
        body: 'This PR was created automatically by a scheduled Cloudflare Worker.',
      }),
    });

    logEvent({ type: 'github-publish-complete', post: postName, image: imageName, branch });
  } catch (err) {
    logError(err, { type: 'github-publish-error' });
    throw err;
  }
}
