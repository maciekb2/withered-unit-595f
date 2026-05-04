import { logEvent, logError } from '../utils/logger';
import type { Outline } from './types';
import { chat, type ChatMessage, type TextGenerationProvider } from './openai';
import { guardrails } from './guardrails';
import { extractJson } from '../utils/json';
import { outlineJsonSchema } from './schemas';
import { assertArticleDescription, cleanArticleDescription } from './description';

export interface GenerateOutlineOptions {
  apiKey: string;
  baseTopic: string;
  topicContext?: string;
  model?: string;
  maxTokens?: number;
  provider?: TextGenerationProvider;
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

export async function generateOutline({ apiKey, baseTopic, topicContext, model = 'gpt-5', maxTokens = 2000, provider }: GenerateOutlineOptions): Promise<GenerateOutlineResult> {
  const ctxBlock = topicContext ? `Kontekst (JSON):\n${topicContext}\n\n` : '';
  const userPrompt =
    ctxBlock +
    `Temat bazowy: ${baseTopic}\n` +
    'Przygotuj konspekt artykulu w stylu Pseudointelektu (PL-patriotyczny, ironiczny, publicystyczny).\n' +
    'Opis ma brzmiec jak naturalny lead tematyczny; nie uzywaj slow: satyra, satyryczny, satyryczna, satyrycznie, tekst, artykul.\n' +
    '3 sekcje; kazda dokladnie 2 krotkie bullet-pointy.\n' +
    'Naglowki sekcji h2 maja byc krotkimi etykietami watku, nie moga powtarzac finalTitle ani jego duzych fragmentow.\n' +
    'Kazdy bullet musi bezposrednio nawiazywac do tematu bazowego; kazda sekcja rozwija ten sam watek, bez nowych osi narracji.\n' +
    'W 1-2 bulletach wplec analogie z ostatnich 2 lat.\n' +
    'W calym artykule 3-5 zrodel, maks 1 na sekcje; jesli podajesz zrodlo, podaj je jako pelny URL http(s)://... w tym samym bullecie.\n' +
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
      provider,
      response_style: 'normal',
      response_format: { type: 'json_schema', json_schema: { name: 'outline', schema: outlineJsonSchema } },
    });

    const json = extractJson<any>(text);

    const outline: Outline = {
      finalTitle: json.finalTitle,
      description: cleanArticleDescription(json.description),
      sections: cleanSectionHeadings(json.finalTitle, json.sections),
      guardrails: json.guardrails || [],
    };

    for (const gr of REQUIRED_GUARDRAILS) {
      if (!outline.guardrails.includes(gr)) outline.guardrails.push(gr);
    }

    assertArticleDescription(outline.description);
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

function cleanSectionHeadings(
  finalTitle: string,
  sections: { h2: string; bullets: string[] }[],
): { h2: string; bullets: string[] }[] {
  const used = new Set<string>();
  return sections.map((section, index) => {
    const fallback = uniqueHeading(fallbackHeading(index), used);
    const h2 = sectionHeadingTooClose(finalTitle, section.h2)
      ? fallback
      : uniqueHeading(section.h2, used);
    return { ...section, h2 };
  });
}

function sectionHeadingTooClose(finalTitle: string, h2: string): boolean {
  const title = normalizeHeading(finalTitle);
  const heading = normalizeHeading(h2);
  if (!title || !heading) return false;
  if (title === heading) return true;
  if (title.includes(heading) && heading.length >= 14) return true;
  if (heading.includes(title) && title.length >= 14) return true;

  const titleTokens = meaningfulTokens(finalTitle);
  const headingTokens = meaningfulTokens(h2);
  if (headingTokens.length < 2) return false;
  const common = headingTokens.filter(token => titleTokens.includes(token)).length;
  return common / headingTokens.length >= 0.75 && common >= 2;
}

function normalizeHeading(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function meaningfulTokens(value: string): string[] {
  return normalizeHeading(value)
    .split(/\s+/)
    .filter(token => token.length >= 4 && !HEADING_STOPWORDS.has(token));
}

function uniqueHeading(value: string, used: Set<string>): string {
  let candidate = value.trim() || fallbackHeading(0);
  const base = candidate;
  let counter = 2;
  while (used.has(normalizeHeading(candidate))) {
    candidate = `${base} ${counter}`;
    counter += 1;
  }
  used.add(normalizeHeading(candidate));
  return candidate;
}

function fallbackHeading(index: number): string {
  return SECTION_HEADING_FALLBACKS[index] || `Wątek ${index + 1}`;
}

const SECTION_HEADING_FALLBACKS = [
  'Oś sporu',
  'Rachunek za bezpieczeństwo',
  'Polska puenta',
];

const HEADING_STOPWORDS = new Set([
  'oraz',
  'przy',
  'jest',
  'jako',
  'czyli',
  'ktory',
  'ktora',
  'ktore',
  'nad',
  'pod',
  'dla',
  'bez',
  'jak',
  'gdy',
  'sie',
]);
