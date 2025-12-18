import { generateOutline } from '../pipeline/outline';
import { generateDraft } from '../pipeline/draft';
import { editDraft } from '../pipeline/edit';
import { formatFinal } from '../pipeline/format';
import type { FinalJson } from '../pipeline/types';
import { generateHeroImage } from './heroImageGenerator';
import { validateAntiHallucination } from '../pipeline/validators/content';
import { repairEdited } from '../pipeline/repair';
import { logEvent } from '../utils/logger';

export interface GenerateArticleAssetsOptions {
  apiKey: string;
  articleTemplate: string;
  editTemplate?: string;
  heroTemplate: string;
  recentTitles: string[];
  baseTopic?: string;
  model?: string;
  outlineModel?: string;
  draftModel?: string;
  editModel?: string;
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
  articleTemplate,
  editTemplate,
  heroTemplate,
  recentTitles,
  baseTopic = 'Aktualny temat',
  model,
  outlineModel,
  draftModel,
  editModel,
  repairModel,
  maxRepairAttempts = 2,
  maxTokens,
}: GenerateArticleAssetsOptions): Promise<GenerateArticleAssetsResult> {
  const outlineModelFinal = outlineModel || model;
  const draftModelFinal = draftModel || model;
  const editModelFinal = editModel || model;
  const repairModelFinal = repairModel || editModelFinal || model;

  const prompt = articleTemplate.replace(
    '{recent_titles}',
    recentTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')
  );

  const outlineRes = await generateOutline({ apiKey, baseTopic, model: outlineModelFinal, maxTokens: 2000 });
  const outline = outlineRes.outline;
  const draftRes = await generateDraft({
    apiKey,
    outline,
    articlePrompt: prompt,
    model: draftModelFinal,
    maxTokens,
  });
  const draft = draftRes.draft;
  const editRes = await editDraft({ apiKey, draft, outline, editTemplate, model: editModelFinal, maxTokens });
  let edited = editRes.edited;

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
        editTemplate,
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
