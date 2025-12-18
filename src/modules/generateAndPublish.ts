import { generateHeroImage } from './heroImageGenerator';
import { publishArticleToGitHub } from './githubPublisher';
import { sendSlackMessage } from '../utils/slack';
import articleTemplate from '../prompt/article-content.txt?raw';
import editTemplate from '../prompt/article-edit.txt?raw';
import heroTemplate from '../prompt/hero-image.txt?raw';
import { getRecentTitlesFromGitHub } from '../utils/recentTitlesGitHub';
import { getRecentPostSamplesFromGitHub } from '../utils/recentPostsGitHub';
import { slugify } from '../utils/slugify';
import { getHotTopics } from '../utils/hotTopics';
import { suggestArticleTopic } from './topicSuggester';
import { generateOutline } from '../pipeline/outline';
import { generateDraft } from '../pipeline/draft';
import { editDraft } from '../pipeline/edit';
import { formatFinal } from '../pipeline/format';
import { validateAntiHallucination } from '../pipeline/validators/content';
import { repairEdited } from '../pipeline/repair';
import { buildContextPack } from '../pipeline/contextPack';
import type { FinalJson } from '../pipeline/types';
import { logEvent, logError } from '../utils/logger';

export interface GenerateAndPublishResult {
  article: FinalJson;
  slug: string;
}

export async function generateAndPublish(
  env: Env,
  controller?: { enqueue: (chunk: string) => void; close: () => void },
  promptPromise?: Promise<{ topic: string }>
): Promise<GenerateAndPublishResult> {
  const send = (log: string, data: Record<string, unknown> = {}) => {
    if (!controller) return;
    const message = JSON.stringify({ log, ...data });
    controller.enqueue(`data: ${message}\n\n`);
  };

  const keepAlive = setInterval(() => {
    controller?.enqueue(':keepalive\n\n');
  }, 10000);

  try {
    const topicModel = env.OPENAI_TOPIC_MODEL || env.OPENAI_TEXT_MODEL || 'gpt-5';
    const outlineModel = env.OPENAI_OUTLINE_MODEL || env.OPENAI_TEXT_MODEL || 'gpt-5';
    const draftModel = env.OPENAI_DRAFT_MODEL || env.OPENAI_TEXT_MODEL || 'gpt-5';
    const editModel = env.OPENAI_EDIT_MODEL || env.OPENAI_TEXT_MODEL || 'gpt-5';
    const repairModel = env.OPENAI_REPAIR_MODEL || editModel;

    send('🚀 Startujemy! Pobieram listę ostatnich tytułów z GitHuba...');
    const recent = await getRecentTitlesFromGitHub(env.GITHUB_REPO, env.GITHUB_TOKEN);
    const recentSamples = await getRecentPostSamplesFromGitHub(env.GITHUB_REPO, env.GITHUB_TOKEN, 2, 2);
    send('📑 Pobrane tytuły', { recentTitles: recent });
    send('🧾 Próbki stylu z bloga', { samples: recentSamples.map(s => ({ title: s.title })) });

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
      send('suggest-topic-start');
      send('🧠 Generuję propozycje tematów przy użyciu OpenAI...');
      let sugRes;
      try {
        sugRes = await suggestArticleTopic(
          hotTopics,
          recent,
          env.OPENAI_API_KEY,
          topicModel,
        );
        send('suggest-topic-prompt', { prompt: sugRes.messages });
        send('suggest-topic-response', { response: sugRes.raw });
      } catch (err) {
        send('suggest-topic-error', {
          error: (err as Error).message,
          prompt: (err as any).messages,
          response: (err as any).raw,
          debug: (err as any).debug,
          parsed: (err as any).parsed,
        });
        throw err;
      }
      const suggestions = sugRes.suggestions;
      send('💡 Propozycje tematów', { topicSuggestions: suggestions });
      send('✏️ Wybierz temat lub wpisz własny', {
        awaitingTopic: true,
        topicSuggestions: suggestions,
      });
      const res = await promptPromise;
      baseTopic = res.topic || baseTopic;
    } else {
      try {
        logEvent({ type: 'auto-topic-suggest-start' });
        const sugRes = await suggestArticleTopic(
          hotTopics,
          recent,
          env.OPENAI_API_KEY,
          topicModel,
        );
        const suggestions = sugRes.suggestions || [];
        logEvent({
          type: 'auto-topic-suggest-complete',
          count: suggestions.length,
          suggestions: suggestions.map(s => s.title),
        });
        const first = suggestions[0];
        if (first?.title) {
          baseTopic = first.title;
          logEvent({ type: 'auto-topic-selected', topic: baseTopic });
        } else {
          logEvent({ type: 'auto-topic-fallback', topic: baseTopic });
        }
      } catch (err) {
        logError(err, { type: 'auto-topic-error' });
      }
    }

    const matchedTopic = hotTopics.find(t => t.title === baseTopic);
    const selectedTopic = matchedTopic
      ? {
          title: matchedTopic.title,
          url: matchedTopic.url,
          source: matchedTopic.source,
          published: matchedTopic.published,
          description: matchedTopic.description,
        }
      : { title: baseTopic };
    const contextPack = buildContextPack({
      selectedTopic,
      hotTopics,
      recentPostSamples: recentSamples,
    });

    const editTemplateWithContext =
      `${editTemplate}\n\nKontekst (JSON) — jeśli zostawiasz zdanie z liczbą/datą/raportem, postaraj się użyć URL z kontekstu; inaczej usuń konkret.\n${contextPack}\n`;

    send('outline-start', { baseTopic, hasTopicContext: Boolean(matchedTopic?.description) });
    let outlineRes;
    try {
      outlineRes = await generateOutline({
        apiKey: env.OPENAI_API_KEY,
        baseTopic,
        model: outlineModel,
        maxTokens: 2000,
        topicContext: contextPack,
      });
      send('outline-prompt', { prompt: outlineRes.messages });
      send('outline-response', { response: outlineRes.raw });
    } catch (err) {
      send('outline-error', {
        error: (err as Error).message,
        prompt: (err as any).messages,
        response: (err as any).raw,
        debug: (err as any).debug,
      });
      throw err;
    }
    const outline = outlineRes.outline;
    send('outline-end', { outline });

    send('draft-start');
    let draftRes;
    try {
      draftRes = await generateDraft({
        apiKey: env.OPENAI_API_KEY,
        outline,
        articlePrompt,
        contextPack,
        model: draftModel,
        maxTokens: 7200,
      });
      send('draft-prompt', { prompt: draftRes.messages });
      send('draft-response', { response: draftRes.raw });
    } catch (err) {
      send('draft-error', {
        error: (err as Error).message,
        prompt: (err as any).messages,
        response: (err as any).raw,
      });
      throw err;
    }
    const draft = draftRes.draft;
    send('draft-end');

    send('edit-start');
    let editRes;
    try {
      editRes = await editDraft({
        apiKey: env.OPENAI_API_KEY,
        draft,
        outline,
        editTemplate: editTemplateWithContext,
        model: editModel,
        maxTokens: 7200,
      });
      send('edit-prompt', { prompt: editRes.messages });
      send('edit-response', { response: editRes.raw });
    } catch (err) {
      send('edit-error', {
        error: (err as Error).message,
        prompt: (err as any).messages,
        response: (err as any).raw,
      });
      throw err;
    }
    let edited = editRes.edited;
    send('edit-end', { title: edited.title });

    const validation = validateAntiHallucination(edited.markdown, outline);
    const warns = validation.errors.filter(e => e.startsWith('WARN'));
    if (warns.length) {
      send('⚠️ Ostrzeżenia walidatora', {
        warnings: warns,
        stats: validation.stats,
      });
    }
    if (!validation.ok) {
      const errs = validation.errors.filter(e => e.startsWith('ERROR'));
      send('❌ Błąd walidacji treści', { errors: errs, stats: validation.stats });

      let fixed = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        send('repair-start', { attempt, errors: errs });
        let repairRes;
        try {
          repairRes = await repairEdited({
            apiKey: env.OPENAI_API_KEY,
            edited,
            outline,
            errors: errs,
            editTemplate: editTemplateWithContext,
            model: repairModel,
            maxTokens: 2500,
          });
          send('repair-prompt', { attempt, prompt: repairRes.messages });
          send('repair-response', { attempt, response: repairRes.raw });
        } catch (err) {
          send('repair-error', {
            attempt,
            error: (err as Error).message,
            prompt: (err as any).messages,
            response: (err as any).raw,
          });
          break;
        }

        edited = repairRes.edited;
        const after = validateAntiHallucination(edited.markdown, outline);
        if (after.ok) {
          send('repair-end', { attempt, ok: true, stats: after.stats });
          fixed = true;
          break;
        } else {
          const afterErrs = after.errors.filter(e => e.startsWith('ERROR'));
          send('repair-end', { attempt, ok: false, errors: afterErrs, stats: after.stats });
        }
      }

      if (!fixed) {
        throw new Error(`Content validation failed: ${errs.join('; ')}`);
      }
    } else {
      send('✅ Walidacja treści OK', { stats: validation.stats });
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
