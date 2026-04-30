import { generateHeroImage } from './heroImageGenerator';
import { publishArticleToGitHub } from './githubPublisher';
import { sendSlackMessage } from '../utils/slack';
import writeTemplate from '../prompt/article-write.txt?raw';
import repairTemplate from '../prompt/article-repair.txt?raw';
import styleGuide from '../prompt/style-guide.txt?raw';
import heroTemplate from '../prompt/hero-image.txt?raw';
import { getRecentTitlesFromGitHub } from '../utils/recentTitlesGitHub';
import { slugify } from '../utils/slugify';
import { getHotTopics } from '../utils/hotTopics';
import { suggestArticleTopic } from './topicSuggester';
import { generateOutline } from '../pipeline/outline';
import { writeArticle } from '../pipeline/write';
import { writeArticleSectioned } from '../pipeline/sectionedWrite';
import { formatFinal } from '../pipeline/format';
import { validateAntiHallucination } from '../pipeline/validators/content';
import { repairEdited } from '../pipeline/repair';
import { buildContextPack } from '../pipeline/contextPack';
import { textGenerationProviderFromEnv } from '../pipeline/openai';
import type { FinalJson } from '../pipeline/types';
import { logEvent, logError } from '../utils/logger';
import { classifyGenerationError, type ClassifiedGenerationError } from '../utils/openaiErrors';

export interface GenerateAndPublishResult {
  article: FinalJson;
  slug: string;
}

export interface GenerationAuditContext {
  source?: string;
  sessionId?: string;
  accessEmail?: string;
  accessSub?: string;
  accessAud?: string;
  [key: string]: unknown;
}

export async function generateAndPublish(
  env: Env,
  controller?: { enqueue: (chunk: string) => void; close: () => void },
  promptPromise?: Promise<{ topic: string }>,
  auditContext: GenerationAuditContext = {},
): Promise<GenerateAndPublishResult> {
  let currentStage = 'start';
  const send = (log: string, data: Record<string, unknown> = {}) => {
    if (!controller) return;
    logEvent({
      type: 'generation-stream-event',
      ...auditContext,
      log,
      ...data,
    });
    const message = JSON.stringify({ log, ...data });
    controller.enqueue(`data: ${message}\n\n`);
  };

  const setStage = (stage: string) => {
    currentStage = stage;
  };

  const keepAlive = setInterval(() => {
    controller?.enqueue(':keepalive\n\n');
  }, 10000);

  try {
    logEvent({
      type: 'generation-start',
      mode: promptPromise ? 'manual' : 'auto',
      ...auditContext,
    });

    const topicModel = env.OPENAI_TOPIC_MODEL || env.OPENAI_TEXT_MODEL || 'gpt-5';
    const outlineModel = env.OPENAI_OUTLINE_MODEL || env.OPENAI_TEXT_MODEL || 'gpt-5';
    const writeModel = env.OPENAI_DRAFT_MODEL || env.OPENAI_TEXT_MODEL || 'gpt-5';
    const repairModel = env.OPENAI_REPAIR_MODEL || env.OPENAI_TEXT_MODEL || 'gpt-5';
    const textProvider = textGenerationProviderFromEnv(env);
    const sectionedText = shouldUseSectionedText(env, textProvider);

    setStage('recent-titles');
    send('🚀 Startujemy! Pobieram listę ostatnich tytułów z GitHuba...');
    const recent = await getRecentTitlesFromGitHub(env.GITHUB_REPO, env.GITHUB_TOKEN);
    send('📑 Pobrane tytuły', { recentTitles: recent });

    setStage('hot-topics');
    const hotTopics = await getHotTopics();
    send('🔥 Gorące tematy z ostatnich dni', {
      hotTopics: hotTopics.map(t => t.title),
    });

    const writePrompt = writeTemplate.replace(
      '{recent_titles}',
      recent.map((t, i) => `${i + 1}. ${t}`).join('\n'),
    );

    let baseTopic = hotTopics[0]?.title || 'Aktualny temat';

    if (promptPromise) {
      setStage('suggest-topic');
      send('suggest-topic-start');
      send('🧠 Generuję propozycje tematów przy użyciu OpenAI...');
      let sugRes;
      try {
        sugRes = await suggestArticleTopic(
          hotTopics,
          recent,
          env.OPENAI_API_KEY,
          topicModel,
          textProvider,
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
      logEvent({
        type: 'generation-topic-selected',
        ...auditContext,
        topic: baseTopic,
      });
    } else {
      try {
        setStage('auto-topic');
        logEvent({ type: 'auto-topic-suggest-start' });
        const sugRes = await suggestArticleTopic(
          hotTopics,
          recent,
          env.OPENAI_API_KEY,
          topicModel,
          textProvider,
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
    const leadSourceUrl = matchedTopic?.url || hotTopics[0]?.url || 'https://example.com';
    const selectedTopic = matchedTopic
      ? {
          title: matchedTopic.title,
          url: leadSourceUrl,
          source: matchedTopic.source,
          published: matchedTopic.published,
          description: matchedTopic.description,
        }
      : { title: baseTopic, url: leadSourceUrl };
    const contextPack = buildContextPack({ selectedTopic, hotTopics });

    setStage('outline');
    send('outline-start', { baseTopic, hasTopicContext: Boolean(matchedTopic?.description) });
    let outlineRes;
    try {
      outlineRes = await generateOutline({
        apiKey: env.OPENAI_API_KEY,
        baseTopic,
        model: outlineModel,
        provider: textProvider,
        maxTokens: 2000,
        topicContext: contextPack,
      });
      send('outline-prompt', { prompt: outlineRes.messages });
      send('outline-response', { response: outlineRes.raw });
    } catch (err) {
      send('outline-error', {
        error: (err as Error).message,
        ...errorTelemetry(err, currentStage),
        prompt: (err as any).messages,
        response: (err as any).raw,
        debug: (err as any).debug,
      });
      throw err;
    }
    const outline = outlineRes.outline;
    send('outline-end', { outline });

    setStage(sectionedText ? 'sectioned-write' : 'write');
    send(sectionedText ? 'sectioned-write-start' : 'write-start');
    let writeRes;
    try {
      writeRes = sectionedText
        ? await writeArticleSectioned({
            apiKey: env.OPENAI_API_KEY,
            outline,
            writeTemplate: writePrompt,
            styleGuide,
            contextPack,
            model: writeModel,
            provider: textProvider,
            leadSourceUrl,
            paragraphsPerSection: Number.parseInt(env.TEXT_SECTION_PARAGRAPHS || '', 10) || 3,
            maxTokensPerCall: Number.parseInt(env.TEXT_SECTION_MAX_TOKENS || '', 10) || 1800,
          })
        : await writeArticle({
            apiKey: env.OPENAI_API_KEY,
            outline,
            writeTemplate: writePrompt,
            styleGuide,
            contextPack,
            model: writeModel,
            provider: textProvider,
            maxTokens: 7200,
          });
      send('write-prompt', { prompt: writeRes.messages });
      send('write-response', { response: writeRes.raw });
    } catch (err) {
      send('write-error', {
        error: (err as Error).message,
        ...errorTelemetry(err, currentStage),
        prompt: (err as any).messages,
        response: (err as any).raw,
      });
      throw err;
    }
    let edited = writeRes.edited;
    send('write-end', { title: edited.title });

    setStage('content-validation');
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
        setStage(`repair-${attempt}`);
        send('repair-start', { attempt, errors: errs });
        let repairRes;
        try {
          repairRes = await repairEdited({
            apiKey: env.OPENAI_API_KEY,
            edited,
            outline,
            errors: errs,
            repairTemplate,
            styleGuide,
            contextPack,
            model: repairModel,
            provider: textProvider,
            maxTokens: 2500,
          });
          send('repair-prompt', { attempt, prompt: repairRes.messages });
          send('repair-response', { attempt, response: repairRes.raw });
        } catch (err) {
          send('repair-error', {
            attempt,
            error: (err as Error).message,
            ...errorTelemetry(err, currentStage),
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
    setStage('hero-image');
    send('🎨 Tworzę obrazek do artykułu...', { heroPrompt });
    const heroImage = await generateHeroImage({
      apiKey: env.OPENAI_API_KEY,
      prompt: heroPrompt,
      model: env.OPENAI_IMAGE_MODEL || 'gpt-image-1-mini',
      size: (env.OPENAI_IMAGE_SIZE as any) || '1024x1024',
      style: (env.OPENAI_IMAGE_STYLE as any) || 'vivid',
      quality: (env.OPENAI_IMAGE_QUALITY as any) || 'low',
    });

    setStage('github-publish');
    send('📦 Publikuję na GitHubie...');
    const prUrl = await publishArticleToGitHub({ env, article, heroImage });

    const snippet = article.content.slice(0, 300);
    setStage('success-slack');
    await sendSlackMessage(
      env.SLACK_WEBHOOK_URL,
      `Nowy artykuł: ${article.title}\n${snippet}...\n${prUrl}`
    );

    send('🎉 Publikacja zakończona sukcesem!', {
      done: true,
      url: prUrl,
    });

    const slug = slugify(article.title);
    logEvent({
      type: 'generation-complete',
      ...auditContext,
      title: article.title,
      slug,
      url: prUrl,
    });

    return { article, slug };
  } catch (err) {
    const classified = classifyGenerationError(err);
    logError(err, {
      type: 'generation-error',
      stage: currentStage,
      errorCode: classified.code,
      errorTitle: classified.title,
      provider: classified.provider,
      retryable: classified.retryable,
      status: classified.status,
      openAIErrorCode: classified.openAIErrorCode,
      openAIErrorType: classified.openAIErrorType,
      ...auditContext,
    });
    send(`❌ ${classified.title}: ${classified.message}`, {
      failed: true,
      stage: currentStage,
      ...errorTelemetry(err, currentStage, classified),
    });
    if (classified.code === 'OPENAI_BILLING_QUOTA_EXCEEDED') {
      await notifyOpenAIBillingFailure(env, classified, currentStage, auditContext);
    }
    throw err;
  } finally {
    clearInterval(keepAlive);
    controller?.close();
  }
}

function errorTelemetry(
  error: unknown,
  stage: string,
  classified: ClassifiedGenerationError = classifyGenerationError(error),
): Record<string, unknown> {
  return {
    errorCode: classified.code,
    errorTitle: classified.title,
    errorMessage: classified.message,
    stage,
    retryable: classified.retryable,
    status: classified.status,
    provider: classified.provider,
    openAIErrorCode: classified.openAIErrorCode,
    openAIErrorType: classified.openAIErrorType,
  };
}

async function notifyOpenAIBillingFailure(
  env: Env,
  classified: ClassifiedGenerationError,
  stage: string,
  auditContext: GenerationAuditContext,
): Promise<void> {
  const lines = [
    '🚨 Pseudointelekt: generowanie zatrzymane przez billing OpenAI',
    `Kod: ${classified.code}`,
    `Etap: ${stage}`,
    `Opis: ${classified.message}`,
  ];

  if (classified.status) lines.push(`HTTP status: ${classified.status}`);
  if (classified.openAIErrorCode) lines.push(`OpenAI code: ${classified.openAIErrorCode}`);
  if (auditContext.accessEmail) lines.push(`Użytkownik: ${auditContext.accessEmail}`);
  if (auditContext.source) lines.push(`Źródło: ${auditContext.source}`);
  if (auditContext.sessionId) lines.push(`Session: ${auditContext.sessionId}`);

  await sendSlackMessage(env.SLACK_WEBHOOK_URL, lines.join('\n'));
}

function shouldUseSectionedText(env: Env, provider: ReturnType<typeof textGenerationProviderFromEnv>): boolean {
  const mode = env.TEXT_ARTICLE_PIPELINE || 'auto';
  if (mode === 'sectioned') return true;
  if (mode === 'one-shot') return false;
  return provider.type === 'jetson';
}
