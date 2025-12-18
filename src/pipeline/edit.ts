import { logEvent, logError } from '../utils/logger';
import { buildEditPrompt } from './prompts';
import { scrubTodoClaims } from './scrubTodoClaims';
import type { Outline, Draft, Edited } from './types';
import { chat, type ChatMessage } from './openai';
import { guardrails } from './guardrails';
import { extractJson } from '../utils/json';
import { editedJsonSchema } from './schemas';

export interface EditDraftOptions {
  apiKey: string;
  draft: Draft;
  outline: Outline;
  editTemplate?: string;
  model?: string;
  maxTokens?: number;
}

export interface EditDraftResult {
  edited: Edited;
  messages: ChatMessage[];
  raw: string;
}

export async function editDraft({ apiKey, draft, outline, editTemplate, model = 'gpt-5', maxTokens }: EditDraftOptions): Promise<EditDraftResult> {
  const userPrompt = buildEditPrompt(draft, outline, editTemplate);
  logEvent({ type: 'edit-start' });
  const messages: ChatMessage[] = [
    { role: 'system', content: guardrails() },
    { role: 'user', content: userPrompt },
  ];
  let text = '';
  try {
    text = await chat(apiKey, {
      messages,
      max_completion_tokens: maxTokens ?? 1000,
      model,
      response_style: 'full',
      response_format: { type: 'json_schema', json_schema: { name: 'edited', schema: editedJsonSchema } },
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
    return { edited: result, messages, raw: text };
  } catch (err) {
    logError(err, { type: 'edit-error', raw: text });
    (err as any).prompt = userPrompt;
    (err as any).messages = messages;
    (err as any).raw = text;
    throw err;
  }
}
