import { logEvent, logError } from '../utils/logger';
import { buildEditPrompt } from './prompts';
import { scrubTodoClaims } from './scrubTodoClaims';
import type { Outline, Draft, Edited } from './types';
import { chat } from './openai';
import { guardrails } from './guardrails';

export interface EditDraftOptions {
  apiKey: string;
  draft: Draft;
  outline: Outline;
  model?: string;
  maxTokens?: number;
}

export async function editDraft({ apiKey, draft, outline, model = 'gpt-4o', maxTokens }: EditDraftOptions): Promise<Edited> {
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
    let jsonText = text;
    const match = /^```(?:json)?\n([\s\S]*?)\n```$/.exec(text);
    if (match) jsonText = match[1];
    const json: Edited = JSON.parse(jsonText);
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
    return result;
  } catch (err) {
    logError(err, { type: 'edit-error' });
    throw err;
  }
}
