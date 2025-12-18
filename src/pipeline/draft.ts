import { logEvent, logError } from '../utils/logger';
import { buildDraftPrompt } from './prompts';
import type { Outline, Draft } from './types';
import { chat, type ChatMessage } from './openai';
import { guardrails } from './guardrails';

export interface GenerateDraftOptions {
  apiKey: string;
  outline: Outline;
  articlePrompt: string;
  contextPack?: string;
  model?: string;
  maxTokens?: number;
}

export interface GenerateDraftResult {
  draft: Draft;
  messages: ChatMessage[];
  raw: string;
}

export async function generateDraft({ apiKey, outline, articlePrompt, contextPack, model = 'gpt-5', maxTokens }: GenerateDraftOptions): Promise<GenerateDraftResult> {
  const userPrompt = buildDraftPrompt(outline, articlePrompt, contextPack);

  logEvent({ type: 'draft-start' });
  const messages: ChatMessage[] = [
    { role: 'system', content: guardrails() },
    { role: 'user', content: userPrompt },
  ];
  let text = '';
  try {
    text = await chat(apiKey, {
      messages,
      max_completion_tokens: maxTokens ?? 1200,
      model,
      response_style: 'full',
    });
    logEvent({ type: 'draft-complete' });
    return { draft: { markdown: text }, messages, raw: text };
  } catch (err) {
    logError(err, { type: 'draft-error', raw: text });
    (err as any).prompt = userPrompt;
    (err as any).messages = messages;
    (err as any).raw = text;
    throw err;
  }
}
