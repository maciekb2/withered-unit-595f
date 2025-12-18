import { logEvent } from './logger';

export interface RecentPostSample {
  file: string;
  title: string;
  excerpt: string;
}

function extractTitle(content: string): string | null {
  const match = content.match(/title:\s*"?([^"\n]+)"?/);
  return match ? match[1].trim() : null;
}

function stripFrontmatter(md: string): string {
  if (!md.startsWith('---')) return md;
  const end = md.indexOf('\n---', 3);
  if (end === -1) return md;
  return md.slice(end + '\n---'.length).trim();
}

function firstParagraphs(md: string, count: number): string {
  const body = stripFrontmatter(md);
  const paras = body
    .split(/\n\s*\n/g)
    .map(p => p.trim())
    .filter(Boolean);
  return paras.slice(0, count).join('\n\n').slice(0, 1200);
}

export async function getRecentPostSamplesFromGitHub(
  repo: string,
  token: string,
  count = 2,
  paragraphCount = 2,
): Promise<RecentPostSample[]> {
  const url = `https://api.github.com/repos/${repo}/contents/src/content/blog`;
  logEvent({ type: 'github-recent-samples-list-request', url });
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'article-publisher',
    },
  });
  logEvent({ type: 'github-recent-samples-list-status', status: res.status });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`GitHub list request failed: ${res.status} ${msg}`);
  }

  const list: any[] = await res.json();
  const files = list
    .filter((f) => (f.name.endsWith('.md') || f.name.endsWith('.mdx')) && f.type === 'file')
    .map((f) => f.name)
    .sort()
    .reverse()
    .slice(0, Math.max(count, 1));

  const result: RecentPostSample[] = [];
  for (const name of files) {
    const fileUrl = `${url}/${encodeURIComponent(name)}`;
    const fileRes = await fetch(fileUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'article-publisher',
      },
    });
    logEvent({ type: 'github-recent-samples-file-status', file: name, status: fileRes.status });
    if (!fileRes.ok) continue;

    const data: any = await fileRes.json();
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    const title = extractTitle(content);
    if (!title) continue;

    result.push({
      file: name,
      title,
      excerpt: firstParagraphs(content, paragraphCount),
    });
    if (result.length >= count) break;
  }

  return result;
}

