import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getPool, json } from '../../../server/postgres';
import { isPrivateGeneratorRequest } from '../../../server/generatorAuth';
import { validateSocialSource, type SocialSource } from '../../../social/types';

export const prerender = false;
const clean = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/[#*_`>\[\]()]/g, ' ').replace(/\s+/g, ' ').trim();

export const POST: APIRoute = async ({ request }) => {
  if (!await isPrivateGeneratorRequest(request)) return json({ error: 'Forbidden' }, 403);
  const posts = (await getCollection('blog'))
    .filter(post => !post.id.startsWith('_'))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
    .slice(0, 80);
  let inserted = 0;
  for (const post of posts) {
    const paragraphs = (post.body || '').split(/\n{2,}/).map(clean).filter(value => value.length >= 80 && !value.startsWith(post.data.title)).slice(0, 5);
    if (paragraphs.length < 3) continue;
    const publishedAt = post.data.pubDate.toISOString();
    const source: SocialSource = {
      slug: post.id,
      title: clean(post.data.title),
      lead: clean(post.data.description),
      summaryPoints: paragraphs,
      punchline: paragraphs.at(-1) || clean(post.data.description),
      tags: post.data.tags.slice(0, 6),
      heroUrl: new URL(post.data.heroImage || `/blog-images/${post.id}.png`, 'https://pseudointelekt.pl').toString(),
      articleUrl: `https://pseudointelekt.pl/blog/${post.id}/`,
      sourceUrl: post.data.sourceUrl,
      publishedAt,
    };
    if (validateSocialSource(source).length) continue;
    const result = await getPool().query(`INSERT INTO social_jobs(slug,source,status)
      VALUES($1,$2::jsonb,'candidate') ON CONFLICT(slug) DO UPDATE SET source=EXCLUDED.source,updated_at=now()
      RETURNING id`, [source.slug, JSON.stringify(source)]);
    inserted += result.rowCount || 0;
  }
  return json({ ok: true, candidates: inserted });
};
