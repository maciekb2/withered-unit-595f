import { logEvent, logError } from '../utils/logger';
import { buildEditPrompt } from './prompts';
import { scrubTodoClaims } from './scrubTodoClaims';
import type { Outline, Draft, Edited } from './types';
import { chat } from './openai';
import { guardrails } from './guardrails';
import { extractJson } from '../utils/json';

export interface EditDraftOptions {
  apiKey: string;
  draft: Draft;
  outline: Outline;
  model?: string;
  maxTokens?: number;
}

export interface EditDraftResult {
  edited: Edited;
  prompt: string;
  raw: string;
}

export async function editDraft({ apiKey, draft, outline, model = 'gpt-4o', maxTokens }: EditDraftOptions): Promise<EditDraftResult> {

  const prompt = buildEditPrompt(draft, outline);
  logEvent({ type: 'edit-start' });
  try {
    const text = await chat(apiKey, {
      system: guardrails(),
      user: prompt,
      temperature: 0.2,
      top_p: 0.9,
      max_tokens: maxTokens ?? 1000,
      model,
    });
    const json: Edited = extractJson<Edited>(text);

    if (json.title.length > 100 || json.description.length > 200) {
      throw new Error('Title or description too long');
    }
    if (/[#*_`]/.test(json.description)) {
      throw new Error('Description contains markdown');
    }
    const { cleaned, removedCount } = scrubTodoClaims(json.markdown);
    if (removedCount > 0) {
      logEvent({ type: 'todo-claim-warning', removedCount });
    }
    const result: Edited = { ...json, markdown: cleaned };
    logEvent({ type: 'edit-complete', title: result.title });
    return { edited: result, prompt, raw: text };

  } catch (err) {
    logError(err, { type: 'edit-error' });
    throw err;
  }
}
