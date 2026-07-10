import { logEvent, logError } from '../utils/logger';
import type { Edited, Outline } from './types';
import { chat, type ChatMessage, type TextGenerationProvider } from './openai';
import { guardrails } from './guardrails';
import { scrubTodoClaims } from './scrubTodoClaims';
import { extractJson } from '../utils/json';
import { cleanArticleDescription } from './description';

export interface SectionedWriteOptions {
  apiKey: string;
  outline: Outline;
  styleGuide?: string;
  contextPack?: string;
  model?: string;
  provider?: TextGenerationProvider;
  leadSourceUrl?: string;
  paragraphsPerSection?: number;
  maxTokensPerCall?: number;
}

export interface SectionedWriteResult {
  edited: Edited;
  messages: ChatMessage[];
  raw: string;
  sections: { h2: string; raw: string; markdown: string }[];
}

const DEFAULT_PARAGRAPHS_PER_SECTION = 3;
const DEFAULT_TOKENS_PER_CALL = 1800;
const TARGET_WORDS_PER_SECTION = 320;
export async function writeArticleSectioned({
  apiKey,
  outline,
  styleGuide = '',
  contextPack = '',
  model = 'gpt-5',
  provider,
  leadSourceUrl,
  paragraphsPerSection = DEFAULT_PARAGRAPHS_PER_SECTION,
  maxTokensPerCall = DEFAULT_TOKENS_PER_CALL,
}: SectionedWriteOptions): Promise<SectionedWriteResult> {
  logEvent({
    type: 'sectioned-write-start',
    title: outline.finalTitle,
    sectionCount: outline.sections.length,
    paragraphsPerSection,
  });

  const sourceUrl = leadSourceUrl || leadSourceUrlFromContext(contextPack) || 'https://example.com';
  const messages: ChatMessage[] = [];
  const rawParts: string[] = [];

  const lead = cleanArticleDescription(outline.description);
  rawParts.push(lead);

  const writtenSections: { h2: string; raw: string; markdown: string }[] = [];
  for (let index = 0; index < outline.sections.length; index += 1) {
    const section = outline.sections[index];
    const prior = writtenSections
      .map(s => `## ${s.h2}\n${s.markdown}`)
      .join('\n\n')
      .slice(-1800);
    const sectionPrompt = buildSectionPrompt({
      outline,
      sectionIndex: index,
      styleGuide,
      contextPack,
      prior,
      paragraphsPerSection,
      targetWordsPerSection: TARGET_WORDS_PER_SECTION,
    });
    const sectionMessages = [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: sectionPrompt },
    ];
    messages.push(...sectionMessages);

    try {
      const sectionRaw = await chat(apiKey, {
        messages: sectionMessages,
        max_completion_tokens: maxTokensPerCall,
        model,
        provider,
        response_style: 'full',
      });
      rawParts.push(sectionRaw);
      writtenSections.push({
        h2: section.h2,
        raw: sectionRaw,
        markdown: sanitizeBodyText(sectionRaw, sourceUrl, section.h2),
      });
      logEvent({ type: 'sectioned-write-section-complete', h2: section.h2, index });
    } catch (err) {
      logError(err, { type: 'sectioned-write-section-error', h2: section.h2, index });
      throw err;
    }
  }

  const markdown = assembleMarkdown({
    outline,
    lead,
    sections: writtenSections,
    sourceUrl,
  });
  const { cleaned, removedCount } = scrubTodoClaims(markdown);
  if (removedCount > 0) {
    logEvent({ type: 'todo-claim-warning', removedCount, stage: 'sectioned-write' });
  }

  const edited = {
    title: outline.finalTitle,
    description: lead,
    markdown: cleaned,
  };
  logEvent({
    type: 'sectioned-write-complete',
    title: edited.title,
    length: edited.markdown.length,
  });
  return { edited, messages, raw: rawParts.join('\n\n---\n\n'), sections: writtenSections };
}

function systemPrompt(): string {
  return [
    guardrails(),
    'Pisz po polsku w stylu Pseudointelektu: konkretnie, publicystycznie i ironicznie. Każdy akapit zakotwicz w aktorze, miejscu, instrumencie, koszcie, logistyce albo skutku z kontekstu.',
    'Nie doklejaj automatycznie polskiej perspektywy, szachownicy, teatru, cyrku, wielkiej gry ani geopolitycznego tańca.',
    'Nie nazywaj gotowego tekstu satyrą ani artykułem; nie używaj w treści słów satyra, satyryczny, satyryczna, satyrycznie.',
    'Nie ujawniaj rozumowania. Zwracaj wyłącznie gotowy tekst artykułu, bez komentarzy technicznych.',
  ].join(' ');
}

function buildSectionPrompt({
  outline,
  sectionIndex,
  styleGuide,
  contextPack,
  prior,
  paragraphsPerSection,
  targetWordsPerSection,
}: {
  outline: Outline;
  sectionIndex: number;
  styleGuide: string;
  contextPack: string;
  prior: string;
  paragraphsPerSection: number;
  targetWordsPerSection: number;
}): string {
  const section = outline.sections[sectionIndex];
  return [
    'Napisz jedną sekcję artykułu. Nie pisz całego artykułu.',
    `Tytuł artykułu: ${outline.finalTitle}`,
    `Sekcja ${sectionIndex + 1}/${outline.sections.length}: ${section.h2}`,
    `Tezy do rozwinięcia:\n${section.bullets.map(b => `- ${b}`).join('\n')}`,
    `Napisz ${paragraphsPerSection} akapity po 5-7 zdań każdy; cała sekcja ma mieć około ${targetWordsPerSection}-${targetWordsPerSection + 80} słów.`,
    'Jeśli model musi wybierać między zwięzłością a kompletnością, wybierz kompletność: rozwiń oba bullet-pointy konkretnie, ale bez nowych faktów.',
    'Nie dodawaj nagłówka sekcji; nagłówek zostanie dodany przez system.',
    'Nie dodawaj żadnych URL, przypisów ani list wypunktowanych.',
    'Trzymaj jeden wątek i nawiązuj do poprzednich sekcji bez powtarzania tych samych zdań.',
    'Zwróć wyłącznie gotowe akapity po polsku. Bez JSON, bez komentarza, bez analizy i bez markdown fences.',
    block('DOTYCHCZAS NAPISANE', prior),
    block('KONTEKST', contextPack),
    block('STYLE GUIDE', styleGuide),
  ].filter(Boolean).join('\n\n');
}

function assembleMarkdown({
  outline,
  lead,
  sections,
  sourceUrl,
}: {
  outline: Outline;
  lead: string;
  sections: { h2: string; markdown: string }[];
  sourceUrl: string;
}): string {
  const leadText = lead || outline.description;
  const leadWithSource = `${withoutTrailingPunctuation(leadText)}. Źródło tematu: ${sourceUrl}`;
  return [
    `# ${outline.finalTitle}`,
    outline.description,
    leadWithSource,
    ...sections.flatMap(section => [`## ${section.h2}`, section.markdown]),
  ]
    .map(part => part.trim())
    .filter(Boolean)
    .join('\n\n');
}

function sanitizeBodyText(text: string, allowedUrl: string, h2: string): string {
  const cleaned = extractRelevantSection(stripMetaPreamble(jsonMarkdownOrText(text)), h2)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```[\s\S]*?```/g, block => block.replace(/```[a-z]*|```/gi, ''))
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !/^#{1,6}\s+/.test(line))
    .map(line => line.replace(/^\s*[-*]\s+/, ''))
    .join('\n\n')
    .replace(/https?:\/\/\S+/gi, match => (match === allowedUrl ? match : ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return removeMetaParagraphs(cleaned);
}

function extractRelevantSection(text: string, h2: string): string {
  const lines = text.trim().split('\n');
  const h2Index = lines.findIndex(line => normalizeHeadingLine(line) === normalizeHeadingLine(h2));
  if (h2Index === -1) return text;

  const nextH2Index = lines.findIndex((line, index) =>
    index > h2Index && /^##\s+/.test(line.trim())
  );
  return lines
    .slice(h2Index + 1, nextH2Index === -1 ? undefined : nextH2Index)
    .join('\n')
    .trim();
}

function normalizeHeadingLine(value: string): string {
  return value
    .replace(/^#{1,6}\s+/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function jsonMarkdownOrText(text: string): string {
  try {
    const parsed = extractJson<unknown>(text);
    if (parsed && typeof parsed === 'object') {
      const markdown = (parsed as Record<string, unknown>).markdown;
      const content = (parsed as Record<string, unknown>).content;
      const textValue = (parsed as Record<string, unknown>).text;
      if (typeof markdown === 'string') return markdown;
      if (typeof content === 'string') return content;
      if (typeof textValue === 'string') return textValue;
    }
  } catch {
    // Plain-text section responses are expected for Jetson.
  }
  return text;
}

function stripMetaPreamble(text: string): string {
  const cleaned = text.trim();
  const separatorIndex = cleaned.lastIndexOf('\n---');
  if (separatorIndex !== -1) {
    return cleaned.slice(separatorIndex).replace(/^-+\s*/m, '').trim();
  }

  const lines = cleaned.split('\n');
  const firstContentIndex = lines.findIndex(line => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !isLikelyModelMetaLine(trimmed);
  });
  return firstContentIndex > 0 ? lines.slice(firstContentIndex).join('\n').trim() : cleaned;
}

function isLikelyModelMetaLine(line: string): boolean {
  return /^(okay|let'?s|we need|i need|the user|this query|i should|need to|first,|next,|then,|finally,|wait,|so,)/i.test(line);
}

function removeMetaParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(part => part && !isLikelyMetaParagraph(part))
    .join('\n\n')
    .trim();
}

function isLikelyMetaParagraph(paragraph: string): boolean {
  const lower = paragraph.toLowerCase();
  if (/^(okay|wait|so,|the user|the key points|i need|let'?s|first,|but the user|the response)/i.test(paragraph)) {
    return true;
  }
  const englishMetaHits = [
    'json',
    'response_style',
    'format wyjściowy',
    'the user',
    'the lead',
    'the article',
    'guardrails',
    'markdown fences',
  ].filter(token => lower.includes(token)).length;
  return englishMetaHits >= 2;
}

function leadSourceUrlFromContext(contextPack: string): string | undefined {
  try {
    const parsed = JSON.parse(contextPack);
    return typeof parsed.leadSourceUrl === 'string' ? parsed.leadSourceUrl : undefined;
  } catch {
    return undefined;
  }
}

function block(label: string, value: string): string {
  const trimmed = value.trim();
  return trimmed ? `${label}:\n${trimmed}` : '';
}

function clamp(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function withoutTrailingPunctuation(value: string): string {
  return value.trim().replace(/[.!?…]+$/u, '');
}
