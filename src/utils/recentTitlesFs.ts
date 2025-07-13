import fs from 'node:fs/promises';
import path from 'node:path';

export async function getRecentTitlesFS(blogDir = 'src/content/blog', count = 5): Promise<string[]> {
  const files = (await fs.readdir(blogDir))
    .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
    .sort()
    .reverse()
    .slice(0, count);
  const titles: string[] = [];
  for (const file of files) {
    try {
      const text = await fs.readFile(path.join(blogDir, file), 'utf8');
      const match = text.match(/title:\s*"?([^"\n]+)"?/);
      if (match) {
        titles.push(match[1].trim());
      }
    } catch {
      // ignore
    }
  }
  return titles;
}
