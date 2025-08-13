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
  'Nie cytuj ‘najnowszego raportu X’ bez źródła.',
  'Dane liczbowe tylko jako trend/zakres albo z warunkami (jeśli brak źródła).',
];

export async function generateOutline({ apiKey, baseTopic, model = 'gpt-5', maxTokens }: GenerateOutlineOptions): Promise<GenerateOutlineResult> {
  const userPrompt = `Temat bazowy: ${baseTopic}\nPrzygotuj konspekt satyrycznego artykułu (PL-patriotyczny).\n4 sekcje; każda 2–3 krótkie bullet’y.\nW 1–2 bulletach wpleć analogie z ostatnich 2 lat.\nKażdy bullet zawiera 1 konkretną statystykę/datę/nazwę raportu ze źródłem (np. GUS/Eurostat/NATO/BBC).\nGdy brak pewnych danych — wstaw dokładnie [[TODO-CLAIM]].\nDodaj listę guardrails (avoid) 3–6 pozycji.`;
  const systemPrompt = `${guardrails()} Zwracaj wyłącznie poprawny JSON { "finalTitle", "description", "sections": [{ "h2", "bullets": [string] }], "guardrails": [string] } bez markdownu i komentarzy.`;
  logEvent({ type: 'outline-start' });
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  let text = '';
  try {
    text = await chat(apiKey, {
      messages,
      max_completion_tokens: maxTokens ?? 800,
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
    if (outline.sections.length !== 4) {
      throw new Error('Outline must have 4 sections');
    }
    for (const s of outline.sections) {
      if (!s.bullets || s.bullets.length < 2 || s.bullets.length > 3) {
        throw new Error('Each section needs 2–3 bullets');
      }
    }

    logEvent({ type: 'outline-complete', title: outline.finalTitle });
    return { outline, messages, raw: text };
  } catch (err) {
    logError(err, { type: 'outline-error', raw: text });
    (err as any).prompt = userPrompt;
    (err as any).messages = messages;
    (err as any).raw = text;
    throw err;
  }
}
