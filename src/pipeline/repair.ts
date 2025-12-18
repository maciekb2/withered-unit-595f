import { logEvent, logError } from '../utils/logger';
import { chat, type ChatMessage } from './openai';
import { guardrails } from './guardrails';
import type { Outline, Edited } from './types';
import { extractJson } from '../utils/json';
import { scrubTodoClaims } from './scrubTodoClaims';
import { editedJsonSchema } from './schemas';

export interface RepairEditedOptions {
  apiKey: string;
  edited: Edited;
  outline: Outline;
  errors: string[];
  repairTemplate?: string;
  styleGuide?: string;
  contextPack?: string;
  model?: string;
  maxTokens?: number;
}

export interface RepairEditedResult {
  edited: Edited;
  messages: ChatMessage[];
  raw: string;
}

function buildRepairPrompt(
  edited: Edited,
  outline: Outline,
  errors: string[],
  repairTemplate = '',
  styleGuide = '',
  contextPack = '',
): string {
  const h2List = outline.sections.map(s => `- ## ${s.h2}`).join('\n');
  const ctx = contextPack.trim() ? `\n\nKONTEKST (JSON):\n${contextPack.trim()}\n` : '';
  const style = styleGuide.trim() ? `\n\nSTYLE GUIDE:\n${styleGuide.trim()}\n` : '';
  const templateBlock = repairTemplate.trim() ? `\n\nInstrukcje naprawy:\n${repairTemplate.trim()}\n` : '';

  return (
    `Napraw ponizszy artykul zgodnie z bledami walidacji. ` +
    `Nie dodawaj nowych faktow ani zrodel; mozesz tylko usuwac, uogolniac i przeredagowywac zdania, aby spelnic reguly. ` +
    `Zachowaj tytul i opis DOKLADNIE jak podano.\n\n` +
    `Bledy walidacji:\n${errors.map(e => `- ${e}`).join('\n')}\n\n` +
    `Wymagane naglowki sekcji (musza wystapic w tekscie dokladnie jako linie zaczynajace sie od "## "):\n${h2List}\n\n` +
    `Twarde reguly:\n` +
    `- W finalnym tekscie nie moze pozostac [[TODO-CLAIM]].\n` +
    `- W calym tekscie ma byc dokladnie 1 URL: leadSourceUrl z kontekstu (i zadnych innych).\n` +
    `- Jesli pojawia sie niepewna liczba/data/raport — uogolnij; nie dopisuj nowych danych.\n` +
    templateBlock +
    ctx +
    style +
    `\nTytul: ${edited.title}\nOpis: ${edited.description}\n\n` +
    `Artykul:\n${edited.markdown}\n\n` +
    `Zwracaj JSON { markdown, title, description } bez dodatkowego tekstu.`
  );
}

export async function repairEdited({
  apiKey,
  edited,
  outline,
  errors,
  repairTemplate,
  styleGuide,
  contextPack,
  model = 'gpt-5',
  maxTokens,
}: RepairEditedOptions): Promise<RepairEditedResult> {
  const userPrompt = buildRepairPrompt(edited, outline, errors, repairTemplate, styleGuide, contextPack);
  logEvent({ type: 'repair-start', errorCount: errors.length });

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
      response_format: { type: 'json_schema', json_schema: { name: 'edited', schema: editedJsonSchema } },
    });

    const json: Edited = extractJson<Edited>(text);
    const title = edited.title;
    const description = edited.description;

    const { cleaned, removedCount } = scrubTodoClaims(json.markdown);
    if (removedCount > 0) {
      logEvent({ type: 'todo-claim-warning', removedCount, stage: 'repair' });
    }

    const repaired: Edited = { markdown: cleaned, title, description };
    logEvent({ type: 'repair-complete', title });
    return { edited: repaired, messages, raw: text };
  } catch (err) {
    logError(err, { type: 'repair-error', raw: text });
    (err as any).prompt = userPrompt;
    (err as any).messages = messages;
    (err as any).raw = text;
    throw err;
  }
}
