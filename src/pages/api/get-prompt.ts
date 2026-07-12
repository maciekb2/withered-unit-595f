import type { APIRoute } from 'astro';
import writeTemplate from '../../prompt/article-write.txt?raw';
import { getRecentTitlesFromGitHub } from '../../utils/recentTitlesGitHub';
import { nodeGenerationEnv } from '../../server/nodeEnv';
import { isPrivateGeneratorRequest } from '../../server/generatorAuth';
import { json } from '../../server/postgres';

export const GET: APIRoute = async ({ request }) => {
  if (!isPrivateGeneratorRequest(request)) return new Response('Forbidden', { status: 403 });
  const env = nodeGenerationEnv();
  const recent = await getRecentTitlesFromGitHub(env.GITHUB_REPO, env.GITHUB_TOKEN);
  return json({ prompt: writeTemplate.replace('{recent_titles}', recent.map((t, i) => `${i + 1}. ${t}`).join('\n')) });
};
