import type { FinalJson, Outline } from '../types';
import {
  headingRepeatsTitle,
  isRedundantLeadBlock,
  normalizeArticleFragment,
} from '../articleBody';
import { detectReasoningLeakage } from '../reasoningFilter';

export interface QualityValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    characters: number;
    words: number;
    h2Count: number;
    paragraphs: number;
  };
}

export const MIN_ARTICLE_WORDS = 850;
export const TARGET_ARTICLE_WORDS = 1050;

const GENERIC_PHRASES = [
  'wielkie narracje',
  'zdrowy dystans',
  'geopolityczna układanka',
  'świat pod lupą',
  'czas pokaże',
  'nie sposób nie zauważyć',
  'nie ma tu wielkiej metafizyki',
  'to zdanie brzmi jak',
  'najciekawsze jest',
  'problem w tym',
  'w tej historii',
  'pozostaje pytanie',
  'geopolityczny taniec',
];

export function validateArticleQuality(
  article: FinalJson,
  outline: Outline,
): QualityValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const content = article.content || '';
  const blocks = content
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean);
  const h2Headings = [...content.matchAll(/^##\s+(.+)$/gm)].map(match => match[1].trim());
  const paragraphs = content
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(part => part && !/^#{1,6}\s+/.test(part));
  const words = (content.match(/\p{L}[\p{L}\p{M}-]*/gu) || []).length;

  const reasoningLeaks = detectReasoningLeakage(content);
  if (reasoningLeaks.length > 0) {
    errors.push(`ERROR: Wykryto ujawnione rozumowanie modelu (${reasoningLeaks.length})`);
  }

  if (blocks[0] && headingRepeatsTitle(blocks[0], article.title)) {
    errors.push('ERROR: Body zaczyna sie od powtorzonego tytulu artykulu');
  }

  if (paragraphs.some(paragraph => isRedundantLeadBlock(paragraph, article.description))) {
    errors.push('ERROR: Body powtarza opis/lead wyswietlany juz pod tytulem');
  }

  if (words < MIN_ARTICLE_WORDS) {
    errors.push(
      `ERROR: Artykul jest za krotki (${words} slow); minimum to ${MIN_ARTICLE_WORDS} slow`,
    );
  } else if (words < TARGET_ARTICLE_WORDS) {
    warnings.push(
      `WARN: Artykul jest krotszy niz cel redakcyjny (${words} slow); cel to ${TARGET_ARTICLE_WORDS}+ slow`,
    );
  }

  if (h2Headings.length < outline.sections.length) {
    errors.push(
      `ERROR: Brakuje sekcji H2 (${h2Headings.length}/${outline.sections.length})`,
    );
  }

  if (h2Headings.some(heading => headingTooCloseToTitle(article.title, heading))) {
    errors.push('ERROR: Naglowek sekcji powtarza tytul lub jego duzy fragment');
  }

  const duplicateParagraphs = repeatedParagraphCount(paragraphs);
  if (duplicateParagraphs > 0) {
    errors.push(`ERROR: Wykryto powtorzone akapity (${duplicateParagraphs})`);
  }

  const duplicateSentences = repeatedSentenceCount(content);
  if (duplicateSentences > 0) {
    errors.push(`ERROR: Wykryto wielokrotnie powtorzone zdania (${duplicateSentences})`);
  }

  const genericHits = GENERIC_PHRASES.filter(phrase =>
    content.toLowerCase().includes(phrase),
  );
  if (genericHits.length > 0) {
    warnings.push(`WARN: Generyczne frazy do recznego przegladu: ${genericHits.join(', ')}`);
  }

  if (paragraphs.length < outline.sections.length * 2) {
    warnings.push(`WARN: Malo akapitow wzgledem liczby sekcji (${paragraphs.length})`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      characters: content.length,
      words,
      h2Count: h2Headings.length,
      paragraphs: paragraphs.length,
    },
  };
}

function repeatedSentenceCount(content: string): number {
  const counts = new Map<string, number>();
  const sentences = content
    .replace(/^#{1,6}\s+.+$/gm, '')
    .split(/(?<=[.!?])\s+/)
    .map(sentence => normalizeArticleFragment(sentence))
    .filter(sentence => sentence.length >= 55);
  for (const sentence of sentences) counts.set(sentence, (counts.get(sentence) || 0) + 1);
  return [...counts.values()].filter(count => count >= 4).reduce((sum, count) => sum + count - 1, 0);
}

function headingTooCloseToTitle(title: string, heading: string): boolean {
  const normalizedTitle = normalize(title);
  const normalizedHeading = normalize(heading);
  if (!normalizedTitle || !normalizedHeading) return false;
  if (normalizedTitle === normalizedHeading) return true;
  if (normalizedTitle.includes(normalizedHeading) && normalizedHeading.length >= 14) return true;
  if (normalizedHeading.includes(normalizedTitle) && normalizedTitle.length >= 14) return true;

  const titleTokens = meaningfulTokens(title);
  const headingTokens = meaningfulTokens(heading);
  if (headingTokens.length < 2) return false;
  const common = headingTokens.filter(token => titleTokens.includes(token)).length;
  return common >= 2 && common / headingTokens.length >= 0.75;
}

function repeatedParagraphCount(paragraphs: string[]): number {
  let repeated = 0;
  const normalized = paragraphs
    .map(paragraph => normalizeArticleFragment(paragraph))
    .filter(paragraph => paragraph.length >= 80);
  for (let index = 0; index < normalized.length; index++) {
    for (let previous = 0; previous < index; previous++) {
      if (paragraphsAreNearDuplicates(normalized[index], normalized[previous])) {
        repeated += 1;
        break;
      }
    }
  }
  return repeated;
}

function paragraphsAreNearDuplicates(left: string, right: string): boolean {
  if (left === right) return true;
  if (left.length >= 120 && right.length >= 120 && (left.startsWith(right) || right.startsWith(left))) {
    return true;
  }
  const leftTokens = new Set(left.split(/\s+/));
  const rightTokens = new Set(right.split(/\s+/));
  const union = new Set([...leftTokens, ...rightTokens]);
  const common = [...leftTokens].filter(token => rightTokens.has(token)).length;
  return union.size > 0 && common / union.size >= 0.92;
}

function meaningfulTokens(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .filter(token => token.length >= 4 && !STOPWORDS.has(token));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  'oraz',
  'przy',
  'jest',
  'jako',
  'czyli',
  'ktory',
  'ktora',
  'ktore',
  'przed',
  'wobec',
  'swoje',
  'swoja',
  'wlasny',
  'wlasna',
]);
