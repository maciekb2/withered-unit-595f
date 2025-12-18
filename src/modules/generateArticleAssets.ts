import { generateOutline } from '../pipeline/outline';
import { writeArticle } from '../pipeline/write';
import { formatFinal } from '../pipeline/format';
import type { FinalJson } from '../pipeline/types';
import { generateHeroImage } from './heroImageGenerator';
import { validateAntiHallucination } from '../pipeline/validators/content';
import { repairEdited } from '../pipeline/repair';
import { logEvent } from '../utils/logger';
import { buildContextPack } from '../pipeline/contextPack';

export interface GenerateArticleAssetsOptions {
  apiKey: string;
  writeTemplate: string;
  repairTemplate?: string;
  styleGuide?: string;
  heroTemplate: string;
  recentTitles: string[];
  baseTopic?: string;
  leadSourceUrl?: string;
  topicDescription?: string;
  model?: string;
  outlineModel?: string;
  writeModel?: string;
  repairModel?: string;
  maxRepairAttempts?: number;
  maxTokens?: number;
}

export interface GenerateArticleAssetsResult {
  article: FinalJson;
  heroImage: Buffer;
}

export async function generateArticleAssets({
  apiKey,
  writeTemplate,
  repairTemplate,
  styleGuide,
  heroTemplate,
  recentTitles,
  baseTopic = 'Aktualny temat',
  leadSourceUrl,
  topicDescription,
  model,
  outlineModel,
  writeModel,
  repairModel,
  maxRepairAttempts = 2,
  maxTokens,
}: GenerateArticleAssetsOptions): Promise<GenerateArticleAssetsResult> {
  const outlineModelFinal = outlineModel || model;
  const writeModelFinal = writeModel || model;
  const repairModelFinal = repairModel || writeModelFinal || model;

  const prompt = writeTemplate.replace(
    '{recent_titles}',
    recentTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')
  );

  const outlineRes = await generateOutline({ apiKey, baseTopic, model: outlineModelFinal, maxTokens: 2000 });
  const outline = outlineRes.outline;
  const fallbackUrl = 'https://example.com';
  const finalLeadUrl = leadSourceUrl || fallbackUrl;
  if (!leadSourceUrl) {
    logEvent({ type: 'cli-lead-source-missing', fallbackUrl });
  }
  const contextPack = buildContextPack({
    selectedTopic: { title: baseTopic, url: finalLeadUrl, description: topicDescription },
    hotTopics: [],
  });
  const writeRes = await writeArticle({
    apiKey,
    outline,
    writeTemplate: prompt,
    styleGuide,
    contextPack,
    model: writeModelFinal,
    maxTokens,
  });
  let edited = writeRes.edited;

  const validation = validateAntiHallucination(edited.markdown, outline);
  if (!validation.ok) {
    const errs = validation.errors.filter(e => e.startsWith('ERROR'));
    logEvent({ type: 'cli-content-validate-failed', errors: errs, stats: validation.stats });

    let fixed = false;
    for (let attempt = 1; attempt <= maxRepairAttempts; attempt++) {
      logEvent({ type: 'cli-repair-start', attempt, errors: errs });
      const repairRes = await repairEdited({
        apiKey,
        edited,
        outline,
        errors: errs,
        repairTemplate,
        styleGuide,
        contextPack,
        model: repairModelFinal || 'gpt-5',
        maxTokens: 2500,
      });
      edited = repairRes.edited;
      const after = validateAntiHallucination(edited.markdown, outline);
      if (after.ok) {
        logEvent({ type: 'cli-repair-complete', attempt, stats: after.stats });
        fixed = true;
        break;
      }
      const afterErrs = after.errors.filter(e => e.startsWith('ERROR'));
      logEvent({ type: 'cli-repair-still-failing', attempt, errors: afterErrs, stats: after.stats });
    }
    if (!fixed) {
      throw new Error(`Content validation failed: ${errs.join('; ')}`);
    }
  } else {
    logEvent({ type: 'cli-content-validate-ok', stats: validation.stats });
  }

  const article = formatFinal(edited);
  const heroPrompt = heroTemplate.replace('{title}', article.title);
  const heroImage = await generateHeroImage({ apiKey, prompt: heroPrompt });
  return { article, heroImage };
}
