import { logEvent, logError } from '../utils/logger';
import type { Outline } from './types';
import { chat, type ChatMessage } from './openai';
import { guardrails } from './guardrails';
import { extractJson } from '../utils/json';
import { outlineJsonSchema } from './schemas';

export interface GenerateOutlineOptions {
  apiKey: string;
  baseTopic: string;
  model?: string;
  maxTokens?: number;
}

export interface GenerateOutlineResult {
  outline: Outline;
  messages: ChatMessage[];
  raw: string;
}

const REQUIRED_GUARDRAILS = [
  'Nie cytuj najnowszego raportu bez zrodla.',
  'Dane liczbowe tylko jako trend/zakres albo z warunkami (jesli brak zrodla).',
  'Trzymaj sie jednego glownego tematu bez zmiany osi narracji.',
];

export async function generateOutline({ apiKey, baseTopic, model = 'gpt-5', maxTokens = 2000 }: GenerateOutlineOptions): Promise<GenerateOutlineResult> {
  const userPrompt =
    `Temat bazowy: ${baseTopic}\n` +
    'Przygotuj konspekt satyrycznego artykulu (PL-patriotyczny).\n' +
    '3 sekcje; kazda dokladnie 2 krotkie bullet-pointy.\n' +
    'Kazdy bullet musi bezposrednio nawiazywac do tematu bazowego; kazda sekcja rozwija ten sam watek, bez nowych osi narracji.\n' +
    'W 1-2 bulletach wplec analogie z ostatnich 2 lat.\n' +
    'W calym artykule 3-5 zrodel, maks 1 na sekcje; bullet moze miec 0-1 zrodlo (np. GUS/Eurostat/NATO/BBC).\n' +
    'Gdy brak pewnych danych – wstaw dokladnie [[TODO-CLAIM]].\n' +
    'Dodaj liste guardrails (avoid) 3-6 pozycji.';
  const systemPrompt = `${guardrails()} Zwracaj wylacznie poprawny JSON { "finalTitle", "description", "sections": [{ "h2", "bullets": [string] }], "guardrails": [string] } bez markdownu i komentarzy.`;
  logEvent({ type: 'outline-start' });
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  let text = '';
  try {
    text = await chat(apiKey, {
      messages,
      max_completion_tokens: maxTokens,
      model,
      response_style: 'normal',
      response_format: { type: 'json_schema', json_schema: { name: 'outline', schema: outlineJsonSchema } },
    });

    const json = extractJson<any>(text);

    const outline: Outline = {
      finalTitle: json.finalTitle,
      description: json.description,
      sections: json.sections,
      guardrails: json.guardrails || [],
    };

    for (const gr of REQUIRED_GUARDRAILS) {
      if (!outline.guardrails.includes(gr)) outline.guardrails.push(gr);
    }

    if (outline.description.length > 200) {
      throw new Error('Description too long');
    }
    if (/[#*_`]/.test(outline.description)) {
      throw new Error('Description contains markdown');
    }
    if (outline.sections.length !== 3) {
      throw new Error('Outline must have 3 sections');
    }
    for (const s of outline.sections) {
      if (!s.bullets || s.bullets.length !== 2) {
        throw new Error('Each section needs exactly 2 bullets');
      }
    }

    logEvent({ type: 'outline-complete', title: outline.finalTitle });
    return { outline, messages, raw: text };
  } catch (err) {
    const debug = (err as any).debug;
    logError(err, { type: 'outline-error', raw: text, debug });
    (err as any).prompt = userPrompt;
    (err as any).messages = messages;
    (err as any).raw = text;
    if (debug) (err as any).debug = debug;
    throw err;
  }
}
