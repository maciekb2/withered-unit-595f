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
  logEvent({ type: 'github-response-repo', status: repoRes.status });
  if (!repoRes.ok) {
    const msg = await repoRes.text();
    throw new Error(`GitHub repo request failed: ${repoRes.status} ${msg}`);
  }
  const repo: any = await repoRes.json();

  const refRes = await fetch(`${repoUrl}/git/ref/heads/${repo.default_branch}`, {
    headers,
  });
  logEvent({ type: 'github-get-ref-status', status: refRes.status });
  if (!refRes.ok) {
    const msg = await refRes.text();
    throw new Error(`GitHub ref request failed: ${refRes.status} ${msg}`);
  }

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
    'views: 0',
    'likes: 0',
    '---',
    '',
    article.content,
  ].join('\n');

  try {
    logEvent({ type: 'github-create-branch', branch });
    const createRes = await retryFetch(`${repoUrl}/git/refs`, {

      method: 'POST',
      headers,
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: refData.object.sha }),
      retries: 2,
      retryDelayMs: 1000,
    });
    logEvent({ type: 'github-create-branch-status', status: createRes.status });
    if (!createRes.ok) {
      const msg = await createRes.text();
      throw new Error(`GitHub branch create failed: ${createRes.status} ${msg}`);
    }

    logEvent({ type: 'github-upload-post', file: postName });
    const postRes = await retryFetch(`${repoUrl}/contents/${encodeURIComponent(`src/content/blog/${postName}`)}`, {

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
    logEvent({ type: 'github-upload-post-status', status: postRes.status });
    if (!postRes.ok) {
      const msg = await postRes.text();
      throw new Error(`GitHub post upload failed: ${postRes.status} ${msg}`);
    }

    const heroBase64 = heroImage.toString('base64');
    logEvent({ type: 'github-upload-image', file: imageName });
    const imgRes = await retryFetch(`${repoUrl}/contents/${encodeURIComponent(`public/blog-images/${imageName}`)}`, {
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

    logEvent({ type: 'github-upload-image-status', status: imgRes.status });
    if (!imgRes.ok) {
      const msg = await imgRes.text();
      throw new Error(`GitHub image upload failed: ${imgRes.status} ${msg}`);
    }

    logEvent({ type: 'github-create-pr', branch });
    const prRes = await retryFetch(`${repoUrl}/pulls`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: `Automated post for ${postDate}`,
        head: branch,
        base: repo.default_branch,
        body: 'This PR was created automatically by a scheduled Cloudflare Worker.',
      }),
      retries: 2,
      retryDelayMs: 1000,
    });
    logEvent({ type: 'github-create-pr-status', status: prRes.status });
    if (!prRes.ok) {
      const msg = await prRes.text();
      throw new Error(`GitHub PR creation failed: ${prRes.status} ${msg}`);
    }
    const prData: any = await prRes.json();

    logEvent({ type: 'github-merge-pr', number: prData.number });
    const mergeRes = await retryFetch(`${repoUrl}/pulls/${prData.number}/merge`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        commit_title: `Auto merge for ${postDate}`,
        merge_method: 'squash',
      }),
      retries: 2,
      retryDelayMs: 1000,
    });
    logEvent({ type: 'github-merge-pr-status', status: mergeRes.status });
    if (!mergeRes.ok) {
      const msg = await mergeRes.text();
      throw new Error(`GitHub PR merge failed: ${mergeRes.status} ${msg}`);
    }

    logEvent({ type: 'github-publish-complete', post: postName, image: imageName, branch });
  } catch (err) {
    logError(err, { type: 'github-publish-error' });
    throw err;
  }
}
