import { generateArticle } from './articleGenerator';
import { generateHeroImage } from './heroImageGenerator';
import { publishArticleToGitHub } from './githubPublisher';
import { sendSlackMessage } from '../utils/slack';
import articleTemplate from '../prompt/article-content.txt?raw';
import heroTemplate from '../prompt/hero-image.txt?raw';
import { getRecentTitlesFromGitHub } from '../utils/recentTitlesGitHub';
import { slugify } from '../utils/slugify';
import type { ArticleResult } from './articleGenerator';

export interface GenerateAndPublishResult {
  article: ArticleResult;
  slug: string;
}

export async function generateAndPublish(
  env: Env,
  controller?: { enqueue: (chunk: string) => void; close: () => void }
): Promise<GenerateAndPublishResult> {
  const send = (log: string, data: Record<string, unknown> = {}) => {
    if (!controller) return;
    const message = JSON.stringify({ log, ...data });
    controller.enqueue(`data: ${message}\n\n`);
  };

  try {
    send('🚀 Startujemy! Pobieram listę ostatnich tytułów z GitHuba...');
    const recent = await getRecentTitlesFromGitHub(env.GITHUB_REPO, env.GITHUB_TOKEN);
    send('📑 Pobrane tytuły', { recentTitles: recent });

    const finalPrompt = articleTemplate.replace(
      '{recent_titles}',
      recent.map((t, i) => `${i + 1}. ${t}`).join('\n')
    );

    send('🧠 Generuję treść artykułu...', { articlePrompt: finalPrompt });
    const article = await generateArticle({
      apiKey: env.OPENAI_API_KEY,
      prompt: articleTemplate,
      recentTitles: recent,
      maxTokens: 7200,
    });
    send(`✏️ Wygenerowano tytuł: ${article.title}`, { articleTitle: article.title });

    const heroPrompt = heroTemplate.replace('{title}', article.title);
    send('🎨 Tworzę obrazek do artykułu...', { heroPrompt });
    const heroImage = await generateHeroImage({ apiKey: env.OPENAI_API_KEY, prompt: heroPrompt });

    send('📦 Publikuję na GitHubie...');
    const prUrl = await publishArticleToGitHub({ env, article, heroImage });

    const snippet = article.content.slice(0, 300);
    await sendSlackMessage(
      env.SLACK_WEBHOOK_URL,
      `Nowy artykuł: ${article.title}\n${snippet}...\n${prUrl}`
    );

    send('🎉 Publikacja zakończona sukcesem!', {
      done: true,
      url: prUrl,
    });

    return { article, slug: slugify(article.title) };
  } catch (err) {
    send(`❌ Błąd: ${(err as Error).message}`);
    throw err;
  } finally {
    controller?.close();
  }
}
