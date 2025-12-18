import { logEvent, logError } from '../utils/logger';
import { chat, type ChatMessage } from './openai';
import { guardrails } from './guardrails';
import type { Outline, Edited } from './types';
import { extractJson } from '../utils/json';
import { scrubTodoClaims } from './scrubTodoClaims';
import { editedJsonSchema } from './schemas';

export interface WriteArticleOptions {
  apiKey: string;
  outline: Outline;
  writeTemplate: string;
  styleGuide?: string;
  contextPack?: string;
  model?: string;
  maxTokens?: number;
}

export interface WriteArticleResult {
  edited: Edited;
  messages: ChatMessage[];
  raw: string;
}

function sectionsText(outline: Outline): string {
  return outline.sections
    .map((s, i) => `${i + 1}. ${s.h2}\n${s.bullets.map(b => `- ${b}`).join('\n')}`)
    .join('\n');
}

function buildWritePrompt(outline: Outline, writeTemplate: string, styleGuide = '', contextPack = ''): string {
  const ctx = contextPack.trim() ? `KONTEKST (JSON):\n${contextPack.trim()}\n\n` : '';
  const style = styleGuide.trim() ? `STYLE GUIDE:\n${styleGuide.trim()}\n\n` : '';

  return (
    ctx +
    style +
    `OUTLINE:\nTytul: ${outline.finalTitle}\nOpis: ${outline.description}\nSekcje:\n${sectionsText(outline)}\n\n` +
    `${writeTemplate.trim()}\n`
  );
}

export async function writeArticle({
  apiKey,
  outline,
  writeTemplate,
  styleGuide,
  contextPack,
  model = 'gpt-5',
  maxTokens,
}: WriteArticleOptions): Promise<WriteArticleResult> {
  const userPrompt = buildWritePrompt(outline, writeTemplate, styleGuide, contextPack);
  logEvent({ type: 'write-start' });

  const messages: ChatMessage[] = [
    { role: 'system', content: guardrails() },
    { role: 'user', content: userPrompt },
  ];

  let text = '';
  try {
    text = await chat(apiKey, {
      messages,
      max_completion_tokens: maxTokens ?? 7200,
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
      logEvent({ type: 'todo-claim-warning', removedCount, stage: 'write' });
    }
    const result: Edited = { ...json, markdown: cleaned };
    logEvent({ type: 'write-complete', title: result.title });
    return { edited: result, messages, raw: text };
  } catch (err) {
    logError(err, { type: 'write-error', raw: text });
    (err as any).prompt = userPrompt;
    (err as any).messages = messages;
    (err as any).raw = text;
    throw err;
  }
}

