import { logEvent, logError } from '../utils/logger';
import { buildDraftPrompt } from './prompts';
import type { Outline, Draft } from './types';
import { chat } from './openai';
import { guardrails } from './guardrails';

export interface GenerateDraftOptions {
  apiKey: string;
  outline: Outline;
  articlePrompt: string;
  model?: string;
  maxTokens?: number;
}

export async function generateDraft({ apiKey, outline, articlePrompt, model = 'gpt-4o', maxTokens }: GenerateDraftOptions): Promise<Draft> {
  const finalPrompt = buildDraftPrompt(outline, articlePrompt);

  logEvent({ type: 'draft-start' });
  try {
    const text = await chat(apiKey, {
      system: guardrails(),
      user: finalPrompt,
      temperature: 0.6,
      top_p: 0.9,
      max_tokens: maxTokens ?? 1200,
      model,
    });
    logEvent({ type: 'draft-complete' });
    return { markdown: text };
  } catch (err) {
    logError(err, { type: 'draft-error' });
    throw err;
  }
}
