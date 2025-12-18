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
  editTemplate?: string;
  model?: string;
  maxTokens?: number;
}

export interface RepairEditedResult {
  edited: Edited;
  messages: ChatMessage[];
  raw: string;
}

function buildRepairPrompt(edited: Edited, outline: Outline, errors: string[], editTemplate = ''): string {
  const h2List = outline.sections.map(s => `- ## ${s.h2}`).join('\n');
  const templateBlock = editTemplate.trim() ? `\n\nDodatkowe instrukcje:\n${editTemplate.trim()}\n` : '';

  return (
    `Napraw ponizszy artykul zgodnie z bledami walidacji. ` +
    `Nie dodawaj nowych faktow ani zrodel; mozesz tylko usuwac, uogolniac i przeredagowywac zdania, aby spelnic reguly. ` +
    `Zachowaj tytul i opis DOKLADNIE jak podano.\n\n` +
    `Bledy walidacji:\n${errors.map(e => `- ${e}`).join('\n')}\n\n` +
    `Wymagane naglowki sekcji (musza wystapic w tekscie dokladnie jako linie zaczynajace sie od "## "):\n${h2List}\n\n` +
    `Twarde reguly:\n` +
    `- W finalnym tekscie nie moze pozostac [[TODO-CLAIM]].\n` +
    `- Jesli w zdaniu pojawia sie liczba, data (np. rok 2024) albo slowo "raport"/"statystyk(a/i)" — to samo zdanie MUSI zawierac pelny URL http(s)://... do zrodla.\n` +
    `- Jesli nie masz pewnego URL, usuń liczbe/date/wzmianke o raporcie i uogolnij zdanie. Nie wymyslaj danych ani linkow.\n` +
    templateBlock +
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
  editTemplate,
  model = 'gpt-5',
  maxTokens,
}: RepairEditedOptions): Promise<RepairEditedResult> {
  const userPrompt = buildRepairPrompt(edited, outline, errors, editTemplate);
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

