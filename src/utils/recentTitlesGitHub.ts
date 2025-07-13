export async function getRecentTitlesFromGitHub(repo: string, token: string, count = 5): Promise<string[]> {
  const url = `https://api.github.com/repos/${repo}/contents/src/content/blog`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`GitHub list request failed: ${res.status}`);
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
    const fileRes = await fetch(`${url}/${encodeURIComponent(name)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!fileRes.ok) continue;
    const data: any = await fileRes.json();
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    const match = content.match(/title:\s*"?([^"\n]+)"?/);
    if (match) {
      titles.push(match[1].trim());
    }
  }
  return titles;
}
