import { logEvent } from './logger';

export async function getRecentTitlesFromGitHub(
  repo: string,
  token: string,
  count = 5
): Promise<string[]> {
  const url = `https://api.github.com/repos/${repo}/contents/src/content/blog`;
  logEvent({ type: 'github-recent-list-request', url });
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'article-publisher',
    },
  });
  logEvent({ type: 'github-recent-list-status', status: res.status });
  if (!res.ok) {
    const msg = await res.text();
    logEvent({ type: 'github-recent-list-error', status: res.status, message: msg });
    throw new Error(`GitHub list request failed: ${res.status} ${msg}`);
  }
  const list: any[] = await res.json();
  const files = list
    .filter((f) => (f.name.endsWith('.md') || f.name.endsWith('.mdx')) && f.type === 'file')
    .map((f) => f.name)
    .sort()
    .reverse()
    .slice(0, count);
  const titles: string[] = [];
  for (const name of files) {
    const fileUrl = `${url}/${encodeURIComponent(name)}`;
    const fileRes = await fetch(fileUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'article-publisher',
      },
    });
    logEvent({ type: 'github-recent-file-status', file: name, status: fileRes.status });
    if (!fileRes.ok) {
      const msg = await fileRes.text();
      logEvent({ type: 'github-recent-file-error', file: name, status: fileRes.status, message: msg });
      continue;
    }
    const data: any = await fileRes.json();
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    const match = content.match(/title:\s*"?([^"\n]+)"?/);
    if (match) {
      titles.push(match[1].trim());
    }
  }
  return titles;
}
