import { generateHeroImage } from './heroImageGenerator';
import { publishArticleToGitHub } from './githubPublisher';
import { sendSlackMessage } from '../utils/slack';
import articleTemplate from '../prompt/article-content.txt?raw';
import heroTemplate from '../prompt/hero-image.txt?raw';
import { getRecentTitlesFromGitHub } from '../utils/recentTitlesGitHub';
import { slugify } from '../utils/slugify';
import { getHotTopics } from '../utils/hotTopics';
import { suggestArticleTopic } from './topicSuggester';
import { generateOutline } from '../pipeline/outline';
import { generateDraft } from '../pipeline/draft';
import { editDraft } from '../pipeline/edit';
import { formatFinal } from '../pipeline/format';
import { validateAntiHallucination } from '../pipeline/validators/content';
import type { FinalJson } from '../pipeline/types';

export interface GenerateAndPublishResult {
  article: FinalJson;
  slug: string;
}

export async function generateAndPublish(
  env: Env,
  controller?: { enqueue: (chunk: string) => void; close: () => void },
  promptPromise?: Promise<{ prompt: string; topic: string }>
): Promise<GenerateAndPublishResult> {
  const send = (log: string, data: Record<string, unknown> = {}) => {
    if (!controller) return;
    const message = JSON.stringify({ log, ...data });
    controller.enqueue(`data: ${message}\n\n`);
  };

  const keepAlive = setInterval(() => {
    controller?.enqueue(':keepalive\n\n');
  }, 20000);

  try {
    send('🚀 Startujemy! Pobieram listę ostatnich tytułów z GitHuba...');
    const recent = await getRecentTitlesFromGitHub(
      env.GITHUB_REPO,
      env.GITHUB_TOKEN,
    );
    send('📑 Pobrane tytuły', { recentTitles: recent });

    const hotTopics = await getHotTopics();
    send('🔥 Gorące tematy z ostatnich dni', {
      hotTopics: hotTopics.map(t => t.title),
    });

    let articlePrompt = articleTemplate.replace(
      '{recent_titles}',
      recent.map((t, i) => `${i + 1}. ${t}`).join('\n'),
    );

    let baseTopic = hotTopics[0]?.title || 'Aktualny temat';

    if (promptPromise) {
      const suggestions = await suggestArticleTopic(
        hotTopics,
        recent,
        env.OPENAI_API_KEY,
      );
      send('💡 Propozycje tematów', { topicSuggestions: suggestions });
      send('✏️ Możesz edytować prompt i wybrać temat', {
        articlePrompt,
        awaitingPrompt: true,
        topicSuggestions: suggestions,
      });
      const res = await promptPromise;
      articlePrompt = res.prompt;
      baseTopic = res.topic;
    }

    send('outline-start', { baseTopic });
    const outline = await generateOutline({
      apiKey: env.OPENAI_API_KEY,
      baseTopic,
      model: env.OPENAI_TEXT_MODEL || 'gpt-4o',
    });
    send('outline-end', { outline });

    send('draft-start');
    const draft = await generateDraft({
      apiKey: env.OPENAI_API_KEY,
      outline,
      articlePrompt,
      model: env.OPENAI_TEXT_MODEL || 'gpt-4o',
      maxTokens: 7200,
    });
    send('draft-end');

    send('edit-start');
    const edited = await editDraft({
      apiKey: env.OPENAI_API_KEY,
      draft,
      outline,
      model: env.OPENAI_TEXT_MODEL || 'gpt-4o',
      maxTokens: 7200,
    });
    send('edit-end', { title: edited.title });

    const validation = validateAntiHallucination(edited.markdown, outline);
    const warns = validation.errors.filter(e => e.startsWith('WARN'));
    if (warns.length) {
      send('⚠️ Ostrzeżenia walidatora', { warnings: warns });
    }
    if (!validation.ok) {
      const errs = validation.errors.filter(e => e.startsWith('ERROR'));
      send('❌ Błąd walidacji treści', { errors: errs });
      throw new Error('Content validation failed');
    }

    const article = formatFinal(edited);
    send(`✏️ Wygenerowano tytuł: ${article.title}`, { articleTitle: article.title });

    const heroPrompt = heroTemplate.replace('{title}', article.title);
    send('🎨 Tworzę obrazek do artykułu...', { heroPrompt });
    const heroImage = await generateHeroImage({
      apiKey: env.OPENAI_API_KEY,
      prompt: heroPrompt,
      style: (env.OPENAI_IMAGE_STYLE as any) || 'vivid',
      quality: (env.OPENAI_IMAGE_QUALITY as any) || 'hd',
    });

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
    clearInterval(keepAlive);
    controller?.close();
  }
}
