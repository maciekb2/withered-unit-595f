import { generateOutline } from '../pipeline/outline';
import { generateDraft } from '../pipeline/draft';
import { editDraft } from '../pipeline/edit';
import { formatFinal } from '../pipeline/format';
import type { FinalJson } from '../pipeline/types';
import { generateHeroImage } from './heroImageGenerator';

export interface GenerateArticleAssetsOptions {
  apiKey: string;
  articleTemplate: string;
  heroTemplate: string;
  recentTitles: string[];
  baseTopic?: string;
  model?: string;
  maxTokens?: number;
}

export interface GenerateArticleAssetsResult {
  article: FinalJson;
  heroImage: Buffer;
}

export async function generateArticleAssets({
  apiKey,
  articleTemplate,
  heroTemplate,
  recentTitles,
  baseTopic = 'Aktualny temat',
  model,
  maxTokens,
}: GenerateArticleAssetsOptions): Promise<GenerateArticleAssetsResult> {
  const prompt = articleTemplate.replace(
    '{recent_titles}',
    recentTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')
  );

  const outlineRes = await generateOutline({ apiKey, baseTopic, model });
  const outline = outlineRes.outline;
  const draftRes = await generateDraft({
    apiKey,
    outline,
    articlePrompt: prompt,
    model,
    maxTokens,
  });
  const draft = draftRes.draft;
  const editRes = await editDraft({ apiKey, draft, outline, model, maxTokens });
  const edited = editRes.edited;
  const article = formatFinal(edited);

  const heroPrompt = heroTemplate.replace('{title}', article.title);
  const heroImage = await generateHeroImage({ apiKey, prompt: heroPrompt });
  return { article, heroImage };
}
