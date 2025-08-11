import { logEvent, logError } from '../utils/logger';
import type { Outline } from './types';
import { chat } from './openai';
import { guardrails } from './guardrails';
import { extractJson } from '../utils/json';

export interface GenerateOutlineOptions {
  apiKey: string;
  baseTopic: string;
  model?: string;
  maxTokens?: number;
}

const REQUIRED_GUARDRAILS = [
  'Nie cytuj ‘najnowszego raportu X’ bez źródła.',
  'Dane liczbowe tylko jako trend/zakres albo z warunkami (jeśli brak źródła).',
];

export async function generateOutline({ apiKey, baseTopic, model = 'gpt-4o', maxTokens }: GenerateOutlineOptions): Promise<Outline> {
  const prompt = `Temat bazowy: ${baseTopic}\nNa jego podstawie przygotuj konspekt artykułu satyrycznego w tonie centro-prawicowym, PL-patriotycznym.\nUwzględnij 4–6 sekcji (każda 2–5 bulletów) i jedną lub dwie analogie do sytuacji z ostatnich 2 lat.\nDodaj listę guardrails (avoid).\nWynik parsuj jako { finalTitle, description, sections: [{h2, bullets}], guardrails }.`;
  logEvent({ type: 'outline-start' });
  try {
    const text = await chat(apiKey, {
      system: guardrails(),
      user: prompt,
      temperature: 0.3,
      top_p: 0.9,
      max_tokens: maxTokens ?? 800,
      model,
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
    if (outline.sections.length < 4 || outline.sections.length > 6) {
      throw new Error('Outline must have 4–6 sections');
    }
    for (const s of outline.sections) {
      if (!s.bullets || s.bullets.length < 2) {
        throw new Error('Each section needs at least two bullets');
      }
    }

    logEvent({ type: 'outline-complete', title: outline.finalTitle });
    return outline;
  } catch (err) {
    logError(err, { type: 'outline-error' });
    throw err;
  }
}
