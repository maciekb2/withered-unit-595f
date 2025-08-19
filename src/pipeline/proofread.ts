import { logEvent, logError } from '../utils/logger';
import { chat, type ChatMessage } from './openai';
import { guardrails } from './guardrails';
import { extractJson } from '../utils/json';
import type { Edited } from './types';

export interface ProofreadOptions {
  apiKey: string;
  edited: Edited;
  model?: string;
  maxTokens?: number;
}

export interface ProofreadResult {
  edited: Edited;
  messages: ChatMessage[];
  raw: string;
}

export async function proofread({ apiKey, edited, model = 'gpt-5', maxTokens }: ProofreadOptions): Promise<ProofreadResult> {
  const userPrompt = `Sprawdź gramatykę, stylistykę i naturalność poniższego artykułu po polsku. Usuń powtórzenia, przeredaguj zdania tak, aby brzmiały płynnie w całym tekście, nie zmieniając znaczenia ani faktów. Zwróć JSON { markdown, title, description }.\n\nTytuł: ${edited.title}\nOpis: ${edited.description}\n\nArtykuł:\n${edited.markdown}`;
  logEvent({ type: 'proofread-start' });
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
    });
    const json: Edited = extractJson<Edited>(text);
    if (json.title.length > 100 || json.description.length > 200) {
      throw new Error('Title or description too long');
    }
    if (/[#*_`]/.test(json.description)) {
      throw new Error('Description contains markdown');
    }
    logEvent({ type: 'proofread-complete' });
    return { edited: json, messages, raw: text };
  } catch (err) {
    logError(err, { type: 'proofread-error', raw: text });
    (err as any).prompt = userPrompt;
    (err as any).messages = messages;
    (err as any).raw = text;
    throw err;
  }
}
