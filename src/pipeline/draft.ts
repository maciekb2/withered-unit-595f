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

export interface GenerateDraftResult {
  draft: Draft;
  prompt: string;
  raw: string;
}

export async function generateDraft({ apiKey, outline, articlePrompt, model = 'gpt-5', maxTokens }: GenerateDraftOptions): Promise<GenerateDraftResult> {
  const finalPrompt = buildDraftPrompt(outline, articlePrompt);

  logEvent({ type: 'draft-start' });
  let text = '';
  try {
    text = await chat(apiKey, {
      system: guardrails(),
      user: finalPrompt,
      max_completion_tokens: maxTokens ?? 1200,
      model,
    });
    logEvent({ type: 'draft-complete' });
    return { draft: { markdown: text }, prompt: finalPrompt, raw: text };
  } catch (err) {
    logError(err, { type: 'draft-error', raw: text });
    (err as any).prompt = finalPrompt;
    (err as any).raw = text;
    throw err;
  }
}
