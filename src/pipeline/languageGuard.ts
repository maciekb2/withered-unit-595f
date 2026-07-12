import { logError, logEvent } from '../utils/logger';
import { extractJson } from '../utils/json';
import { chat, type ChatMessage, type TextGenerationProvider } from './openai';
import { guardrails } from './guardrails';
import { assertArticleDescription, cleanArticleDescription, normalizeObviousPolishNames } from './description';
import type { Edited } from './types';
import { stripModelReasoning } from './reasoningFilter';

export type LanguageIssueField = 'title' | 'description' | 'firstParagraph';

export interface LanguageIssue {
  field: LanguageIssueField;
  reason: string;
  sample: string;
}

export interface EnsurePolishArticleLanguageOptions {
  apiKey: string;
  edited: Edited;
  provider?: TextGenerationProvider;
  model?: string;
  contextPack?: string;
  maxAttempts?: number;
}

export interface EnsurePolishArticleLanguageResult {
  edited: Edited;
  issues: LanguageIssue[];
  repaired: boolean;
}

interface LanguageRepairJson {
  title: string;
  description: string;
  firstParagraph: string;
}

const POLISH_DIACRITIC_RE = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const LATIN_LETTER_RE = /[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g;
const ENGLISH_WORD_RE =
  /\b(the|and|or|but|with|without|after|before|from|into|over|under|amid|reveals?|systemic|fragility|complacency|government|minister|election|party|talks?|state|security|market|world|right-wing|left-wing|starts?|calls?|says?|evacuat(?:e|es|ing|ed)|cruise|ship|virus-hit|opened|closed|reopened|soon|possible)\b/gi;
const POLISH_WORD_RE =
  /\b(i|oraz|ale|czy|bez|przez|dla|nad|pod|przy|gdy|jak|który|która|które|nie|się|jest|są|ma|mają|po|wobec|między|polska|europa|świat|rząd|państwo|wybory|statek|kryzys|procedura|tematu|źródło)\b/gi;

export function detectLanguageIssues(edited: Edited): LanguageIssue[] {
  const firstParagraph = extractFirstParagraph(edited.markdown);
  const checks: Array<{ field: LanguageIssueField; value: string }> = [
    { field: 'title', value: edited.title },
    { field: 'description', value: edited.description },
    { field: 'firstParagraph', value: firstParagraph },
  ];

  return checks.flatMap(({ field, value }) => {
    const reason = likelyEnglishReason(value, field);
    return reason ? [{ field, reason, sample: value.slice(0, 180) }] : [];
  });
}

export async function ensurePolishArticleLanguage({
  apiKey,
  edited,
  provider,
  model = 'gpt-5',
  contextPack = '',
  maxAttempts = 2,
}: EnsurePolishArticleLanguageOptions): Promise<EnsurePolishArticleLanguageResult> {
  let current = normalizeEdited(edited);
  let issues = detectLanguageIssues(current);
  logEvent({
    type: 'language-check',
    ok: issues.length === 0,
    issues: issues.map(issue => ({ field: issue.field, reason: issue.reason })),
  });

  if (issues.length === 0) {
    return { edited: current, issues, repaired: false };
  }

  for (let attempt = 1; attempt <= maxAttempts && issues.length > 0; attempt += 1) {
    logEvent({
      type: 'language-repair-start',
      attempt,
      fields: issues.map(issue => issue.field),
    });
    current = await repairLanguage({
      apiKey,
      edited: current,
      issues,
      provider,
      model,
      contextPack,
      attempt,
    });
    issues = detectLanguageIssues(current);
    logEvent({
      type: 'language-repair-complete',
      attempt,
      ok: issues.length === 0,
      remainingFields: issues.map(issue => issue.field),
    });
  }

  if (issues.length > 0) {
    logEvent({
      type: 'language-repair-failed',
      issues: issues.map(issue => ({ field: issue.field, reason: issue.reason })),
    });
    throw new Error(`Language validation failed: ${issues.map(issue => `${issue.field}: ${issue.reason}`).join('; ')}`);
  }

  return { edited: current, issues: [], repaired: true };
}

async function repairLanguage({
  apiKey,
  edited,
  issues,
  provider,
  model,
  contextPack,
  attempt,
}: {
  apiKey: string;
  edited: Edited;
  issues: LanguageIssue[];
  provider?: TextGenerationProvider;
  model: string;
  contextPack: string;
  attempt: number;
}): Promise<Edited> {
  const firstParagraph = extractFirstParagraph(edited.markdown);
  const userPrompt = [
    'Popraw język artykułu Pseudointelektu.',
    'Przetłumacz na naturalny polski tylko pola wskazane jako podejrzane o angielski.',
    'Nie dodawaj faktów, dat, liczb, URL-i ani źródeł.',
    'Nie zmieniaj sensu, tonu publicystycznego ani struktury markdowna.',
    'Tytuł ma mieć maksymalnie 100 znaków. Opis ma mieć maksymalnie 200 znaków i nie może zawierać markdowna.',
    'Pierwszy akapit zwróć jako sam akapit bez nagłówków markdown.',
    `Podejrzane pola: ${issues.map(issue => `${issue.field} (${issue.reason})`).join(', ')}`,
    contextPack.trim() ? `KONTEKST (JSON):\n${contextPack.trim()}` : '',
    `Tytuł:\n${edited.title}`,
    `Opis:\n${edited.description}`,
    `Pierwszy akapit:\n${firstParagraph}`,
    'Zwróć wyłącznie JSON { "title", "description", "firstParagraph" }.',
  ].filter(Boolean).join('\n\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: guardrails() },
    { role: 'user', content: userPrompt },
  ];
  let text = '';
  try {
    text = await chat(apiKey, {
      messages,
      max_completion_tokens: 1400,
      model,
      provider,
      response_style: 'normal',
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'language_repair',
          schema: {
            type: 'object',
            required: ['title', 'description', 'firstParagraph'],
            additionalProperties: false,
            properties: {
              title: { type: 'string', maxLength: 100 },
              description: { type: 'string', maxLength: 200, pattern: '^[^#*_`]*$' },
              firstParagraph: { type: 'string', minLength: 20 },
            },
          },
        },
      },
    });
    const json = extractJson<LanguageRepairJson>(stripModelReasoning(text));
    const repaired = applyFirstParagraph(edited.markdown, sanitizeParagraph(json.firstParagraph));
    return normalizeEdited({
      title: json.title || edited.title,
      description: json.description || edited.description,
      markdown: repaired,
    });
  } catch (err) {
    if (provider?.type === 'jetson' && provider.fallback === 'openai') {
      logEvent({ type: 'language-repair-fallback', from: 'jetson', to: 'openai', attempt });
      return repairLanguage({
        apiKey,
        edited,
        issues,
        provider: { type: 'openai' },
        model: provider.fallbackModel || 'gpt-5',
        contextPack,
        attempt,
      });
    }
    logError(err, { type: 'language-repair-error', attempt, raw: text, prompt: messages });
    (err as any).messages = messages;
    (err as any).raw = text;
    throw err;
  }
}

function normalizeEdited(edited: Edited): Edited {
  const description = cleanArticleDescription(edited.description);
  assertArticleDescription(description);
  return {
    title: normalizeObviousPolishNames(edited.title).trim(),
    description,
    markdown: edited.markdown,
  };
}

function likelyEnglishReason(value: string, field: LanguageIssueField): string | undefined {
  const text = normalizeLanguageSample(value);
  if (!text) return `${field} is empty`;

  const englishHits = matchCount(text, ENGLISH_WORD_RE);
  const polishHits = matchCount(text, POLISH_WORD_RE);
  const hasPolishDiacritic = POLISH_DIACRITIC_RE.test(text);
  const asciiLetterRatio = latinRatio(text);

  if (englishHits >= 2 && polishHits === 0 && !hasPolishDiacritic) {
    return 'strong English vocabulary without Polish signals';
  }
  if (field === 'firstParagraph' && englishHits >= 4 && polishHits <= 1 && asciiLetterRatio > 0.98) {
    return 'first paragraph is likely English';
  }
  if ((field === 'title' || field === 'description') && englishHits >= 1 && polishHits === 0 && asciiLetterRatio > 0.98) {
    return `${field} is likely English`;
  }
  return undefined;
}

function extractFirstParagraph(markdown: string): string {
  const parts = markdown
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean)
    .filter(part => !/^#{1,6}\s+/.test(part))
    .filter(part => !/^---+$/.test(part));
  return parts[0] || '';
}

function applyFirstParagraph(markdown: string, firstParagraph: string): string {
  if (!firstParagraph.trim()) return markdown;
  const parts = markdown.split(/(\n{2,})/);
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const trimmed = part.trim();
    if (!trimmed || /^#{1,6}\s+/.test(trimmed) || /^---+$/.test(trimmed)) continue;
    parts[index] = preserveOuterWhitespace(part, firstParagraph.trim());
    return parts.join('');
  }
  return markdown;
}

function preserveOuterWhitespace(original: string, replacement: string): string {
  const leading = original.match(/^\s*/)?.[0] || '';
  const trailing = original.match(/\s*$/)?.[0] || '';
  return `${leading}${replacement}${trailing}`;
}

function sanitizeParagraph(value: string): string {
  return value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/```[a-z]*|```/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLanguageSample(value: string): string {
  return (value || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchCount(value: string, pattern: RegExp): number {
  pattern.lastIndex = 0;
  return value.match(pattern)?.length || 0;
}

function latinRatio(value: string): number {
  const letters = value.match(LATIN_LETTER_RE) || [];
  if (letters.length === 0) return 0;
  const ascii = letters.filter(letter => /^[a-zA-Z]$/.test(letter)).length;
  return ascii / letters.length;
}
